import * as vscode from 'vscode';
import type { LogLevel } from './utils/logger';

export type FailureSource =
    | 'task'
    | 'shell'
    | 'terminal'
    | 'diagnostics'
    | 'build'
    | 'longTask';

export type NotificationLevel = 'info' | 'warning' | 'error' | 'none';
export type VolumeCurve = 'linear' | 'log';

export interface QuietHours {
    enabled: boolean;
    from: string;
    to: string;
}

export interface PerSourceSounds {
    task: string;
    shell: string;
    terminal: string;
    diagnostics: string;
    build: string;
    longTask: string;
}

export interface PerSourceVolumes {
    task: number;
    shell: number;
    terminal: number;
    diagnostics: number;
    build: number;
    longTask: number;
}

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

const SECTION = 'fahh';
const VALID_SOURCES: ReadonlySet<FailureSource> = new Set<FailureSource>([
    'task', 'shell', 'terminal', 'diagnostics', 'build', 'longTask'
]);

export function readConfig(): FahhConfig {
    const cfg = vscode.workspace.getConfiguration(SECTION);

    const rawSources = cfg.get<string[]>('sources', ['task', 'shell', 'terminal']);
    const sources = new Set<FailureSource>(
        rawSources.filter((v): v is FailureSource => VALID_SOURCES.has(v as FailureSource))
    );

    const rawPatterns = cfg.get<string[]>('ignorePatterns', []);
    const ignorePatterns = compilePatterns(rawPatterns);

    const sounds = {} as PerSourceSounds;
    const volumes = {} as PerSourceVolumes;
    
    for (const source of VALID_SOURCES) {
        sounds[source] = cfg.get<string>(`sounds.${source}`, '').trim();
        volumes[source] = clamp(cfg.get<number>(`volumes.${source}`, -1), -1, 100);
    }

    // Validate quiet hours format
    const quietHoursFrom = cfg.get<string>('quietHours.from', '22:00');
    const quietHoursTo = cfg.get<string>('quietHours.to', '08:00');
    const validTimeFormat = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    
    if (!validTimeFormat.test(quietHoursFrom)) {
        console.warn(`Invalid quiet hours 'from' format: ${quietHoursFrom}. Using default 22:00`);
    }
    if (!validTimeFormat.test(quietHoursTo)) {
        console.warn(`Invalid quiet hours 'to' format: ${quietHoursTo}. Using default 08:00`);
    }

    return {
        enabled: cfg.get<boolean>('enabled', true),
        soundPack: cfg.get<string>('soundPack', 'fahh.mp3'),
        soundPath: cfg.get<string>('soundPath', '').trim(),
        soundFolder: cfg.get<string>('soundFolder', '').trim(),
        sounds,
        successEnabled: cfg.get<boolean>('successEnabled', false),
        successSound: cfg.get<string>('successSound', '').trim(),
        volumes,
        volume: clamp(cfg.get<number>('volume', 100), 0, 100),
        volumeCurve: cfg.get<VolumeCurve>('volumeCurve', 'linear'),
        showNotification: cfg.get<boolean>('showNotification', true),
        notificationLevel: cfg.get<NotificationLevel>('notificationLevel', 'warning'),
        sources,
        cooldownMs: clamp(cfg.get<number>('cooldownMs', 50), 0, 60000),
        cooldownPerSource: cfg.get<boolean>('cooldownPerSource', false),
        maxPerMinute: clamp(cfg.get<number>('maxPerMinute', 0), 0, 120),
        ignorePatterns,
        showStatusBar: cfg.get<boolean>('showStatusBar', true),
        statusBarCounter: cfg.get<boolean>('statusBarCounter', true),
        flashStatusBar: cfg.get<boolean>('flashStatusBar', true),
        quietHours: {
            enabled: cfg.get<boolean>('quietHours.enabled', false),
            from: validTimeFormat.test(quietHoursFrom) ? quietHoursFrom : '22:00',
            to: validTimeFormat.test(quietHoursTo) ? quietHoursTo : '08:00'
        },
        muteWhenFocused: cfg.get<boolean>('muteWhenFocused', false),
        snoozeMinutes: clamp(cfg.get<number>('snoozeMinutes', 10), 1, 1440),
        diagnosticsThreshold: clamp(cfg.get<number>('diagnosticsThreshold', 1), 1, 100),
        longTaskThresholdMs: clamp(cfg.get<number>('longTaskThresholdMs', 60000), 1000, 3600000),
        logLevel: cfg.get<LogLevel>('logLevel', 'warn'),
        historyMax: clamp(cfg.get<number>('historyMax', 50), 10, 500),
        speakLabel: cfg.get<boolean>('speakLabel', false),
        webhookUrl: cfg.get<string>('webhookUrl', '').trim(),
        aiSummaryEnabled: cfg.get<boolean>('aiSummary.enabled', false),
        aiProvider: cfg.get<string>('aiProvider', 'copilot'),
        openrouterApiKey: cfg.get<string>('openrouterApiKey', '').trim(),
        openrouterModel: cfg.get<string>('openrouterModel', 'meta-llama/llama-3.2-3b-instruct:free'),
        dailySummary: cfg.get<boolean>('dailySummary', false),
        streakCounter: cfg.get<boolean>('streakCounter', false),
        bossFightMode: cfg.get<boolean>('bossFightMode', false),
        errorExplanationEnabled: cfg.get<boolean>('errorExplanation.enabled', true),
        errorExplanationAutoShow: cfg.get<boolean>('errorExplanation.autoShow', true)
    };
}

export async function updateEnabled(enabled: boolean, target?: vscode.ConfigurationTarget): Promise<void> {
    const t = target ?? vscode.ConfigurationTarget.Global;
    await vscode.workspace.getConfiguration(SECTION).update('enabled', enabled, t);
}

export async function updateSoundPath(path: string): Promise<void> {
    await vscode.workspace.getConfiguration(SECTION).update('soundPath', path, vscode.ConfigurationTarget.Global);
}

export async function updateSoundFolder(path: string): Promise<void> {
    await vscode.workspace.getConfiguration(SECTION).update('soundFolder', path, vscode.ConfigurationTarget.Global);
}

export function affectsFahh(event: vscode.ConfigurationChangeEvent): boolean {
    return event.affectsConfiguration(SECTION);
}

export async function resetAllSettings(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    const info = cfg.inspect('');
    if (!info) { return; }

    const keys = [
        ...Object.keys(info.globalValue || {}),
        ...Object.keys(info.workspaceValue || {}),
        ...Object.keys(info.workspaceFolderValue || {})
    ];

    const uniqueKeys = Array.from(new Set(keys));
    for (const key of uniqueKeys) {
        await cfg.update(key, undefined, vscode.ConfigurationTarget.Global);
        await cfg.update(key, undefined, vscode.ConfigurationTarget.Workspace);
        await cfg.update(key, undefined, vscode.ConfigurationTarget.WorkspaceFolder);
    }
}

function compilePatterns(patterns: string[]): RegExp[] {
    const compiled: RegExp[] = [];
    for (const pattern of patterns) {
        try {
            compiled.push(new RegExp(pattern));
        } catch {
            // Invalid regex; silently skip
        }
    }
    return compiled;
}

function clamp(value: number, min: number, max: number): number {
    if (Number.isNaN(value)) { return min; }
    return Math.min(Math.max(value, min), max);
}
