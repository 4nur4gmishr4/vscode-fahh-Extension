/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { ConfigManager } from '../config/configManager';
import { SecretManager } from '../config/secretManager';
import { StateStore } from '../state/stateStore';
import { Scheduler } from '../utils/scheduler';
import { AudioPlayer } from '../core/audioPlayer';
import { SoundResolver } from '../core/soundResolver';
import { StatusBarManager } from '../ui/statusBar';
import { HistoryManager } from '../utils/history';
import { AIService, WebhookService, GamificationService } from '../services';
import { TaskDetector, TerminalDetector, DiagnosticDetector } from '../detectors';
import { FailureEvent } from '../types';
import { sanitizePII } from '../security/pii';
import { ErrorExplanationManager } from '../ui/errorExplanation';

/**
 * Global application context for the extension.
 * Manages the lifecycle of all services and detectors.
 */
export class FaultLineRuntime {
    public readonly logger: Logger;
    public readonly configManager: ConfigManager;
    public readonly secretManager: SecretManager;
    public readonly stateStore: StateStore;
    public readonly scheduler: Scheduler;
    public readonly player: AudioPlayer;
    public readonly resolver: SoundResolver;
    public readonly statusBar: StatusBarManager;
    public readonly history: HistoryManager;
    public readonly errorExplanation: ErrorExplanationManager;

    public readonly ai: AIService;
    public readonly webhook: WebhookService;

    public readonly gamification: GamificationService;

    private detectors: vscode.Disposable | null = null;

    constructor(private readonly ctx: vscode.ExtensionContext) {
        this.logger = new Logger('FaultLine');
        this.secretManager = new SecretManager(ctx.secrets);
        this.configManager = new ConfigManager(ctx.secrets, this.logger);
        this.stateStore = new StateStore(ctx.globalState);

        const configFn = () => this.configManager.readConfig();
        
        this.scheduler = new Scheduler(configFn, this.logger);
        this.player = new AudioPlayer(this.logger);
        this.resolver = new SoundResolver(this.ctx.extensionPath, configFn, this.logger);
        this.statusBar = new StatusBarManager(configFn, this.logger, ctx.globalState);
        this.history = new HistoryManager(configFn, this.logger, ctx.globalState);

        this.ai = new AIService(this.configManager, this.secretManager, this.logger);
        this.webhook = new WebhookService(this.configManager, this.secretManager, this.logger);
        this.gamification = new GamificationService(this.configManager, this.stateStore, this.logger);
        this.errorExplanation = new ErrorExplanationManager(this.logger, this.ai, this.ctx.extensionUri);

        this.logger.setLevel(configFn().core.logLevel);
    }

    public activate(): void {
        this.cleanOrphanedTempFiles();
        this.registerDetectors();
        this.statusBar.refresh();
    }

    private cleanOrphanedTempFiles(): void {
        try {
            const os = require('os');
            const fs = require('fs');
            const path = require('path');
            const tmpDir = os.tmpdir();
            const files = fs.readdirSync(tmpDir);
            let cleaned = 0;
            for (const file of files) {
                if (file.startsWith('fahh_play_') && file.endsWith('.vbs')) {
                    try {
                        fs.unlinkSync(path.join(tmpDir, file));
                        cleaned++;
                    } catch (e) {
                        // ignore
                    }
                }
            }
            if (cleaned > 0) {
                this.logger.debug(`Cleaned up ${cleaned} orphaned VBScript files`);
            }
        } catch (e) {
            this.logger.error('Failed to clean orphaned temp files', e);
        }
    }

    public registerDetectors(): void {
        if (this.detectors) {
            this.detectors.dispose();
        }

        const disposables: vscode.Disposable[] = [];
        const configFn = () => this.configManager.readConfig();
        
        const onFailure = (e: FailureEvent) => { void this.handleFailure(e); };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const onSuccess = (e: { source: any; label: string; executionTime?: number }) => {
            void this.handleSuccess(e.source, e.label, e.executionTime);
        };

        new TaskDetector(configFn, this.logger, onFailure, onSuccess).register(disposables);
        new TerminalDetector(configFn, this.logger, onFailure).register(disposables);
        new DiagnosticDetector(configFn, onFailure).register(disposables);

        this.detectors = vscode.Disposable.from(...disposables);
    }

    private async handleFailure(event: FailureEvent): Promise<void> {
        const { source, label } = event;
        if (this.scheduler.isMuted(source)) {
            return;
        }

        const sanitizedLabel = sanitizePII(label);
        this.logger.info(`Failure: [${source}] ${sanitizedLabel}`);

        try {
            const soundPath = await this.resolver.resolveForFailure(source);
            const volume = this.resolver.getVolume(source);

            if (soundPath) {
                void this.player.play(soundPath, { volume }).catch(err => {
                    this.logger.debug(`Playback failed: ${err instanceof Error ? err.message : String(err)}`);
                });
            }

            const config = this.configManager.readConfig();
            
            // Async services (fire and forget)
            if (config.ai.summaryEnabled) {
                void this.ai.getAiSummary(sanitizedLabel).then(summary => {
                    if (summary) this.logger.info(`AI Summary: ${summary}`);
                }).catch(err => {
                    this.logger.debug(`AI summary failed: ${err instanceof Error ? err.message : String(err)}`);
                });
            }

            void this.webhook.postWebhook(sanitizedLabel, source);
            void this.webhook.postToJira(sanitizedLabel, source);

            const bossMsg = await this.gamification.recordFailure();
            if (bossMsg) {
                void vscode.window.showInformationMessage(bossMsg);
            }

            this.history.add({
                id: `${Date.now()}-${Math.random()}`,
                timestamp: Date.now(),
                source,
                label: sanitizedLabel,
                soundPath: soundPath ?? ''
                });

            this.statusBar.refresh();
            if (config.ui.flashStatusBar) {
                this.statusBar.flash();
            }

            if (config.ai.errorExplanationEnabled && config.ai.errorExplanationAutoShow) {
                void this.errorExplanation.showFailureExplanation(event);
            }

            if (config.ui.showNotification) {
                const message = `FaultLine: [${source}] ${sanitizedLabel}`;
                // VS Code notification buttons (appears sequential, "Configure" will be first)
                void vscode.window.showErrorMessage(message, 'Configure', 'Explain Error').then(selection => {
                    if (selection === 'Explain Error') {
                        void this.errorExplanation.showFailureExplanation(event);
                    } else if (selection === 'Configure') {
                        void vscode.commands.executeCommand('faultline.openSettings');
                    }
                });
            }
        } catch (err) {
            this.logger.error('Failed to handle failure', err);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async handleSuccess(source: any, _label: string, _executionTime?: number): Promise<void> {
        const config = this.configManager.readConfig();
        if (!config.audio.successEnabled) return;

        try {
            const soundPath = await this.resolver.resolveForFailure(source, true);
            const volume = this.resolver.getVolume(source);
            
            if (soundPath) {
                void this.player.play(soundPath, { volume });
            }
            
            const streakMsg = await this.gamification.recordSuccess();
            if (streakMsg) {
                void vscode.window.showInformationMessage(streakMsg);
            }

            this.statusBar.refresh();
        } catch (err) {
            this.logger.error('Failed to handle success', err);
        }
    }

    public dispose(): void {
        this.detectors?.dispose();
        this.player.dispose();
        this.statusBar.dispose();
        this.gamification.dispose();
    }
}
