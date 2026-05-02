import * as vscode from 'vscode';
import { execFile } from 'child_process';
import * as http from 'http';
import * as https from 'https';
import { Logger } from '../utils/logger';
import { ConfigManager } from '../config/configManager';
import { SecretManager } from '../config/secretManager';

const MAX_SPEAK_QUEUE_SIZE = 5;
const WEBHOOK_MAX_RETRIES = 3;
const WEBHOOK_RETRY_DELAY_MS = 1000; // Initial delay, doubles each retry

/**
 * Manages external integrations including AI providers, webhooks, TTS, and gamification features.
 * 
 * This class provides integration with:
 * - AI providers (OpenRouter, Copilot) for error explanations and summaries
 * - Webhook notifications for failure events
 * - Text-to-speech (TTS) for audio labels
 * - Gamification features (boss fight mode, streak counter, daily summary)
 * 
 * **SECURITY**: Uses SecretManager for secure API key retrieval instead of hardcoded credentials.
 * 
 * @example
 * ```typescript
 * const integrations = new IntegrationsManager(configManager, secretManager, logger, state);
 * 
 * // Get AI explanation for an error
 * const explanation = await integrations.getAiExplanation('Build failed: syntax error');
 * 
 * // Post webhook notification
 * integrations.postWebhook('Build Failed', 'task');
 * 
 * // Record failure for gamification
 * const message = await integrations.recordFailure();
 * ```
 */
export class IntegrationsManager {
    private lastSuccessStreak = 0;
    private bossHp = 100;
    private dailyFailCount = 0;
    private dailyTimer: NodeJS.Timeout | null = null;

    private speakQueue: string[] = [];
    private isSpeaking = false;
    private speakProcess: ReturnType<typeof execFile> | null = null;

    /**
     * Creates a new IntegrationsManager instance.
     * 
     * @param configManager - Configuration manager for reading extension settings
     * @param secretManager - Secret manager for secure API key retrieval
     * @param logger - Logger instance for diagnostic output
     * @param state - VS Code Memento for persisting gamification state
     */
    public constructor(
        private readonly configManager: ConfigManager,
        private readonly secretManager: SecretManager,
        private readonly logger: Logger,
        private readonly state: vscode.Memento
    ) {
        this.lastSuccessStreak = this.state.get<number>('fahh.lastSuccessStreak', 0);
        this.bossHp = this.state.get<number>('fahh.bossHp', 100);
        this.dailyFailCount = this.state.get<number>('fahh.dailyFailCount', 0);
        this.scheduleDailySummary();
    }

    /**
     * Dispose of resources and clean up timers.
     * 
     * This method should be called when the extension is deactivated to ensure
     * proper cleanup of timers, processes, and queues.
     */
    public dispose(): void {
        if (this.dailyTimer) {
            clearTimeout(this.dailyTimer);
            this.dailyTimer = null;
        }
        if (this.speakProcess) {
            this.speakProcess.kill();
            this.speakProcess = null;
        }
        this.speakQueue = [];
        this.isSpeaking = false;
    }

    /**
     * Handle configuration changes.
     * 
     * Re-evaluates daily summary scheduling when configuration changes at runtime.
     * This ensures that enabling/disabling the daily summary feature takes effect immediately.
     */
    public onConfigChanged(): void {
        // Re-evaluate daily summary scheduling when config toggles at runtime.
        if (this.dailyTimer) {
            clearTimeout(this.dailyTimer);
            this.dailyTimer = null;
        }
        this.scheduleDailySummary();
    }

