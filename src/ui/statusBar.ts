import * as vscode from 'vscode';
import type { FahhConfig } from '../types';
import { Logger } from '../utils/logger';

/**
 * Manages the VS Code status bar item for the Fahh extension.
 * 
 * This class handles the creation, updating, and visual effects of the status bar item,
 * including displaying the enabled/disabled state, daily failure counter, and flash effects
 * when failures occur. The status bar item provides quick access to toggle the extension
 * and displays real-time statistics.
 * 
 * @example
 * ```typescript
 * const statusBarManager = new StatusBarManager(
 *     () => configManager.readConfig(),
 *     logger,
 *     context.workspaceState
 * );
 * 
 * // Refresh the status bar display
 * statusBarManager.refresh();
 * 
 * // Flash the status bar on failure
 * statusBarManager.flash();
 * 
 * // Get current failure count
 * const count = statusBarManager.getFailCount();
 * ```
 */
export class StatusBarManager {
    private item: vscode.StatusBarItem | null = null;
    private flashing = false;

    /**
     * Creates a new StatusBarManager instance.
     * 
     * @param config - Function that returns the current extension configuration
     * @param _logger - Logger instance for diagnostic output (currently unused)
     * @param state - Optional workspace state for persisting failure count
     */
    public constructor(
        private readonly config: () => FahhConfig,
        _logger: Logger,
        private readonly state?: vscode.Memento
    ) {}

    /**
     * Dispose of the status bar item and clean up resources.
     * 
     * This method should be called when the extension is deactivated to properly
     * clean up the status bar item and prevent memory leaks.
     * 
     * @example
     * ```typescript
     * // In extension deactivation
     * statusBarManager.dispose();
     * ```
     */
    public dispose(): void {
        this.item?.dispose();
        this.item = null;
    }

    /**
     * Refresh the status bar item display based on current configuration and state.
     * 
     * This method updates the status bar text, tooltip, and visibility based on the
     * current configuration settings and failure count. It creates the status bar item
     * if it doesn't exist and the user has enabled the status bar display.
     * 
     * The status bar shows:
     * - An unmute icon when enabled, mute icon when disabled
     * - The extension name "Fahh"
     * - An optional failure counter (if enabled in settings)
     * 
     * @example
     * ```typescript
     * // Refresh after configuration change
     * statusBarManager.refresh();
     * ```
     */
    public refresh(): void {
        const cfg = this.config();
        if (!cfg.showStatusBar) {
            this.item?.hide();
            return;
        }
        if (!this.item) {
            this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
            this.item.command = 'fahh.toggle';
        }

        const enabled = cfg.enabled;
        const count = this.state ? this.state.get<number>('fahh.dailyFailCount', 0) : 0;
        const counter = cfg.statusBarCounter ? ` • ${count}` : '';
        this.item.text = enabled ? `$(unmute) Fahh${counter}` : `$(mute) Fahh${counter}`;
        this.item.tooltip = enabled
            ? 'Fahh is enabled — click to disable'
            : 'Fahh is disabled — click to enable';
        this.item.show();
    }

    /**
     * Increment the failure counter and refresh the display.
     * 
     * This method is called when a new failure is detected. It triggers a refresh
     * of the status bar to display the updated counter value.
     * 
     * **Note**: The actual counter increment is handled by the caller updating
     * the workspace state. This method only refreshes the display.
     * 
     * @example
     * ```typescript
     * // After detecting a failure
     * statusBarManager.incrementCounter();
     * ```
     */
    public incrementCounter(): void {
        this.refresh();
    }

    /**
     * Reset the failure counter and refresh the display.
     * 
     * This method is typically called at the start of a new day or when the user
     * manually resets the counter. It triggers a refresh of the status bar to
     * display the reset counter value.
     * 
     * **Note**: The actual counter reset is handled by the caller updating
     * the workspace state. This method only refreshes the display.
     * 
     * @example
     * ```typescript
     * // Reset counter at midnight
     * statusBarManager.resetCounter();
     * ```
     */
    public resetCounter(): void {
        this.refresh();
    }

    /**
     * Flash the status bar with an error background color.
     * 
     * This method provides visual feedback when a failure occurs by temporarily
     * changing the status bar background to the error color. The flash lasts for
     * 1 second and only occurs if the flash feature is enabled in settings.
     * 
     * Multiple simultaneous flash requests are ignored to prevent overlapping animations.
     * 
     * @example
     * ```typescript
     * // Flash on failure detection
     * statusBarManager.flash();
     * ```
     */
    public flash(): void {
        const cfg = this.config();
        if (!cfg.flashStatusBar || !this.item) {
            return;
        }
        if (this.flashing) {
            return;
        }
        this.flashing = true;
        const original = this.item.backgroundColor;
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        setTimeout(() => {
            if (this.item) {
                this.item.backgroundColor = original;
            }
            this.flashing = false;
        }, 1000);
    }

    /**
     * Get the current daily failure count.
     * 
     * This method retrieves the failure count from workspace state. The count
     * represents the number of failures detected since the last reset (typically
     * at the start of each day).
     * 
     * @returns The current failure count, or 0 if no state is available
     * 
     * @example
     * ```typescript
     * const count = statusBarManager.getFailCount();
     * console.log(`Failures today: ${count}`);
     * ```
     */
    public getFailCount(): number {
        return this.state ? this.state.get<number>('fahh.dailyFailCount', 0) : 0;
    }
}
