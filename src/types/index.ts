/**
 * Shared type definitions for the Fahh extension.
 * This module exports all common interfaces, types, and enums used across the codebase.
 */

/**
 * Log level for the extension logger.
 */
export type LogLevel = 'off' | 'error' | 'warn' | 'info' | 'debug';

/**
 * Source of a failure event.
 */
export type FailureSource =
    | 'task'
    | 'shell'
    | 'terminal'
    | 'diagnostics'
    | 'build'
    | 'longTask';

/**
 * Notification level for user notifications.
 */
export type NotificationLevel = 'info' | 'warning' | 'error' | 'none';

/**
 * Volume curve type for audio playback.
 */
export type VolumeCurve = 'linear' | 'log';

/**
 * Quiet hours configuration.
 */
export interface QuietHours {
    enabled: boolean;
    from: string;
    to: string;
}

/**
 * Per-source sound file paths.
 */
export interface PerSourceSounds {
    task: string;
    shell: string;
    terminal: string;
    diagnostics: string;
    build: string;
    longTask: string;
}

/**
 * Per-source volume levels (0-100, or -1 for default).
 */
export interface PerSourceVolumes {
    task: number;
    shell: number;
    terminal: number;
    diagnostics: number;
    build: number;
    longTask: number;
}

/**
 * Complete extension configuration.
 */
export interface FahhConfig {
    enabled: boolean;
    soundPack: string;
    soundPath: string;
    soundFolder: string;
    sounds: PerSourceSounds;
    successEnabled: boolean;
    successSound: string;
    volumes: PerSourceVolumes;
    volume: number;
    volumeCurve: VolumeCurve;
    showNotification: boolean;
    notificationLevel: NotificationLevel;
    sources: ReadonlySet<FailureSource>;
    cooldownMs: number;
    cooldownPerSource: boolean;
    maxPerMinute: number;
    ignorePatterns: RegExp[];
    showStatusBar: boolean;
    statusBarCounter: boolean;
    flashStatusBar: boolean;
    quietHours: QuietHours;
    muteWhenFocused: boolean;
    snoozeMinutes: number;
    diagnosticsThreshold: number;
    longTaskThresholdMs: number;
    logLevel: LogLevel;
    historyMax: number;
    speakLabel: boolean;
    webhookUrl: string;
    aiSummaryEnabled: boolean;
    aiProvider: string;
    openrouterApiKey: string;
    openrouterModel: string;
    dailySummary: boolean;
    streakCounter: boolean;
    bossFightMode: boolean;
    errorExplanationEnabled: boolean;
    errorExplanationAutoShow: boolean;
}

/**
 * History entry for failure tracking.
 */
export interface HistoryEntry {
    id: string;
    timestamp: number;
    source: string;
    label: string;
    soundPath: string;
}

/**
 * Audio playback options.
 */
export interface AudioOptions {
    volume: number; // 0-100
}

/**
 * Failure event data.
 */
export interface FailureEvent {
    source: string;
    label: string;
    timestamp: number;
}

/**
 * Handler function for failure events.
 */
export type FailureHandler = (event: { source: FailureSource; label: string }) => void;

/**
 * Handler function for success events.
 */
export type SuccessHandler = (event: { source: FailureSource; label: string }) => void;
