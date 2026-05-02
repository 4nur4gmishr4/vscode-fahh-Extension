import * as vscode from 'vscode';
import { CONFIG, DEFAULTS, VALIDATION } from './constants';
import { SecretManager, ISecretManager } from './secretManager';
import type {
    FahhConfig,
    FailureSource,
    NotificationLevel,
    VolumeCurve,
    PerSourceSounds,
    PerSourceVolumes,
    LogLevel
} from '../types';

/**
 * Manages extension configuration with validation, type safety, and secure credential access.
 * 
 * This class provides a centralized interface for reading and updating extension configuration,
 * integrating with VS Code's configuration system and SecretManager for secure API key storage.
 * All configuration keys are accessed through the CONSTANTS module to eliminate magic strings.
 * 
 * @example
 * ```typescript
 * const configManager = new ConfigManager(context.secrets);
 * 
 * // Read configuration
 * const config = configManager.readConfig();
 * 
 * // Get AI API key securely
 * const apiKey = await configManager.getAiApiKey();
 * 
 * // Update configuration
 * await configManager.updateEnabled(false);
 * ```
 */
export class ConfigManager {
    private readonly secretManager: ISecretManager;
    private readonly validSources: ReadonlySet<FailureSource> = new Set<FailureSource>([
        'task', 'shell', 'terminal', 'diagnostics', 'build', 'longTask'
    ]);

    /**
     * Creates a new ConfigManager instance.
     * 
     * @param secretStorage - VS Code's SecretStorage instance from ExtensionContext
     */
    constructor(secretStorage: vscode.SecretStorage) {
        this.secretManager = new SecretManager(secretStorage);
    }