    /**
     * Queue text for text-to-speech output.
     * 
     * Uses platform-specific TTS engines:
     * - macOS: `say` command
     * - Windows: PowerShell SAPI.SpVoice
     * - Linux: `espeak` command
     * 
     * Text is queued and processed sequentially to avoid overlapping speech.
     * The queue has a maximum size to prevent memory issues.
     * 
     * @param text - The text to speak (truncated to 200 characters)
     * 
     * @example
     * ```typescript
     * integrations.speak('Build failed: syntax error on line 42');
     * ```
     */
    public speak(text: string): void {
        const cfg = this.configManager.readConfig();
        if (!cfg.speakLabel) {
            return;
        }
        if (this.speakQueue.length >= MAX_SPEAK_QUEUE_SIZE) {
            this.logger.warn(`TTS queue full (${MAX_SPEAK_QUEUE_SIZE} items). Dropping speech.`);
            return;
        }
        this.speakQueue.push(text.slice(0, 200));
        this.processSpeakQueue();
    }

    /**
     * Process the TTS queue sequentially.
     * 
     * @private
     */
    private processSpeakQueue(): void {
        if (this.isSpeaking || this.speakQueue.length === 0) {
            return;
        }
        this.isSpeaking = true;
        const text = this.speakQueue.shift()!;
        const platform = process.platform;
        
        let cmd = '';
        let args: string[] = [];

        if (platform === 'darwin') {
            cmd = 'say';
            args = ['--', text];
        } else if (platform === 'win32') {
            cmd = 'powershell';
            const script = `$s = New-Object -ComObject SAPI.SpVoice; $s.Speak([System.Text.Encoding]::Unicode.GetString([System.Convert]::FromBase64String('${Buffer.from(text, 'utf16le').toString('base64')}')))`;
            args = ['-NoProfile', '-NonInteractive', '-Command', script];
        } else {
            cmd = 'espeak';
            args = ['--', text];
        }

        this.speakProcess = execFile(cmd, args, { windowsHide: true }, () => {
            this.isSpeaking = false;
            this.speakProcess = null;
            this.processSpeakQueue();
        });
    }

    /**
     * Post a webhook notification for a failure event.
     * 
     * Sends an HTTP POST request to the configured webhook URL with failure details.
     * Includes automatic retry logic with exponential backoff for transient failures.
     * 
     * @param label - The failure label/message
     * @param source - The failure source (task, terminal, diagnostics, etc.)
     * 
     * @example
     * ```typescript
     * integrations.postWebhook('Build failed: syntax error', 'task');
     * ```
     */
    public postWebhook(label: string, source: string): void {
        const cfg = this.configManager.readConfig();
        if (!cfg.webhookUrl) {
            return;
        }
        
        // Validate webhook URL
        try {
            const url = new URL(cfg.webhookUrl);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                this.logger.warn(`Invalid webhook URL protocol: ${url.protocol}. Must be http: or https:`);
                return;
            }
        } catch (e) {
            this.logger.warn(`Invalid webhook URL format: ${cfg.webhookUrl}`);
            return;
        }
        
