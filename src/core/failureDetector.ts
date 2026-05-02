import * as vscode from 'vscode';
import type { FahhConfig, FailureSource } from '../types';
import { Logger } from '../utils/logger';

// Constants for rate limiting and cleanup
const TASK_START_TTL_MS = 1000 * 60 * 60; // 1 hour TTL for task starts to prevent memory leaks
const CLEANUP_INTERVAL_MS = 1000 * 60 * 15; // Every 15 minutes
const DIAGNOSTICS_DEBOUNCE_MS = 500; // Debounce 500ms

/**
 * Handler function called when a failure is detected.
 * @param event - The failure event containing source and label
 */
export type FailureHandler = (event: { source: FailureSource; label: string }) => void;

/**
 * Handler function called when a success is detected.
 * @param event - The success event containing source and label
 */
export type SuccessHandler = (event: { source: FailureSource; label: string }) => void;

/**
 * Internal tracking information for task execution.
 * @private
 */
interface TaskStartInfo {
    taskName: string;
    isBuild: boolean;
    startTime: number;
}

const taskStarts = new Map<vscode.TaskExecution, TaskStartInfo>();

/**
 * Register all failure and success detectors for VS Code events.
 * 
 * This function sets up listeners for task failures, terminal failures, and diagnostic errors.
 * It monitors VS Code's task system, terminal events, and language diagnostics to detect
 * failures and successes based on the user's configuration.
 * 
 * The function automatically cleans up task tracking data to prevent memory leaks and
 * debounces diagnostic events to avoid excessive processing.
 * 
 * @param config - Function that returns the current extension configuration
 * @param onFailure - Handler called when a failure is detected
 * @param onSuccess - Handler called when a success is detected (optional)
 * @param logger - Logger instance for diagnostic messages
 * @returns A disposable that unregisters all event listeners when disposed
 * 
 * @example
 * ```typescript
 * const disposable = registerFailureDetectors(
 *     () => configManager.readConfig(),
 *     (event) => console.log('Failure:', event),
 *     (event) => console.log('Success:', event),
 *     logger
 * );
 * 
 * // Later, clean up
 * disposable.dispose();
 * ```
 */
export function registerFailureDetectors(
    config: () => FahhConfig,
    onFailure: FailureHandler,
    onSuccess: SuccessHandler | null,
    logger: Logger
): vscode.Disposable {
    const disposables: vscode.Disposable[] = [];

    // Periodic cleanup of taskStarts to prevent memory leaks
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [execution, info] of taskStarts.entries()) {
            if (now - info.startTime > TASK_START_TTL_MS) {
                taskStarts.delete(execution);
            }
        }
    }, CLEANUP_INTERVAL_MS);
    disposables.push({ dispose: () => clearInterval(cleanupInterval) });

    registerTaskDetector(config, onFailure, onSuccess, disposables);
    registerTerminalDetector(config, onFailure, onSuccess, logger, disposables);
    registerDiagnosticsDetector(config, onFailure, disposables);

    return vscode.Disposable.from(...disposables);
}

/**
 * Register task failure and success detector.
 * 
 * Monitors VS Code task execution events to detect task failures and successes.
 * Tracks task start times to calculate duration and identify long-running tasks.
 * Handles regular tasks, build tasks, and long-running tasks based on configuration.
 * 
 * @param config - Function that returns the current extension configuration
 * @param onFailure - Handler called when a task fails
 * @param onSuccess - Handler called when a task succeeds (optional)
 * @param disposables - Array to collect disposable event listeners
 * @private
 */
function registerTaskDetector(
    config: () => FahhConfig,
    onFailure: FailureHandler,
    onSuccess: SuccessHandler | null,
    disposables: vscode.Disposable[]
): void {
    // Task process end (handles task, build, longTask)
    disposables.push(
        vscode.tasks.onDidEndTaskProcess((e) => {
            const cfg = config();
            const startInfo = taskStarts.get(e.execution);
            taskStarts.delete(e.execution);

            const code = e.exitCode;
            const isSuccess = code === 0;
            const group = e.execution.task.group;
            const isBuild = isBuildGroup(group);
            const duration = startInfo ? Date.now() - startInfo.startTime : 0;
            const taskName = e.execution.task.name ?? 'unknown';

            if (isSuccess) {
                if (!onSuccess) { return; }
                if (cfg.sources.has('task')) {
                    onSuccess({ source: 'task', label: `Task "${taskName}" succeeded` });
                }
                if (isBuild && cfg.sources.has('build')) {
                    onSuccess({ source: 'build', label: `Build "${taskName}" succeeded` });
                }
                if (cfg.sources.has('longTask') && duration >= cfg.longTaskThresholdMs) {
                    onSuccess({ source: 'longTask', label: `Long task "${taskName}" completed (${Math.round(duration / 1000)}s)` });
                }
                return;
            }

            const codeText = code === undefined ? 'signal' : String(code);

            if (cfg.sources.has('task')) {
                onFailure({ source: 'task', label: `Task "${taskName}" failed (exit ${codeText})` });
            }
            if (isBuild && cfg.sources.has('build')) {
                onFailure({ source: 'build', label: `Build "${taskName}" failed (exit ${codeText})` });
            }
            if (cfg.sources.has('longTask') && duration >= cfg.longTaskThresholdMs) {
                onFailure({ source: 'longTask', label: `Long task "${taskName}" failed after ${Math.round(duration / 1000)}s` });
            }
        })
    );

    // Track task starts for duration
    disposables.push(
        vscode.tasks.onDidStartTask((e) => {
            taskStarts.set(e.execution, {
                taskName: e.execution.task.name,
                isBuild: isBuildGroup(e.execution.task.group),
                startTime: Date.now()
            });
        })
    );
}