    /**
     * Read and validate the current extension configuration.
     * 
     * This method reads all configuration values from VS Code's workspace configuration,
     * validates them against defined constraints, and returns a fully typed configuration object.
     * Invalid values are clamped to valid ranges or replaced with defaults.
     * 
     * **SECURITY FIX**: This method reads the AI provider from user configuration using
     * `cfg.get<string>('aiProvider', 'copilot')` instead of hardcoding "openrouter".
     * API keys are NOT read from configuration - use `getAiApiKey()` instead.
     * 
     * @returns Validated configuration object with all settings
     * 
     * @example
     * ```typescript
     * const config = configManager.readConfig();
     * console.log(`Extension enabled: ${config.enabled}`);
     * console.log(`AI provider: ${config.aiProvider}`);
     * ```
     */
    readConfig(): FahhConfig {
        const cfg = vscode.workspace.getConfiguration(CONFIG.SECTION);

        // Read and validate sources
        const rawSources = cfg.get<string[]>(CONFIG.KEYS.SOURCES, DEFAULTS.SOURCES as unknown as string[]);
        const sources = new Set<FailureSource>(
            rawSources.filter((v): v is FailureSource => this.validSources.has(v as FailureSource))
        );

        // Read and compile ignore patterns
        const rawPatterns = cfg.get<string[]>(CONFIG.KEYS.IGNORE_PATTERNS, []);
        const ignorePatterns = this.compilePatterns(rawPatterns);

        // Read per-source sounds and volumes
        const sounds = {} as PerSourceSounds;
        const volumes = {} as PerSourceVolumes;
        
        for (const source of this.validSources) {
            sounds[source] = cfg.get<string>(`${CONFIG.KEYS.SOUNDS}.${source}`, '').trim();
            volumes[source] = this.clamp(
                cfg.get<number>(`${CONFIG.KEYS.VOLUMES}.${source}`, VALIDATION.VOLUME.DEFAULT_PER_SOURCE),
                VALIDATION.VOLUME.DEFAULT_PER_SOURCE,
                VALIDATION.VOLUME.MAX
            );
        }

        // Validate quiet hours format
        const quietHoursFrom = cfg.get<string>(CONFIG.KEYS.QUIET_HOURS_FROM, DEFAULTS.QUIET_HOURS_FROM);
        const quietHoursTo = cfg.get<string>(CONFIG.KEYS.QUIET_HOURS_TO, DEFAULTS.QUIET_HOURS_TO);
        
        if (!VALIDATION.TIME_FORMAT.test(quietHoursFrom)) {
            console.warn(`Invalid quiet hours 'from' format: ${quietHoursFrom}. Using default ${DEFAULTS.QUIET_HOURS_FROM}`);
        }
        if (!VALIDATION.TIME_FORMAT.test(quietHoursTo)) {
            console.warn(`Invalid quiet hours 'to' format: ${quietHoursTo}. Using default ${DEFAULTS.QUIET_HOURS_TO}`);
        }

        return {
            enabled: cfg.get<boolean>(CONFIG.KEYS.ENABLED, DEFAULTS.ENABLED),
            soundPack: cfg.get<string>(CONFIG.KEYS.SOUND_PACK, DEFAULTS.SOUND_PACK),
            soundPath: cfg.get<string>(CONFIG.KEYS.SOUND_PATH, '').trim(),
            soundFolder: cfg.get<string>(CONFIG.KEYS.SOUND_FOLDER, '').trim(),
            sounds,
            successEnabled: cfg.get<boolean>(CONFIG.KEYS.SUCCESS_ENABLED, false),
            successSound: cfg.get<string>(CONFIG.KEYS.SUCCESS_SOUND, '').trim(),
            volumes,
            volume: this.clamp(
                cfg.get<number>(CONFIG.KEYS.VOLUME, DEFAULTS.VOLUME),
                VALIDATION.VOLUME.MIN,
                VALIDATION.VOLUME.MAX
            ),
            volumeCurve: cfg.get<VolumeCurve>(CONFIG.KEYS.VOLUME_CURVE, DEFAULTS.VOLUME_CURVE),
            showNotification: cfg.get<boolean>(CONFIG.KEYS.SHOW_NOTIFICATION, true),
            notificationLevel: cfg.get<NotificationLevel>(CONFIG.KEYS.NOTIFICATION_LEVEL, DEFAULTS.NOTIFICATION_LEVEL),
            sources,
            cooldownMs: this.clamp(
                cfg.get<number>(CONFIG.KEYS.COOLDOWN_MS, DEFAULTS.COOLDOWN_MS),
                VALIDATION.COOLDOWN.MIN,
                VALIDATION.COOLDOWN.MAX
            ),
            cooldownPerSource: cfg.get<boolean>(CONFIG.KEYS.COOLDOWN_PER_SOURCE, false),
            maxPerMinute: this.clamp(
                cfg.get<number>(CONFIG.KEYS.MAX_PER_MINUTE, DEFAULTS.MAX_PER_MINUTE),
                VALIDATION.MAX_PER_MINUTE.MIN,
                VALIDATION.MAX_PER_MINUTE.MAX
            ),
            ignorePatterns,
            showStatusBar: cfg.get<boolean>(CONFIG.KEYS.SHOW_STATUS_BAR, true),
            statusBarCounter: cfg.get<boolean>(CONFIG.KEYS.STATUS_BAR_COUNTER, true),
            flashStatusBar: cfg.get<boolean>(CONFIG.KEYS.FLASH_STATUS_BAR, true),
            quietHours: {
                enabled: cfg.get<boolean>(CONFIG.KEYS.QUIET_HOURS_ENABLED, false),
                from: VALIDATION.TIME_FORMAT.test(quietHoursFrom) ? quietHoursFrom : DEFAULTS.QUIET_HOURS_FROM,
                to: VALIDATION.TIME_FORMAT.test(quietHoursTo) ? quietHoursTo : DEFAULTS.QUIET_HOURS_TO
            },
            muteWhenFocused: cfg.get<boolean>(CONFIG.KEYS.MUTE_WHEN_FOCUSED, false),
            snoozeMinutes: this.clamp(
                cfg.get<number>(CONFIG.KEYS.SNOOZE_MINUTES, DEFAULTS.SNOOZE_MINUTES),
                VALIDATION.SNOOZE.MIN,
                VALIDATION.SNOOZE.MAX
            ),
            diagnosticsThreshold: this.clamp(
                cfg.get<number>(CONFIG.KEYS.DIAGNOSTICS_THRESHOLD, DEFAULTS.DIAGNOSTICS_THRESHOLD),
                VALIDATION.DIAGNOSTICS_THRESHOLD.MIN,
                VALIDATION.DIAGNOSTICS_THRESHOLD.MAX
            ),
            longTaskThresholdMs: this.clamp(
                cfg.get<number>(CONFIG.KEYS.LONG_TASK_THRESHOLD_MS, DEFAULTS.LONG_TASK_THRESHOLD_MS),
                VALIDATION.LONG_TASK_THRESHOLD.MIN,
                VALIDATION.LONG_TASK_THRESHOLD.MAX
            ),
            logLevel: cfg.get<LogLevel>(CONFIG.KEYS.LOG_LEVEL, DEFAULTS.LOG_LEVEL),
            historyMax: this.clamp(
                cfg.get<number>(CONFIG.KEYS.HISTORY_MAX, DEFAULTS.HISTORY_MAX),
                VALIDATION.HISTORY.MIN,
                VALIDATION.HISTORY.MAX
            ),
            speakLabel: cfg.get<boolean>(CONFIG.KEYS.SPEAK_LABEL, false),
            webhookUrl: cfg.get<string>(CONFIG.KEYS.WEBHOOK_URL, '').trim(),
            aiSummaryEnabled: cfg.get<boolean>(CONFIG.KEYS.AI_SUMMARY_ENABLED, false),
            // SECURITY FIX: Read aiProvider from user config instead of hardcoding "openrouter"
            aiProvider: cfg.get<string>(CONFIG.KEYS.AI_PROVIDER, DEFAULTS.AI_PROVIDER),
            // SECURITY FIX: Deprecated - API keys should be retrieved via getAiApiKey()
            openrouterApiKey: '',
            openrouterModel: cfg.get<string>(CONFIG.KEYS.OPENROUTER_MODEL, DEFAULTS.OPENROUTER_MODEL),
            dailySummary: cfg.get<boolean>(CONFIG.KEYS.DAILY_SUMMARY, false),
            streakCounter: cfg.get<boolean>(CONFIG.KEYS.STREAK_COUNTER, false),
            bossFightMode: cfg.get<boolean>(CONFIG.KEYS.BOSS_FIGHT_MODE, false),
            errorExplanationEnabled: cfg.get<boolean>(CONFIG.KEYS.ERROR_EXPLANATION_ENABLED, true),
            errorExplanationAutoShow: cfg.get<boolean>(CONFIG.KEYS.ERROR_EXPLANATION_AUTO_SHOW, true)
        };
    }

