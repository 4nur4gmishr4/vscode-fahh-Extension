import * as vscode from 'vscode';
import type { FahhConfig, HistoryEntry } from '../types';
import { Logger } from './logger';

/**
 * Manages failure history tracking and provides a tree view for VS Code.
 * 
 * This class implements VS Code's TreeDataProvider interface to display failure history
 * in the sidebar. It persists history entries to workspace state and enforces a maximum
 * history size based on user configuration.
 * 
 * @example
 * ```typescript
 * const historyManager = new HistoryManager(
 *   () => configManager.readConfig(),
 *   logger,
 *   context.workspaceState
 * );
 * 
 * // Add a failure to history
 * historyManager.add({
 *   id: 'unique-id',
 *   timestamp: Date.now(),
 *   source: 'task',
 *   label: 'Build failed',
 *   soundPath: '/path/to/sound.mp3'
 * });
 * 
 * // Get the most recent failure
 * const last = historyManager.getLast();
 * ```
 */
export class HistoryManager implements vscode.TreeDataProvider<HistoryItem> {
    private entries: HistoryEntry[] = [];
    private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<HistoryItem | undefined>();
    public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

    /**
     * Creates a new HistoryManager instance.
     * 
     * @param config - Function that returns the current extension configuration
     * @param logger - Logger instance for debug and info messages
     * @param state - VS Code Memento for persisting history across sessions
     */
    public constructor(
        private readonly config: () => FahhConfig,
        private readonly logger: Logger,
        private readonly state: vscode.Memento
    ) {
        this.entries = this.state.get<HistoryEntry[]>('fahh.history', []);
    }

    /**
     * Gets the tree item representation for a history entry.
     * Required by VS Code's TreeDataProvider interface.
     * 
     * @param element - The history item to convert to a tree item
     * @returns The tree item representation
     */
    public getTreeItem(element: HistoryItem): vscode.TreeItem {
        return element;
    }

    /**
     * Gets the children of a tree element.
     * Required by VS Code's TreeDataProvider interface.
     * 
     * @param element - The parent element (undefined for root)
     * @returns Array of child history items
     */
    public getChildren(element?: HistoryItem): HistoryItem[] {
        if (element) {
            return [];
        }
        return this.entries.map(e => new HistoryItem(e));
    }

    /**
     * Adds a new failure entry to the history.
     * Entries are added to the beginning of the list (most recent first).
     * If the history exceeds the configured maximum size, oldest entries are removed.
     * 
     * @param entry - The history entry to add
     */
    public add(entry: HistoryEntry): void {
        const max = this.config().historyMax;
        
        // Ensure we have the latest state before modifying
        this.entries = this.state.get<HistoryEntry[]>('fahh.history', []);
        
        this.entries.unshift(entry);
        if (this.entries.length > max) {
            this.entries = this.entries.slice(0, max);
        }
        this.persist();
        this.onDidChangeTreeDataEmitter.fire(undefined);
        this.logger.debug(`History added: ${entry.label}`);
    }

    /**
     * Clears all history entries.
     * This removes all entries from memory and persisted state.
     */
    public clear(): void {
        this.entries = [];
        this.persist();
        this.onDidChangeTreeDataEmitter.fire(undefined);
        this.logger.info('History cleared.');
    }

    private persistQueue: Promise<void> = Promise.resolve();

    /**
     * Persists the current history entries to workspace state.
     * Uses a queue to ensure persistence operations are serialized.
     * Errors during persistence are logged but do not throw.
     */
    private persist(): void {
        this.persistQueue = this.persistQueue.then(() => 
            this.state.update('fahh.history', this.entries)
        ).catch((err: unknown) => {
            this.logger.warn(`Failed to persist history: ${err instanceof Error ? err.message : String(err)}`);
        });
    }

    /**
     * Gets the most recent history entry.
     * 
     * @returns The most recent entry, or null if history is empty
     */
    public getLast(): HistoryEntry | null {
        return this.entries[0] ?? null;
    }

    /**
     * Gets all history entries.
     * 
     * @returns Read-only array of all history entries, ordered from most recent to oldest
     */
    public getAll(): ReadonlyArray<HistoryEntry> {
        return this.entries;
    }

    /**
     * Disposes of resources used by the history manager.
     * Should be called when the extension is deactivated.
     */
    public dispose(): void {
        this.onDidChangeTreeDataEmitter.dispose();
    }
}

/**
 * Tree item representation of a history entry for VS Code's tree view.
 * Displays the timestamp and label, with a tooltip showing full details.
 * 
 * @internal
 */
class HistoryItem extends vscode.TreeItem {
    /**
     * Creates a new HistoryItem.
     * 
     * @param entry - The history entry to represent
     */
    public constructor(public readonly entry: HistoryEntry) {
        const time = new Date(entry.timestamp).toLocaleTimeString();
        super(`${time} — ${entry.label}`, vscode.TreeItemCollapsibleState.None);
        this.tooltip = `${entry.source}: ${entry.label}\n${new Date(entry.timestamp).toLocaleString()}`;
        this.contextValue = 'fahh.historyEntry';
        this.command = {
            command: 'fahh.replayLast',
            title: 'Replay'
        };
    }
}