/**
 * Check if a task group is a build group.
 * 
 * Determines whether a VS Code task group represents a build task.
 * Prefers the stable string ID when available, falling back to reference equality.
 * 
 * @param group - The task group to check
 * @returns True if the group is a build group, false otherwise
 * @private
 */
function isBuildGroup(group: vscode.TaskGroup | undefined): boolean {
    if (!group) { return false; }
    // Prefer string id (stable across instances) when available; fall back to reference equality.
    const id = (group as unknown as { id?: string }).id;
    if (typeof id === 'string') { return id === 'build'; }
    return group === vscode.TaskGroup.Build;
}

/**
 * Register terminal failure and success detector.
 * 
 * Monitors terminal shell execution and terminal close events to detect failures.
 * Handles both shell command execution (if available in VS Code version) and
 * terminal exit status when terminals are closed.
 * 
 * @param config - Function that returns the current extension configuration
 * @param onFailure - Handler called when a terminal command fails
 * @param onSuccess - Handler called when a terminal command succeeds (optional)
 * @param logger - Logger instance for diagnostic messages
 * @param disposables - Array to collect disposable event listeners
 * @private
 */
function registerTerminalDetector(
    config: () => FahhConfig,
    onFailure: FailureHandler,
    onSuccess: SuccessHandler | null,
    logger: Logger,
    disposables: vscode.Disposable[]
): void {
    // Terminal shell execution
    if (typeof vscode.window.onDidEndTerminalShellExecution === 'function') {
        disposables.push(
            vscode.window.onDidEndTerminalShellExecution((e) => {
                const cfg = config();
                const code = e.exitCode;
                const isSuccess = code === 0;

                if (isSuccess && onSuccess && cfg.sources.has('shell')) {
                    const cmd = e.execution?.commandLine?.value ?? 'command';
                    onSuccess({ source: 'shell', label: `Shell command succeeded: ${cmd.slice(0, 80)}` });
                    return;
                }

                if (!cfg.sources.has('shell')) { return; }
                if (code === undefined || code === 0) { return; }
                const cmd = e.execution?.commandLine?.value ?? 'command';
                const trimmed = cmd.length > 80 ? `${cmd.slice(0, 77)}...` : cmd;
                onFailure({ source: 'shell', label: `Shell command failed (exit ${code}): ${trimmed}` });
            })
        );
    } else {
        logger.warn('onDidEndTerminalShellExecution not available; "shell" source disabled.');
    }

    // Terminal close
    disposables.push(
        vscode.window.onDidCloseTerminal((t) => {
            const cfg = config();
            if (!cfg.sources.has('terminal')) { return; }
            const status = t.exitStatus;
            if (!status) { return; }
            const code = status.code;
            if (code === undefined || code === 0) { return; }
            onFailure({ source: 'terminal', label: `Terminal "${t.name}" exited (code ${code})` });
        })
    );
}

/**
 * Register diagnostics failure detector.
 * 
 * Monitors VS Code language diagnostics to detect new errors in files.
 * Debounces diagnostic change events to avoid excessive processing and
 * tracks error counts per file to detect increases in error count.
 * 
 * Only triggers when the number of new errors exceeds the configured threshold.
 * Automatically cleans up tracking data when text documents are closed.
 * 
 * @param config - Function that returns the current extension configuration
 * @param onFailure - Handler called when new diagnostic errors are detected
 * @param disposables - Array to collect disposable event listeners
 * @private
 */
function registerDiagnosticsDetector(
    config: () => FahhConfig,
    onFailure: FailureHandler,
    disposables: vscode.Disposable[]
): void {
    // Diagnostics listener
    const lastDiagnosticCounts = new Map<string, number>();
    let diagTimeout: NodeJS.Timeout | null = null;
    const pendingUris = new Set<vscode.Uri>();
    
    disposables.push(
        vscode.languages.onDidChangeDiagnostics((e) => {
            for (const uri of e.uris) {
                pendingUris.add(uri);
            }
            if (diagTimeout) { clearTimeout(diagTimeout); }
            diagTimeout = setTimeout(() => {
                const cfg = config();
                if (!cfg.sources.has('diagnostics')) { 
                    pendingUris.clear();
                    return; 
                }

                let totalNewErrors = 0;
                // Only check the URIs that actually changed
                for (const uri of pendingUris) {
                    const uriString = uri.toString();
                    const diags = vscode.languages.getDiagnostics(uri);
                    const errorCount = diags.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
                    const previousCount = lastDiagnosticCounts.get(uriString) ?? 0;

                    if (errorCount > previousCount) {
                        totalNewErrors += (errorCount - previousCount);
                    }
                    lastDiagnosticCounts.set(uriString, errorCount);
                }
                pendingUris.clear();

                if (totalNewErrors >= cfg.diagnosticsThreshold) {
                    onFailure({ source: 'diagnostics', label: `${totalNewErrors} new error(s) detected in changed files` });
                }
            }, DIAGNOSTICS_DEBOUNCE_MS);
        })
    );
    disposables.push({ dispose: () => { if (diagTimeout) { clearTimeout(diagTimeout); } } });

    // Clean up memory when text documents are closed
    disposables.push(
        vscode.workspace.onDidCloseTextDocument((doc) => {
            lastDiagnosticCounts.delete(doc.uri.toString());
        })
    );
}