    /**
     * Get the AI provider API key securely from SecretManager.
     * 
     * This method retrieves the API key for the currently configured AI provider
     * from VS Code's secure secret storage. It automatically determines which provider
     * is active and retrieves the appropriate key.
     * 
     * **SECURITY**: API keys are stored in VS Code's SecretStorage, which encrypts
     * credentials at rest. They are NEVER stored in plaintext configuration.
     * 
     * @returns The API key for the current AI provider, or null if not configured
     * @throws {Error} If the AI provider is not supported
     * 
     * @example
     * ```typescript
     * const apiKey = await configManager.getAiApiKey();
     * if (apiKey) {
     *     console.log('API key is configured');
     * } else {
     *     console.log('No API key found - user needs to configure it');
     * }
     * ```
     */
    async getAiApiKey(): Promise<string | null> {
        const config = this.readConfig();
        const provider = config.aiProvider.toLowerCase();

        // Map provider names to secret storage keys
        switch (provider) {
            case 'openrouter':
                return await this.secretManager.getApiKey('openrouter');
            
            case 'copilot':
                // Copilot uses GitHub authentication, which is handled by VS Code
                // No API key needed from SecretManager
                return null;
            
            default:
                throw new Error(`Unsupported AI provider: ${provider}`);
        }
    }

    /**
     * Update the enabled state of the extension.
     * 
     * @param enabled - Whether the extension should be enabled
     * @param target - Configuration target (Global, Workspace, WorkspaceFolder)
     * @throws {Error} If the configuration update fails
     * 
     * @example
     * ```typescript
     * // Disable globally
     * await configManager.updateEnabled(false, vscode.ConfigurationTarget.Global);
     * 
     * // Enable for current workspace
     * await configManager.updateEnabled(true, vscode.ConfigurationTarget.Workspace);
     * ```
     */
    async updateEnabled(enabled: boolean, target?: vscode.ConfigurationTarget): Promise<void> {
        const t = target ?? vscode.ConfigurationTarget.Global;
        await vscode.workspace.getConfiguration(CONFIG.SECTION).update(CONFIG.KEYS.ENABLED, enabled, t);
    }

    /**
     * Update the custom sound path.
     * 
     * @param path - Path to the custom sound file
     * @throws {Error} If the configuration update fails
     * 
     * @example
     * ```typescript
     * await configManager.updateSoundPath('/path/to/custom/sound.mp3');
     * ```
     */
    async updateSoundPath(path: string): Promise<void> {
        await vscode.workspace.getConfiguration(CONFIG.SECTION).update(
            CONFIG.KEYS.SOUND_PATH,
            path,
            vscode.ConfigurationTarget.Global
        );
    }