        this.postWebhookWithRetry(label, source, 0);
    }

    /**
     * Post webhook with retry logic.
     * 
     * @param label - The failure label
     * @param source - The failure source
     * @param attempt - Current retry attempt number
     * @private
     */
    private postWebhookWithRetry(label: string, source: string, attempt: number): void {
        const cfg = this.configManager.readConfig();
        try {
            const payload = JSON.stringify({
                text: `Fahh: ${label}`,
                source,
                timestamp: new Date().toISOString(),
                workspace: 'vscode'
            });
            const url = new URL(cfg.webhookUrl);
            const isHttps = url.protocol === 'https:';
            if (!isHttps && url.protocol !== 'http:') {
                this.logger.warn(`Webhook ignored: unsupported protocol "${url.protocol}"`);
                return;
            }
            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: (url.pathname || '/') + url.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                },
                timeout: 5000 // 5 second timeout
            };
            const transport = isHttps ? https : http;
            const req = transport.request(options, (res) => {
                if (res.statusCode && res.statusCode >= 400) {
                    this.logger.warn(`Webhook returned ${res.statusCode}`);
                    if (attempt < WEBHOOK_MAX_RETRIES && res.statusCode >= 500) {
                        // Retry on server errors
                        const delay = WEBHOOK_RETRY_DELAY_MS * Math.pow(2, attempt);
                        this.logger.info(`Retrying webhook in ${delay}ms (attempt ${attempt + 1}/${WEBHOOK_MAX_RETRIES})`);
                        setTimeout(() => this.postWebhookWithRetry(label, source, attempt + 1), delay);
                    }
                }
                res.resume();
            });
            req.on('error', (e) => {
                this.logger.error('Webhook error', e);
                if (attempt < WEBHOOK_MAX_RETRIES) {
                    const delay = WEBHOOK_RETRY_DELAY_MS * Math.pow(2, attempt);
                    this.logger.info(`Retrying webhook in ${delay}ms (attempt ${attempt + 1}/${WEBHOOK_MAX_RETRIES})`);
                    setTimeout(() => this.postWebhookWithRetry(label, source, attempt + 1), delay);
                }
            });
            req.on('timeout', () => {
                req.destroy();
                this.logger.warn('Webhook request timed out');
                if (attempt < WEBHOOK_MAX_RETRIES) {
                    const delay = WEBHOOK_RETRY_DELAY_MS * Math.pow(2, attempt);
                    setTimeout(() => this.postWebhookWithRetry(label, source, attempt + 1), delay);
                }
            });
            req.write(payload);
            req.end();
        } catch (e) {
            this.logger.error('Webhook failed', e);
        }
    }

    /**
     * Get an AI-generated summary of a failure.
     * 
     * Uses the configured AI provider (Copilot or OpenRouter) to generate
     * a concise one-sentence summary of the failure.
     * 
     * **SECURITY FIX**: Respects user's AI provider configuration instead of
     * hardcoding to OpenRouter.
     * 
     * @param label - The failure label/message to summarize
     * @returns AI-generated summary, or null if AI is disabled or unavailable
     * @throws {Error} If the AI provider configuration is invalid
     * 
     * @example
     * ```typescript
     * const summary = await integrations.getAiSummary('npm ERR! code ELIFECYCLE');
     * if (summary) {
     *     console.log(`AI Summary: ${summary}`);
     * }
     * ```
     */
    public async getAiSummary(label: string): Promise<string | null> {
        try {
            const cfg = this.configManager.readConfig();
            if (!cfg.aiSummaryEnabled && !cfg.errorExplanationEnabled) {
                return null;
            }

            if (cfg.aiProvider === 'openrouter') {
                return await this.getOpenRouterSummary(label);
            } else {
                return await this.getCopilotSummary(label);
            }
        } catch (err) {
            this.logger.error('Failed to get AI summary', err);
            return null;
        }
    }

    /**
     * Get a summary using GitHub Copilot.
     * 
     * @param label - The failure label to summarize
     * @returns AI-generated summary, or null if unavailable
     * @private
     */
    private async getCopilotSummary(label: string): Promise<string | null> {
        try {
            // VS Code Language Model API (requires Copilot or compatible extension)
            const models = await vscode.lm?.selectChatModels?.({});
            if (!models || models.length === 0) {
                return null;
            }
            const model = models[0];
            const messages = [
                vscode.LanguageModelChatMessage.User(
                    `You summarize build failures concisely in one sentence. Failure: ${label}`
                )
            ];
            const tokenSource = new vscode.CancellationTokenSource();
            try {
                const response = await model.sendRequest(messages, {}, tokenSource.token);
                let text = '';
                for await (const chunk of response.text) {
                    text += chunk;
                }
                return text.trim().slice(0, 200) || null;
            } finally {
                tokenSource.dispose();
            }
        } catch (err) {
            this.logger.debug(`Copilot summary unavailable: ${err instanceof Error ? err.message : String(err)}`);
            return null;
        }
    }

    /**
     * Call OpenRouter API with a prompt.
     * 
     * **SECURITY FIX**: Uses SecretManager to retrieve API key securely instead of
     * reading from plaintext configuration or using hardcoded credentials.
     * 
     * @param prompt - The prompt to send to the AI
     * @param maxTokens - Maximum tokens in the response
     * @returns AI-generated response, or null if unavailable
     * @throws {Error} If the API call fails
     * @private
     */
    private async callOpenRouter(prompt: string, maxTokens: number): Promise<string | null> {
        try {
            // SECURITY FIX: Use SecretManager to retrieve API key securely
            const apiKey = await this.secretManager.getApiKey('openrouter');
            const cfg = this.configManager.readConfig();
            const model = cfg.openrouterModel;

            if (!apiKey) {
                this.logger.debug('OpenRouter API key is missing. Skipping AI explanation.');
                return null;
            }

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://github.com/4nur4gmishr4/vscode-fahh-Extension',
                    'X-Title': 'Fahh VS Code Extension'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: maxTokens
                })
            });

            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                this.logger.debug(`OpenRouter API error: ${response.status} ${response.statusText} — ${errText}`);
                return null;
            }

            const data = await response.json() as { choices?: { message?: { content?: string } }[] };
            const content = data.choices?.[0]?.message?.content;
            return content ? content.trim() : null;
        } catch (err) {
            this.logger.debug(`OpenRouter call failed: ${err instanceof Error ? err.message : String(err)}`);
            return null;
        }
    }

    /**
     * Get a summary using OpenRouter API.
     * 
     * @param label - The failure label to summarize
     * @returns AI-generated summary, or null if unavailable
     * @private
     */
    private async getOpenRouterSummary(label: string): Promise<string | null> {
        const result = await this.callOpenRouter(
            `Summarize this build/shell failure in one short sentence: ${label}`,
            80
        );
        return result ? result.slice(0, 200) : null;
    }

    /**
     * Get a detailed AI explanation of a failure.
     * 
     * Provides a comprehensive explanation including:
     * 1. What caused the error
     * 2. How to fix it
     * 3. Relevant tips and best practices
     * 
     * **SECURITY FIX**: Uses SecretManager for API key retrieval.
     * 
     * @param label - The failure label/message to explain
     * @returns Detailed AI-generated explanation, or null if unavailable
     * @throws {Error} If the AI provider configuration is invalid
     * 
     * @example
     * ```typescript
     * const explanation = await integrations.getAiExplanation('TypeError: Cannot read property "x" of undefined');
     * if (explanation) {
     *     console.log(explanation);
     * }
     * ```
     */
    public async getAiExplanation(label: string): Promise<string | null> {
        try {
            const prompt =
                `You are an expert developer assistant. A VS Code terminal command or build task just failed.\n\n` +
                `Error:\n${label}\n\n` +
                `Please explain:\n1. What caused this error\n2. How to fix it\n3. Any relevant tips\n\n` +
                `Be concise and practical. Use plain text, no markdown headers.`;
            return await this.callOpenRouter(prompt, 500);
        } catch (err) {
            this.logger.error('Failed to get AI explanation', err);
            return null;
        }
    }

    /**
     * Record a failure event for gamification tracking.
     * 
     * Updates daily failure count, resets success streak, and handles boss fight mode.
     * 
     * @returns Status message for boss fight mode, or null
     * @throws {Error} If state persistence fails
     * 
     * @example
     * ```typescript
     * const message = await integrations.recordFailure();
     * if (message) {
     *     console.log(message); // e.g., "⚔️ Boss HP: 90%"
     * }
     * ```
     */
    public async recordFailure(): Promise<string | null> {
        try {
            const cfg = this.configManager.readConfig();
        
        // Read latest state before modifying
        this.dailyFailCount = this.state.get<number>('fahh.dailyFailCount', 0) + 1;
        this.lastSuccessStreak = 0;
        
        await this.state.update('fahh.dailyFailCount', this.dailyFailCount);
        await this.state.update('fahh.lastSuccessStreak', this.lastSuccessStreak);

        if (cfg.bossFightMode) {
            this.bossHp = Math.max(0, this.state.get<number>('fahh.bossHp', 100) - 10);
            if (this.bossHp <= 0) {
                this.bossHp = 100;
                await this.state.update('fahh.bossHp', this.bossHp);
                return '💀 DEFEAT! Boss HP depleted. Resetting...';
            }
            await this.state.update('fahh.bossHp', this.bossHp);
            return `⚔️ Boss HP: ${this.bossHp}%`;
        }
        return null;
        } catch (err) {
            this.logger.error('Failed to record failure', err);
            return null;
        }
    }

    /**
     * Record a success event for gamification tracking.
     * 
     * Updates success streak counter and handles boss fight mode HP regeneration.
     * 
     * @returns Status message for streak milestones, or null
     * @throws {Error} If state persistence fails
     * 
     * @example
     * ```typescript
     * const message = await integrations.recordSuccess();
     * if (message) {
     *     console.log(message); // e.g., "🔥 10 successes in a row!"
     * }
     * ```
     */
    public async recordSuccess(): Promise<string | null> {
        try {
            const cfg = this.configManager.readConfig();
        
        // Read latest state before modifying
        this.lastSuccessStreak = this.state.get<number>('fahh.lastSuccessStreak', 0) + 1;
        await this.state.update('fahh.lastSuccessStreak', this.lastSuccessStreak);

        let streakMsg: string | null = null;
        if (cfg.streakCounter) {
            if (this.lastSuccessStreak >= 10 && this.lastSuccessStreak % 10 === 0) {
                streakMsg = `🔥 ${this.lastSuccessStreak} successes in a row!`;
            }
        }

        if (cfg.bossFightMode) {
            this.bossHp = this.state.get<number>('fahh.bossHp', 100);
            if (this.bossHp < 100) {
                this.bossHp = Math.min(100, this.bossHp + 5);
                await this.state.update('fahh.bossHp', this.bossHp);
            }
        }
        return streakMsg;
        } catch (err) {
            this.logger.error('Failed to record success', err);
            return null;
        }
    }

    /**
     * Get a summary of today's failures and success streak.
     * 
     * @returns Summary string with daily statistics
     * 
     * @example
     * ```typescript
     * const summary = integrations.getDailySummary();
     * console.log(summary); // "Today: 5 failures, 3 current success streak."
     * ```
     */
    public getDailySummary(): string {
        return `Today: ${this.dailyFailCount} failures, ${this.lastSuccessStreak} current success streak.`;
    }

    /**
     * Schedule the daily summary notification.
     * 
     * Schedules a timer to show the daily summary at 6:00 PM local time.
     * If the current time is past 6:00 PM, schedules for the next day.
     * 
     * @private
     */
    private scheduleDailySummary(): void {
        try {
            const cfg = this.configManager.readConfig();
            if (!cfg.dailySummary) {
                return;
            }
            if (this.dailyTimer) {
                clearTimeout(this.dailyTimer);
            }
            const now = new Date();
            const target = new Date(now);
            target.setHours(18, 0, 0, 0);
            if (target <= now) {
                target.setDate(target.getDate() + 1);
            }
            const ms = target.getTime() - now.getTime();
            this.dailyTimer = setTimeout(async () => {
                try {
                    this.logger.info(this.getDailySummary());
                    // Reset daily counter at summary time
                    this.dailyFailCount = 0;
                    await this.state.update('fahh.dailyFailCount', this.dailyFailCount);
                } catch (err) {
                    this.logger.warn(`Failed to persist daily fail count: ${err instanceof Error ? err.message : String(err)}`);
                }
                this.scheduleDailySummary();
            }, ms);
        } catch (err) {
            this.logger.error('Failed to schedule daily summary', err);
        }
    }
}
