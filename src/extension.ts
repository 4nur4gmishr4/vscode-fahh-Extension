import * as vscode from 'vscode';
import * as fs from 'fs';
import { AudioPlayer } from './core/audioPlayer';
import { FahhConfig, FailureSource, HistoryEntry } from './types';
import { ConfigManager } from './config/configManager';
import { SecretManager } from './config/secretManager';
import { registerFailureDetectors, FailureHandler, SuccessHandler } from './core/failureDetector';
import { Logger } from './utils/logger';
import { Scheduler } from './utils/scheduler';
import { SoundResolver } from './core/soundResolver';
import { StatusBarManager } from './ui/statusBar';
import { HistoryManager } from './utils/history';
import { IntegrationsManager } from './integrations/integrations';
import { WelcomePanel } from './ui/welcome';
import { ErrorExplanationManager } from './ui/errorExplanation';

/**
 * Main extension class that orchestrates all Fahh components.
 * Manages the lifecycle of the extension and coordinates between core, config, UI, and integration layers.
 */
class FahhExtension {
    private readonly logger: Logger;
    private readonly player: AudioPlayer;
    private readonly configManager: ConfigManager;
    private readonly secretManager: SecretManager;
    private readonly scheduler: Scheduler;
    private readonly soundResolver: SoundResolver;
    private readonly statusBar: StatusBarManager;
    private readonly history: HistoryManager;
    private readonly integrations: IntegrationsManager;
    private readonly errorExplanation: ErrorExplanationManager;
    private config: FahhConfig;
    private detectors: vscode.Disposable | null = null;
    private historyView: vscode.TreeView<vscode.TreeItem> | null = null;

    /**
     * Creates a new FahhExtension instance.
     * @param ctx - The VS Code extension context
     */
    public constructor(private readonly ctx: vscode.ExtensionContext) {
        this.logger = new Logger('Fahh');
        this.player = new AudioPlayer(this.logger);
        this.configManager = new ConfigManager(ctx.secrets);
        this.secretManager = new SecretManager(ctx.secrets);
        this.config = this.configManager.readConfig();
        this.logger.setLevel(this.config.logLevel);
        this.scheduler = new Scheduler(() => this.config, this.logger);
        this.soundResolver = new SoundResolver(ctx.extensionPath, () => this.config, this.logger);
        this.statusBar = new StatusBarManager(() => this.config, this.logger, ctx.globalState);
        this.history = new HistoryManager(() => this.config, this.logger, ctx.globalState);
        this.integrations = new IntegrationsManager(this.configManager, this.secretManager, this.logger, ctx.globalState);
        this.errorExplanation = new ErrorExplanationManager(this.logger, this.integrations, ctx.extensionUri);
    }