    /**
     * Update the custom sound folder path.
     * 
     * @param path - Path to the folder containing sound files
     * @throws {Error} If the configuration update fails
     * 
     * @example
     * ```typescript
     * await configManager.updateSoundFolder('/path/to/sounds/');
     * ```
     */
    async updateSoundFolder(path: string): Promise<void> {
        await vscode.workspace.getConfiguration(CONFIG.SECTION).update(
            CONFIG.KEYS.SOUND_FOLDER,
            path,
            vscode.ConfigurationTarget.Global
        );
    }

    /**
     * Check if a configuration change event affects the Fahh extension.
     * 
     * @param event - VS Code configuration change event
     * @returns True if the change affects Fahh configuration
     * 
     * @example
     * ```typescript
     * vscode.workspace.onDidChangeConfiguration(event => {
     *     if (configManager.affectsFahh(event)) {
     *         console.log('Fahh configuration changed - reloading...');
     *         const newConfig = configManager.readConfig();
     *     }
     * });
     * ```
     */
    affectsFahh(event: vscode.ConfigurationChangeEvent): boolean {
        return event.affectsConfiguration(CONFIG.SECTION);
    }

    /**
     * Reset all Fahh settings to their default values.
     * 
     * This method removes all user-configured values at all configuration levels
     * (Global, Workspace, WorkspaceFolder), effectively resetting the extension
     * to its default state.
     * 
     * **WARNING**: This operation cannot be undone. All customizations will be lost.
     * 
     * @throws {Error} If the configuration reset fails
     * 
     * @example
     * ```typescript
     * await configManager.resetAllSettings();
     * console.log('All settings reset to defaults');
     * ```
     */
    async resetAllSettings(): Promise<void> {
        const cfg = vscode.workspace.getConfiguration(CONFIG.SECTION);
        const info = cfg.inspect('');
        if (!info) { 
            return; 
        }

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

    /**
     * Compile regex patterns from string patterns, skipping invalid patterns.
     * 
     * @param patterns - Array of regex pattern strings
     * @returns Array of compiled RegExp objects
     * @private
     */
    private compilePatterns(patterns: string[]): RegExp[] {
        const compiled: RegExp[] = [];
        for (const pattern of patterns) {
            try {
                compiled.push(new RegExp(pattern));
            } catch {
                // Invalid regex; silently skip
                console.warn(`Invalid regex pattern ignored: ${pattern}`);
            }
        }
        return compiled;
    }

    /**
     * Clamp a numeric value to a valid range.
     * 
     * @param value - The value to clamp
     * @param min - Minimum allowed value
     * @param max - Maximum allowed value
     * @returns The clamped value
     * @private
     */
    private clamp(value: number, min: number, max: number): number {
        if (Number.isNaN(value)) { 
            return min; 
        }
        return Math.min(Math.max(value, min), max);
    }
}

/**
 * Legacy function for backward compatibility.
 * 
 * @deprecated Use ConfigManager class instead
 * @returns Validated configuration object
 */
export function readConfig(): FahhConfig {
    // This function is kept for backward compatibility during migration
    // It will be removed once all code is updated to use ConfigManager
    throw new Error('readConfig() is deprecated. Use ConfigManager.readConfig() instead.');
}

/**
 * Legacy function for backward compatibility.
 * 
 * @deprecated Use ConfigManager.updateEnabled() instead
 */
export async function updateEnabled(_enabled: boolean, _target?: vscode.ConfigurationTarget): Promise<void> {
    throw new Error('updateEnabled() is deprecated. Use ConfigManager.updateEnabled() instead.');
}

/**
 * Legacy function for backward compatibility.
 * 
 * @deprecated Use ConfigManager.updateSoundPath() instead
 */
export async function updateSoundPath(_path: string): Promise<void> {
    throw new Error('updateSoundPath() is deprecated. Use ConfigManager.updateSoundPath() instead.');
}

/**
 * Legacy function for backward compatibility.
 * 
 * @deprecated Use ConfigManager.updateSoundFolder() instead
 */
export async function updateSoundFolder(_path: string): Promise<void> {
    throw new Error('updateSoundFolder() is deprecated. Use ConfigManager.updateSoundFolder() instead.');
}

/**
 * Legacy function for backward compatibility.
 * 
 * @deprecated Use ConfigManager.affectsFahh() instead
 */
export function affectsFahh(event: vscode.ConfigurationChangeEvent): boolean {
    return event.affectsConfiguration(CONFIG.SECTION);
}

/**
 * Legacy function for backward compatibility.
 * 
 * @deprecated Use ConfigManager.resetAllSettings() instead
 */
export async function resetAllSettings(): Promise<void> {
    throw new Error('resetAllSettings() is deprecated. Use ConfigManager.resetAllSettings() instead.');
}
