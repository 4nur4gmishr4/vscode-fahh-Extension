import * as vscode from 'vscode';
import type { FahhConfig, FailureSource } from '../types';
import { Logger } from './logger';

// Constants for cleanup intervals
const CLEANUP_INTERVAL_MS = 60000; // 1 minute
const PER_MINUTE_WINDOW_MS = 60000; // 1 minute

/**
 * Manages rate limiting, cooldowns, quiet hours, and snooze functionality for the extension.
 * 
 * The Scheduler determines whether audio playback should be muted based on various conditions:
 * - Snooze: Temporary muting for a specified duration
 * - Quiet hours: Time-based muting (e.g., 22:00-08:00)
 * - Window focus: Mute when VS Code window is focused
 * - Rate limiting: Max failures per minute
 * - Cooldown: Minimum time between sounds (global or per-source)
 * 
 * @example
 * ```typescript
 * const scheduler = new Scheduler(() => configManager.readConfig(), logger);
 * 
 * // Check if sound should be muted
 * if (!scheduler.isMuted('task')) {
 *     audioPlayer.play(soundPath);
 *     scheduler.record('task');
 * }
 * 
 * // Snooze for 30 minutes
 * scheduler.snooze(30);
 * 
 * // Clean up when done
 * scheduler.dispose();
 * ```
 */
export class Scheduler {
    private snoozeEndAt: number = 0;
    private perSourceLast: Map<FailureSource, number> = new Map();
    private perMinuteWindow: number[] = [];
    private cleanupTimer: NodeJS.Timeout | null = null;

    /**
     * Creates a new Scheduler instance.
     * 
     * @param config - Function that returns the current extension configuration
     * @param logger - Logger instance for debug and info messages
     */
    public constructor(private readonly config: () => FahhConfig, private readonly logger: Logger) {
        // Periodically clean old per-minute entries
        this.cleanupTimer = setInterval(() => this.cleanPerMinuteWindow(), CLEANUP_INTERVAL_MS);
        this.cleanupTimer?.unref?.();
    }

