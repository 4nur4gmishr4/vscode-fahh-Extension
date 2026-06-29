/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * Shared type definitions for the FaultLine extension.
 */

export type LogLevel = 'off' | 'error' | 'warn' | 'info' | 'debug';

export type FailureSource =
    | 'task'
    | 'shell'
    | 'terminal'
    | 'diagnostics'
    | 'build'
    | 'longTask';

export type NotificationLevel = 'info' | 'warning' | 'error' | 'none';

export interface QuietHours {
    enabled: boolean;
    from: string;
    to: string;
}

export interface AudioConfig {
    soundPack: string;
    soundPath: string;
    soundFolder: string;
    successEnabled: boolean;
    successSound: string;
    volume: number;
}

export interface DetectionConfig {
    sources: ReadonlySet<FailureSource>;
    cooldownMs: number;
    cooldownPerSource: boolean;
    maxPerMinute: number;
    ignorePatterns: RegExp[];
    diagnosticsThreshold: number;
    longTaskThresholdMs: number;
    branchPatterns: string[];
    quietHours: QuietHours;
    muteWhenFocused: boolean;
}

export interface WebhookConfig {
    url: string;
    allowedDomains: ReadonlyArray<string>;
    format: 'default' | 'slack' | 'discord';
    jiraUrl: string;
    jiraProject: string;
    jiraEmail: string;
}

export interface AIConfig {
    summaryEnabled: boolean;
    provider: string;
    model: string;
    errorExplanationEnabled: boolean;
    errorExplanationAutoShow: boolean;
}

export interface UIConfig {
    showNotification: boolean;
    notificationLevel: NotificationLevel;
    showStatusBar: boolean;
    statusBarCounter: boolean;
    flashStatusBar: boolean;
}

export interface CoreConfig {
    enabled: boolean;
    logLevel: LogLevel;
    historyMax: number;
    snoozeMinutes: number;
    language: string;
    dailySummary: boolean;
    streakCounter: boolean;
    bossFightMode: boolean;
}

export interface FaultLineConfig {
    core: CoreConfig;
    audio: AudioConfig;
    detection: DetectionConfig;
    webhook: WebhookConfig;
    ai: AIConfig;
    ui: UIConfig;
}

export interface HistoryEntry {
    id: string;
    timestamp: number;
    source: FailureSource;
    label: string;
    output?: string;
    soundPath: string;
    executionTime?: number;
}

export interface AudioOptions {
    volume: number;
}

export interface FailureEvent {
    source: FailureSource;
    label: string;
    output?: string;
    timestamp: number;
    executionTime?: number;
}

export type FailureHandler = (event: FailureEvent) => void;
export type SuccessHandler = (event: { source: FailureSource; label: string; executionTime?: number }) => void;