    /**
     * Starts the extension by registering all components, commands, and event listeners.
     * This method is called once during extension activation.
     */
    public start(): void {
        this.logger.info(`Fahh v2.1.2 activating on ${process.platform} (VS Code ${vscode.version}).`);

        this.statusBar.refresh();
        this.registerDetectors();
        this.registerCommands();
        this.registerHistoryView();

        void this.maybeShowWelcomeOnInstall();

        this.ctx.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration((event) => {
                if (!this.configManager.affectsFahh(event)) { return; }
                this.config = this.configManager.readConfig();
                this.logger.setLevel(this.config.logLevel);
                this.statusBar.refresh();
                this.integrations.onConfigChanged();
                this.logger.debug('Configuration reloaded.');
            }),
            this.player,
            this.logger,
            this.scheduler,
            this.statusBar,
            this.history,
            this.integrations,
            { dispose: () => this.detectors?.dispose() },
            { dispose: () => this.historyView?.dispose() }
        );
    }

    /**
     * Shows the welcome panel on first install or major version upgrades.
     * Updates the stored version in global state.
     */
    private async maybeShowWelcomeOnInstall(): Promise<void> {
        const version = this.ctx.extension.packageJSON.version as string;
        const lastVersion = this.ctx.globalState.get<string>('lastVersion');
        if (shouldShowWelcome(lastVersion, version)) {
            WelcomePanel.createOrShow(this.ctx.extensionUri);
        }
        
        // Perform API key migration for users upgrading from older versions
        await this.migrateApiKeys(lastVersion);
        
        if (lastVersion !== version) {
            try {
                await this.ctx.globalState.update('lastVersion', version);
            } catch (err) {
                this.logger.warn(`Failed to persist lastVersion: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    }

    /**
     * Migrate API keys from plaintext configuration to secure SecretStorage.
     * 
     * This method handles the migration of API keys for users upgrading from versions
     * that stored keys in plaintext configuration to the new secure storage system.
     * It also prompts users to configure their own API keys if they were using the
     * hardcoded OpenRouter key.
     * 
     * @param lastVersion - The previously installed version, or undefined for first install
     */
    private async migrateApiKeys(lastVersion: string | undefined): Promise<void> {
        // Skip migration on first install
        if (!lastVersion) {
            return;
        }

        // Check if migration has already been performed
        const migrationCompleted = this.ctx.globalState.get<boolean>('apiKeyMigrationCompleted', false);
        if (migrationCompleted) {
            return;
        }

        this.logger.info('Starting API key migration...');

        try {
            const cfg = vscode.workspace.getConfiguration('fahh');
            
            // Check if user has OpenRouter API key in plaintext config
            const plaintextApiKey = cfg.get<string>('openrouterApiKey', '').trim();
            
            if (plaintextApiKey && plaintextApiKey.length > 0) {
                // Migrate plaintext API key to SecretStorage
                this.logger.info('Migrating OpenRouter API key from plaintext to secure storage...');
                
                try {
                    await this.secretManager.storeApiKey('openrouter', plaintextApiKey);
                    
                    // Clear the plaintext key from configuration
                    await cfg.update('openrouterApiKey', '', vscode.ConfigurationTarget.Global);
                    await cfg.update('openrouterApiKey', '', vscode.ConfigurationTarget.Workspace);
                    
                    this.logger.info('API key migration completed successfully');
                    
                    void vscode.window.showInformationMessage(
                        'Fahh: Your OpenRouter API key has been migrated to secure storage.'
                    );
                } catch (err) {
                    this.logger.error(`Failed to migrate API key: ${err instanceof Error ? err.message : String(err)}`);
                    
                    void vscode.window.showWarningMessage(
                        'Fahh: Failed to migrate API key to secure storage. Please reconfigure your OpenRouter API key in settings.'
                    );
                }
            } else {
                // Check if user is using OpenRouter provider but has no API key configured
                const aiProvider = cfg.get<string>('aiProvider', 'copilot');
                const hasStoredKey = await this.secretManager.hasApiKey('openrouter');
                
                if (aiProvider === 'openrouter' && !hasStoredKey) {
                    // User might have been using the hardcoded key - prompt them to configure their own
                    this.logger.info('User is using OpenRouter but has no API key configured');
                    
                    const action = await vscode.window.showWarningMessage(
                        'Fahh: OpenRouter API key is required. The hardcoded key has been removed for security. Please configure your own API key.',
                        'Configure Now',
                        'Switch to Copilot',
                        'Disable AI Features'
                    );
                    
                    if (action === 'Configure Now') {
                        const apiKey = await vscode.window.showInputBox({
                            prompt: 'Enter your OpenRouter API key (starts with sk-or-v1-)',
                            password: true,
                            placeHolder: 'sk-or-v1-...',
                            validateInput: (value) => {
                                if (!value || value.trim().length === 0) {
                                    return 'API key cannot be empty';
                                }
                                if (!value.startsWith('sk-or-v1-')) {
                                    return 'Invalid OpenRouter API key format. Expected: sk-or-v1-...';
                                }
                                return null;
                            }
                        });
                        
                        if (apiKey) {
                            try {
                                await this.secretManager.storeApiKey('openrouter', apiKey);
                                void vscode.window.showInformationMessage('Fahh: OpenRouter API key configured successfully.');
                            } catch (err) {
                                this.logger.error(`Failed to store API key: ${err instanceof Error ? err.message : String(err)}`);
                                void vscode.window.showErrorMessage(`Fahh: Failed to store API key: ${err instanceof Error ? err.message : String(err)}`);
                            }
                        }
                    } else if (action === 'Switch to Copilot') {
                        await cfg.update('aiProvider', 'copilot', vscode.ConfigurationTarget.Global);
                        void vscode.window.showInformationMessage('Fahh: Switched to GitHub Copilot for AI features.');
                    } else if (action === 'Disable AI Features') {
                        await cfg.update('aiSummary.enabled', false, vscode.ConfigurationTarget.Global);
                        await cfg.update('errorExplanation.enabled', false, vscode.ConfigurationTarget.Global);
                        void vscode.window.showInformationMessage('Fahh: AI features disabled.');
                    }
                }
            }
            
            // Mark migration as completed
            await this.ctx.globalState.update('apiKeyMigrationCompleted', true);
            this.logger.info('API key migration process completed');
            
        } catch (err) {
            this.logger.error(`Error during API key migration: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    /**
     * Registers failure and success detectors for tasks, terminals, and diagnostics.
     * Disposes of any existing detectors before registering new ones.
     */
    private registerDetectors(): void {
        if (this.detectors) {
            this.detectors.dispose();
        }
        const onFailure: FailureHandler = (event) => this.handleFailure(event.source, event.label);
        const onSuccess: SuccessHandler = (event) => this.handleSuccess(event.source, event.label);
        this.detectors = registerFailureDetectors(() => this.config, onFailure, onSuccess, this.logger);
    }

    /**
     * Handles a detected failure event.
     * Plays sound, shows notifications, records history, and triggers integrations.
     * @param source - The source of the failure (task, terminal, or diagnostic)
     * @param label - A human-readable description of the failure
     */
    private async handleFailure(source: FailureSource, label: string): Promise<void> {
        if (!this.config.enabled) { return; }
        if (this.scheduler.isMuted(source)) {
            this.logger.debug(`Failure muted by scheduler: ${label}`);
            return;
        }
        if (this.config.ignorePatterns.some((re) => re.test(label))) {
            this.logger.debug(`Failure ignored by pattern: ${label}`);
            return;
        }

        try {
            this.scheduler.record(source);
            this.statusBar.flash();

            this.logger.info(`Failure: [${source}] ${label}`);

            // Sound (Triggered before AI summary to prevent latency)
            const soundPath = await this.soundResolver.resolveForFailure(source, false);
            if (soundPath) {
                const volume = this.applyVolumeCurve(this.soundResolver.getVolume(source));
                this.player.play(soundPath, { volume }).catch(err => {
                    this.logger.debug(`Playback failed: ${err instanceof Error ? err.message : String(err)}`);
                });
            }

            // AI Summary
            let extraMsg = '';
            if (this.config.aiSummaryEnabled) {
                const summary = await this.integrations.getAiSummary(label);
                if (summary) { extraMsg = ` - ${summary}`; }
            }

            // Notification
            if (this.config.showNotification && this.config.notificationLevel !== 'none') {
                const msg = `${label}${extraMsg}`;
                switch (this.config.notificationLevel) {
                    case 'info': void vscode.window.showInformationMessage(msg); break;
                    case 'warning': void vscode.window.showWarningMessage(msg); break;
                    case 'error': void vscode.window.showErrorMessage(msg); break;
                }
            }

            // Voice
            this.integrations.speak(`${source} failed: ${label}`);

            // Webhook
            this.integrations.postWebhook(label, source);

            // Boss fight
            const bossMsg = await this.integrations.recordFailure();
            this.statusBar.refresh();
            if (bossMsg) {
                void vscode.window.showInformationMessage(bossMsg);
            }

            // History
            const entry: HistoryEntry = {
                id: `${Date.now()}-${Math.random()}`,
                timestamp: Date.now(),
                source,
                label,
                soundPath: soundPath ?? ''
            };
            this.history.add(entry);

            // Error explanation popup
            if (this.config.errorExplanationEnabled && this.config.errorExplanationAutoShow) {
                this.errorExplanation.showFailureExplanation({
                    source,
                    label,
                    timestamp: Date.now()
                });
            }
        } catch (err) {
            this.logger.error(`Error in handleFailure: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    /**
     * Handles a detected success event.
     * Plays success sound and records streak information.
     * @param source - The source of the success (task, terminal, or diagnostic)
     * @param label - A human-readable description of the success
     */
    private async handleSuccess(source: FailureSource, label: string): Promise<void> {
        if (!this.config.successEnabled) { return; }
        this.logger.debug(`Success: [${source}] ${label}`);

        try {
            const soundPath = await this.soundResolver.resolveForFailure(source, true);
            if (soundPath) {
                const volume = this.applyVolumeCurve(this.soundResolver.getVolume(source));
                this.player.play(soundPath, { volume }).catch(err => {
                    this.logger.debug(`Playback failed: ${err instanceof Error ? err.message : String(err)}`);
                });
            }

            const streakMsg = await this.integrations.recordSuccess();
            if (streakMsg) {
                void vscode.window.showInformationMessage(streakMsg);
            }
        } catch (err) {
            this.logger.error(`Error in handleSuccess: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    /**
     * Applies a volume curve transformation to the given volume value.
     * Supports linear (default) and logarithmic curves.
     * @param volume - The input volume (0-100)
     * @returns The transformed volume value (0-100)
     */
    private applyVolumeCurve(volume: number): number {
        if (this.config.volumeCurve === 'log') {
            // Logarithmic curve: perceptually more natural
            if (volume <= 0) { return 0; }
            const normalized = volume / 100;
            const logVal = Math.log10(1 + normalized * 9) / Math.log10(10);
            return Math.round(logVal * 100);
        }
        return volume;
    }

    /**
     * Registers the failure history tree view in the VS Code sidebar.
     */
    private registerHistoryView(): void {
        this.historyView = vscode.window.createTreeView('fahh.history', { treeDataProvider: this.history });
    }

    /**
     * Registers all VS Code commands provided by the extension.
     * Commands include test sounds, toggle, sound selection, history management, and settings.
     */
    private registerCommands(): void {
        const cmds = [
            vscode.commands.registerCommand('fahh.test', async () => {
                const soundPath = await this.soundResolver.resolveForFailure('task', false);
                if (!soundPath) {
                    void vscode.window.showErrorMessage('Fahh: no sound file resolved.');
                    return;
                }
                try {
                    await this.player.play(soundPath, { volume: this.config.volume });
                    void vscode.window.showInformationMessage(`Fahh played: ${soundPath}`);
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    void vscode.window.showErrorMessage(`Fahh playback failed: ${msg}. Open "Fahh: Show Output Log" for details.`);
                }
            }),
            vscode.commands.registerCommand('fahh.testSuccess', async () => {
                const soundPath = await this.soundResolver.resolveForFailure('task', true);
                if (!soundPath) {
                    void vscode.window.showErrorMessage('Fahh: no success sound resolved.');
                    return;
                }
                try {
                    await this.player.play(soundPath, { volume: this.config.volume });
                    void vscode.window.showInformationMessage(`Fahh success played: ${soundPath}`);
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    void vscode.window.showErrorMessage(`Fahh playback failed: ${msg}. Open "Fahh: Show Output Log" for details.`);
                }
            }),
            vscode.commands.registerCommand('fahh.toggle', async () => {
                const next = !this.config.enabled;
                await this.configManager.updateEnabled(next);
                void vscode.window.showInformationMessage(`Fahh ${next ? 'enabled' : 'disabled'}.`);
                this.statusBar.refresh();
            }),
            vscode.commands.registerCommand('fahh.toggleWorkspace', async () => {
                const next = !this.config.enabled;
                await this.configManager.updateEnabled(next, vscode.ConfigurationTarget.Workspace);
                void vscode.window.showInformationMessage(`Fahh ${next ? 'enabled' : 'disabled'} for this workspace.`);
                this.statusBar.refresh();
            }),
            vscode.commands.registerCommand('fahh.selectSound', async () => {
                const picked = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    openLabel: 'Use this sound',
                    filters: { Audio: ['mp3', 'wav', 'ogg', 'flac', 'm4a'] }
                });
                if (!picked || picked.length === 0) { return; }
                await this.configManager.updateSoundPath(picked[0].fsPath);
                void vscode.window.showInformationMessage('Fahh sound updated.');
            }),
            vscode.commands.registerCommand('fahh.selectSoundFolder', async () => {
                const picked = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: 'Select folder'
                });
                if (!picked || picked.length === 0) { return; }
                await this.configManager.updateSoundFolder(picked[0].fsPath);
                void vscode.window.showInformationMessage('Fahh sound folder set. Sounds will be random from this folder.');
            }),
            vscode.commands.registerCommand('fahh.resetSound', async () => {
                await this.configManager.updateSoundPath('');
                void vscode.window.showInformationMessage('Fahh sound reset to default.');
            }),
            vscode.commands.registerCommand('fahh.pickSoundPack', async () => {
                const packs = await this.soundResolver.listSoundPacks();
                if (packs.length === 0) {
                    void vscode.window.showWarningMessage('No sound packs installed. Use custom sound instead.');
                    return;
                }
                const items = packs.map(p => ({ label: p.name, description: p.id }));
                const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Select a sound pack' });
                if (!picked) { return; }
                if (!picked.description) { return; }
                const packPath = await this.soundResolver.pickFromPack(picked.description);
                if (packPath) {
                    await this.configManager.updateSoundPath(packPath);
                    void vscode.window.showInformationMessage(`Sound pack "${picked.label}" selected.`);
                }
            }),
            vscode.commands.registerCommand('fahh.stop', () => {
                this.player.stop();
            }),
            vscode.commands.registerCommand('fahh.snooze', () => {
                this.scheduler.snooze(this.config.snoozeMinutes);
                void vscode.window.showInformationMessage(`Fahh snoozed for ${this.config.snoozeMinutes} minutes.`);
            }),
            vscode.commands.registerCommand('fahh.clearHistory', () => {
                this.history.clear();
                void vscode.window.showInformationMessage('Failure history cleared.');
            }),
            vscode.commands.registerCommand('fahh.replayLast', async () => {
                const last = this.history.getLast();
                if (last && last.soundPath) {
                    try {
                        await fs.promises.access(last.soundPath);
                        this.player.play(last.soundPath, { volume: this.config.volume }).catch(err => {
                            this.logger.debug(`Playback failed: ${err instanceof Error ? err.message : String(err)}`);
                        });
                    } catch {
                        void vscode.window.showWarningMessage('No recent failure to replay.');
                    }
                } else {
                    void vscode.window.showWarningMessage('No recent failure to replay.');
                }
            }),
            vscode.commands.registerCommand('fahh.showHistory', () => {
                vscode.commands.executeCommand('fahh.history.focus');
            }),
            vscode.commands.registerCommand('fahh.showOutput', () => {
                this.logger.show();
            }),
            vscode.commands.registerCommand('fahh.resetSettings', async () => {
                const confirm = await vscode.window.showWarningMessage(
                    'Are you sure you want to reset all Fahh settings to default?',
                    { modal: true },
                    'Reset'
                );
                if (confirm === 'Reset') {
                    await this.configManager.resetAllSettings();
                    this.config = this.configManager.readConfig();
                    this.statusBar.refresh();
                    void vscode.window.showInformationMessage('Fahh settings have been reset.');
                }
            }),
            vscode.commands.registerCommand('fahh.factoryReset', async () => {
                const confirm = await vscode.window.showWarningMessage(
                    'This will reset all settings AND clear your failure history. Proceed?',
                    { modal: true },
                    'Factory Reset'
                );
                if (confirm === 'Factory Reset') {
                    await this.configManager.resetAllSettings();
                    this.history.clear();
                    this.statusBar.resetCounter();
                    try {
                        await this.ctx.globalState.update('lastVersion', undefined);
                    } catch (err) {
                        this.logger.warn(`Failed to clear lastVersion: ${err instanceof Error ? err.message : String(err)}`);
                    }
                    this.config = this.configManager.readConfig();
                    this.statusBar.refresh();
                    void vscode.window.showInformationMessage('Fahh has been factory reset.');
                }
            }),
            vscode.commands.registerCommand('fahh.showWelcome', () => {
                WelcomePanel.createOrShow(this.ctx.extensionUri);
            })
        ];
        this.ctx.subscriptions.push(...cmds);
    }
}

/**
 * Activates the Fahh extension.
 * Called by VS Code when the extension is first activated.
 * @param ctx - The extension context provided by VS Code
 */
export function activate(ctx: vscode.ExtensionContext): void {
    const extension = new FahhExtension(ctx);
    extension.start();
}

/**
 * Deactivates the Fahh extension.
 * Called by VS Code when the extension is deactivated.
 * All disposables are automatically cleaned up by VS Code.
 */
export function deactivate(): void {
    // Disposables auto-cleaned by VS Code
}

/**
 * Determines whether the welcome screen should be shown.
 * Shows on first install or when upgrading to a new major version.
 * @param lastVersion - The previously installed version, or undefined for first install
 * @param currentVersion - The current extension version
 * @returns True if the welcome screen should be shown
 */
function shouldShowWelcome(lastVersion: string | undefined, currentVersion: string): boolean {
    if (!lastVersion) {
        // First install
        return true;
    }
    return semverMajor(lastVersion) !== semverMajor(currentVersion);
}

/**
 * Extracts the major version number from a semantic version string.
 * @param version - A semantic version string (e.g., "2.1.0")
 * @returns The major version number, or 0 if parsing fails
 */
function semverMajor(version: string): number {
    const major = Number(version.split('.')[0]);
    return Number.isFinite(major) ? major : 0;
}