    /**
     * Dispose of the scheduler and clean up resources.
     * 
     * This method should be called when the extension is deactivated to prevent
     * memory leaks from the cleanup timer.
     */
    public dispose(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    /**
     * Check if audio playback should be muted for a given failure source.
     * 
     * This method evaluates multiple muting conditions in order:
     * 1. Extension disabled
     * 2. Snooze active
     * 3. Quiet hours active
     * 4. Window focused (if muteWhenFocused enabled)
     * 5. Max per minute limit reached
     * 6. Cooldown period active
     * 
     * @param source - The failure source to check (task, terminal, diagnostics, etc.)
     * @returns True if audio should be muted, false if it should play
     * 
     * @example
     * ```typescript
     * if (!scheduler.isMuted('task')) {
     *     // Play sound
     *     audioPlayer.play(soundPath);
     *     scheduler.record('task');
     * }
     * ```
     */
    public isMuted(source: FailureSource): boolean {
        const cfg = this.config();

        if (!cfg.enabled) {
            return true;
        }

        const now = Date.now();

        // Snooze
        if (now < this.snoozeEndAt) {
            this.logger.debug(`Muted by snooze: ${source}`);
            return true;
        }

        // Quiet hours
        if (cfg.quietHours.enabled && this.isInQuietHours(cfg.quietHours.from, cfg.quietHours.to)) {
            this.logger.debug(`Muted by quiet hours: ${source}`);
            return true;
        }

        // Window focus mute
        if (cfg.muteWhenFocused && vscode.window.state.focused) {
            this.logger.debug(`Muted because window is focused: ${source}`);
            return true;
        }

        // Max per minute
        this.cleanPerMinuteWindow();
        if (cfg.maxPerMinute > 0 && this.perMinuteWindow.length >= cfg.maxPerMinute) {
            this.logger.debug(`Muted by max-per-minute: ${source}`);
            return true;
        }

        // Cooldown
        const cooldown = cfg.cooldownMs;
        if (cooldown > 0) {
            const last = cfg.cooldownPerSource
                ? this.perSourceLast.get(source) ?? 0
                : Math.max(...Array.from(this.perSourceLast.values()), 0);
            if (now - last < cooldown) {
                this.logger.debug(`Muted by cooldown: ${source}`);
                return true;
            }
        }

        return false;
    }

    /**
     * Record a failure event for rate limiting and cooldown tracking.
     * 
     * This method should be called after playing a sound to update the scheduler's
     * internal state for rate limiting (max per minute) and cooldown calculations.
     * 
     * @param source - The failure source that triggered the sound
     * 
     * @example
     * ```typescript
     * if (!scheduler.isMuted('task')) {
     *     audioPlayer.play(soundPath);
     *     scheduler.record('task'); // Record the event
     * }
     * ```
     */
    public record(source: FailureSource): void {
        const now = Date.now();
        this.perSourceLast.set(source, now);
        this.perMinuteWindow.push(now);
    }

    /**
     * Snooze audio playback for a specified number of minutes.
     * 
     * While snoozed, all audio playback will be muted regardless of other settings.
     * The snooze can be cleared early using `clearSnooze()`.
     * 
     * @param minutes - Number of minutes to snooze (must be positive)
     * 
     * @example
     * ```typescript
     * // Snooze for 30 minutes
     * scheduler.snooze(30);
     * 
     * // Check if currently snoozing
     * if (scheduler.isSnoozing()) {
     *     console.log('Audio is snoozed');
     * }
     * ```
     */
    public snooze(minutes: number): void {
        const MILLISECONDS_PER_MINUTE = 60000;
        this.snoozeEndAt = Date.now() + minutes * MILLISECONDS_PER_MINUTE;
        this.logger.info(`Snoozed for ${minutes} minutes.`);
    }

    /**
     * Check if the scheduler is currently in snooze mode.
     * 
     * @returns True if snooze is active, false otherwise
     * 
     * @example
     * ```typescript
     * if (scheduler.isSnoozing()) {
     *     statusBar.updateText('Snoozed');
     * }
     * ```
     */
    public isSnoozing(): boolean {
        return Date.now() < this.snoozeEndAt;
    }

    /**
     * Clear the active snooze and resume normal audio playback.
     * 
     * This method immediately ends the snooze period, allowing audio to play
     * again (subject to other muting conditions).
     * 
     * @example
     * ```typescript
     * // Clear snooze early
     * scheduler.clearSnooze();
     * console.log('Snooze cleared');
     * ```
     */
    public clearSnooze(): void {
        this.snoozeEndAt = 0;
    }

    /**
     * Check if the current time falls within the configured quiet hours window.
     * 
     * Quiet hours can span midnight (e.g., 22:00-08:00). The start time is inclusive,
     * and the end time is exclusive.
     * 
     * @param from - Start time in HH:mm format (e.g., "22:00")
     * @param to - End time in HH:mm format (e.g., "08:00")
     * @returns True if current time is within quiet hours, false otherwise
     * @private
     */
    private isInQuietHours(from: string, to: string): boolean {
        const fromMin = parseHHmm(from);
        const toMin = parseHHmm(to);
        if (fromMin === null || toMin === null) {
            return false;
        }
        const now = new Date();
        const current = now.getHours() * 60 + now.getMinutes();

        if (fromMin === toMin) {
            // Empty window
            return false;
        }
        if (fromMin < toMin) {
            // Same-day window: include start, exclude end (e.g. 22:00 — 08:00 means active at 22:00 but not at 08:00)
            return current >= fromMin && current < toMin;
        }
        // Crosses midnight
        return current >= fromMin || current < toMin;
    }

    /**
     * Remove expired entries from the per-minute tracking window.
     * 
     * This method is called periodically by the cleanup timer and before
     * checking the max-per-minute limit to ensure accurate rate limiting.
     * 
     * @private
     */
    private cleanPerMinuteWindow(): void {
        const cutoff = Date.now() - PER_MINUTE_WINDOW_MS;
        this.perMinuteWindow = this.perMinuteWindow.filter(t => t > cutoff);
    }
}

/**
 * Parse a time string in HH:mm format to minutes since midnight.
 * 
 * @param value - Time string in HH:mm format (e.g., "22:00", "08:30")
 * @returns Minutes since midnight (0-1439), or null if invalid format
 * 
 * @example
 * ```typescript
 * parseHHmm("22:00") // Returns 1320 (22 * 60)
 * parseHHmm("08:30") // Returns 510 (8 * 60 + 30)
 * parseHHmm("invalid") // Returns null
 * ```
 */
function parseHHmm(value: string): number | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value);
    if (!match) { return null; }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) { return null; }
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) { return null; }
    return hours * 60 + minutes;
}
