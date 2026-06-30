/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import * as vscode from 'vscode';
import { ConfigManager } from '../../shared/config/configManager';
import { SecretManager } from '../../shared/config/secretManager';
import { Logger } from '../../shared/utils/logger';
import { listProviders, getProvider } from '../../infrastructure/services/aiProviders';

/**
 * Manages the custom FaultLine Settings webview.
 * 
 * Provides a professional configuration interface with "Apply" logic
 * and unsaved changes protection.
 */
export class SettingsPanel {
    public static currentPanel: SettingsPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private readonly configManager: ConfigManager;
    private readonly secretManager: SecretManager;
    private readonly logger: Logger;
    private disposables: vscode.Disposable[] = [];
    
    private isDirty = false;
    private pendingConfig: Record<string, unknown> = {};
    private pendingSecrets: Record<string, string> = {};

    private constructor(
        panel: vscode.WebviewPanel, 
        extensionUri: vscode.Uri,
        configManager: ConfigManager,
        secretManager: SecretManager,
        logger: Logger
    ) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.configManager = configManager;
        this.secretManager = secretManager;
        this.logger = logger;

        this.update();

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        
        // Unsaved changes protection
        this.panel.webview.onDidReceiveMessage(
            async (message: { command: string; config?: Record<string, unknown>; secrets?: Record<string, string>; provider?: string; key?: string }) => {
                switch (message.command) {
                    case 'changed':
                        this.isDirty = true;
                        this.pendingConfig = { ...this.pendingConfig, ...message.config };
                        if (message.secrets) {
                            this.pendingSecrets = { ...this.pendingSecrets, ...message.secrets };
                        }
                        return;
                    case 'apply':
                        await this.applyChanges();
                        return;
                    case 'saveApiKey':
                        if (message.provider && message.key) {
                            await this.secretManager.storeApiKey(message.provider, message.key);
                            const config = vscode.workspace.getConfiguration('faultline');
                            await config.update('aiProvider', undefined, vscode.ConfigurationTarget.Workspace);
                            await config.update('aiProvider', message.provider, vscode.ConfigurationTarget.Global);
                            void vscode.window.showInformationMessage(`FaultLine: API key and AI Provider saved securely.`);
                            
                            this.isDirty = false;
                            this.pendingConfig = {};
                            this.pendingSecrets = {};
                            this.update();
                        }
                        return;
                    
                    case 'fetchModels':
                        if (message.provider) {
                            let keyToUse: string | undefined | null = message.key;
                            if (!keyToUse) {
                                keyToUse = await this.secretManager.getApiKey(message.provider);
                            }
                            if (!keyToUse) {
                                void SettingsPanel.currentPanel?.panel.webview.postMessage({ command: 'modelsFetched', error: 'No API key provided or found in storage.' });
                                return;
                            }
                            const providerObj = getProvider(message.provider);
                            if (providerObj) {
                                let models: {id: string, name: string}[] = [];
                                if (providerObj.fetchModels) {
                                    models = await providerObj.fetchModels(keyToUse);
                                }
                                if (!models || models.length === 0) {
                                    models = providerObj.info.models.map(m => ({ id: m, name: m }));
                                }
                                
                                if (models && models.length > 0) {
                                    const scoreModel = (name: string) => {
                                        const n = name.toLowerCase();
                                        if (n.includes('llama-3.3') || n.includes('llama 3.3')) return 100;
                                        if (n.includes('gemini-2.0') || n.includes('gemini 2.0')) return 95;
                                        if (n.includes('llama-3.2') || n.includes('llama 3.2')) return 90;
                                        if (n.includes('llama-3.1') || n.includes('llama 3.1')) return 85;
                                        if (n.includes('gemini-1.5') || n.includes('gemini 1.5')) return 80;
                                        if (n.includes('mixtral')) return 75;
                                        if (n.includes('qwen-2.5') || n.includes('qwen2.5')) return 70;
                                        if (n.includes('gemma-2') || n.includes('gemma2')) return 65;
                                        if (n.includes('mistral')) return 60;
                                        if (n.includes('llama')) return 50;
                                        return 0;
                                    };
                                    models.sort((a, b) => {
                                        const scoreA = scoreModel(a.name) || scoreModel(a.id);
                                        const scoreB = scoreModel(b.name) || scoreModel(b.id);
                                        if (scoreA !== scoreB) return scoreB - scoreA;
                                        return a.name.localeCompare(b.name);
                                    });
                                }
                                
                                void SettingsPanel.currentPanel?.panel.webview.postMessage({ command: 'modelsFetched', models });
                            }
                        }
                        return;
                    case 'testSound':
                        void vscode.commands.executeCommand('faultline.testSound', (message as any).sound, (message as any).volume);
                        return;
                    case 'reset':
                        this.isDirty = false;
                        this.pendingConfig = {};
                        this.pendingSecrets = {};
                        this.update();
                        return;
                }
            },
            null,
            this.disposables
        );
    }

    public static createOrShow(
        extensionUri: vscode.Uri,
        configManager: ConfigManager,
        secretManager: SecretManager,
        logger: Logger,
        targetSection?: string
    ): void {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel.panel.reveal(column);
            if (targetSection) {
                void SettingsPanel.currentPanel.panel.webview.postMessage({ command: 'scrollTo', section: targetSection });
            }
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'faultlineSettings',
            'FaultLine Settings',
            column ?? vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'resources'), vscode.Uri.joinPath(extensionUri, 'node_modules')]
            }
        );

        SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri, configManager, secretManager, logger);
        if (targetSection) {
            // Give the webview a moment to load before sending scroll message
            setTimeout(() => {
                void SettingsPanel.currentPanel?.panel.webview.postMessage({ command: 'scrollTo', section: targetSection });
            }, 500);
        }
    }

    private async applyChanges(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('faultline');
            
            // Save standard settings
            for (const [key, value] of Object.entries(this.pendingConfig)) {
                await config.update(key, undefined, vscode.ConfigurationTarget.Workspace);
                await config.update(key, value, vscode.ConfigurationTarget.Global);
            }

            // Save secrets
            for (const [provider, key] of Object.entries(this.pendingSecrets)) {
                if (key.trim()) {
                    await this.secretManager.storeApiKey(provider, key.trim());
                }
            }

            this.isDirty = false;
            this.pendingConfig = {};
            this.pendingSecrets = {};
            
            void vscode.window.showInformationMessage('FaultLine: Settings applied successfully.');
            this.update();
        } catch (err) {
            this.logger.error('Failed to apply settings', err);
            void vscode.window.showErrorMessage('FaultLine: Failed to apply settings. Check logs for details.');
        }
    }

    private update(): void {
        this.panel.webview.html = this.getHtmlForWebview();
    }

    private getHtmlForWebview(): string {
        const webview = this.panel.webview;
        const config = this.configManager.readConfig();
        const toolkitUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode', 'webview-ui-toolkit', 'dist', 'toolkit.min.js'));
        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css'));
        const nonce = this.getNonce();
        
        const providers = listProviders();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; img-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <link href="${codiconsUri.toString()}" rel="stylesheet" />
    <title>FaultLine Settings</title>
    <style>
        body {
            padding: 0;
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
        }
        .sticky-header {
            position: sticky;
            top: 0;
            background: var(--vscode-editor-background);
            padding: 10px 20px;
            border-bottom: 1px solid var(--vscode-divider);
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 100;
        }
        .content {
            padding: 20px;
            max-width: 800px;
        }
        .section {
            margin-bottom: 40px;
            scroll-margin-top: 60px;
        }
        .setting-item {
            margin-bottom: 20px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .setting-label {
            font-weight: bold;
            font-size: 13px;
        }
        .setting-description {
            font-size: 12px;
            opacity: 0.8;
            margin-bottom: 4px;
        }
        .apply-btn-container {
            display: ${this.isDirty ? 'flex' : 'none'};
            gap: 10px;
        }
        vscode-button, vscode-checkbox, vscode-text-field, vscode-dropdown, .step-card {
            cursor: pointer !important;
        }
        h2 {
            border-bottom: 1px solid var(--vscode-divider);
            padding-bottom: 8px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="sticky-header">
        <div style="display: flex; align-items: center; gap: 10px;">
            <span class="codicon codicon-settings-gear"></span>
            <span style="font-weight: bold;">Configuration</span>
        </div>
        <div id="apply-container" class="apply-btn-container">
            <vscode-button id="apply-btn" appearance="primary">Apply Changes</vscode-button>
            <vscode-button id="reset-btn" appearance="secondary">Discard</vscode-button>
        </div>
    </div>

    <div class="content">
        <div id="section-core" class="section">
            <h2>Core Engine</h2>
            <div class="setting-item">
                <vscode-checkbox id="enabled" ${config.core.enabled ? 'checked' : ''}>Enable FaultLine</vscode-checkbox>
                <div class="setting-description">Master switch for all auditory feedback and analysis. When disabled, the extension will be silent and inactive.</div>
            </div>
        </div>

        <div id="section-audio" class="section">
            <h2>Audio Configuration</h2>
            <div class="setting-item">
                <label class="setting-label">Master Volume</label>
                <div class="setting-description">Set the global volume level for all FaultLine sounds (0-100).</div>
                <vscode-text-field id="volume" type="number" min="0" max="100" value="${config.audio.volume}"></vscode-text-field>
            </div>
            <div class="setting-item">
                                <label class="setting-label">Sound Pack</label>
                <div class="setting-description">Choose the personality of your notifications.</div>
                <div style="display: flex; gap: 8px;">
                    <vscode-dropdown id="soundPack" style="flex: 1;">
                        <vscode-option value="faultline.mp3" ${config.audio.soundPack === 'faultline.mp3' ? 'selected' : ''}>Classic FaultLine</vscode-option>
                        <vscode-option value="faultlinehard.mp3" ${config.audio.soundPack === 'faultlinehard.mp3' ? 'selected' : ''}>Impact Strike</vscode-option>
                        <vscode-option value="fartreverb.mp3" ${config.audio.soundPack === 'fartreverb.mp3' ? 'selected' : ''}>Reverb Blast</vscode-option>
                        <vscode-option value="faultlinedeep.mp3" ${config.audio.soundPack === 'faultlinedeep.mp3' ? 'selected' : ''}>Deep Resonance</vscode-option>
                        <vscode-option value="faultlinebroke.mp3" ${config.audio.soundPack === 'faultlinebroke.mp3' ? 'selected' : ''}>System Crash</vscode-option>
                        <vscode-option value="ohshit.mp3" ${config.audio.soundPack === 'ohshit.mp3' ? 'selected' : ''}>Quick Expletive</vscode-option>
                    </vscode-dropdown>
                    <vscode-button id="testErrorSoundBtn" appearance="secondary"><span class="codicon codicon-play"></span> Play</vscode-button>
                </div>
            </div>
            <div class="setting-item">
                                <vscode-checkbox id="successEnabled" ${config.audio.successEnabled ? 'checked' : ''}>Success Sounds</vscode-checkbox>
                <div class="setting-description">Celebrate your victories! Plays a short tone when a build or test passes.</div>
                <div style="display: flex; gap: 8px; margin-top: 8px; align-items: center;" id="success-sound-container">
                    <label class="setting-label">Success Sound:</label>
                    <vscode-dropdown id="successSound">
                        <vscode-option value="success_ding.mp3" ${config.audio.successSound === 'success_ding.mp3' ? 'selected' : ''}>Success Ding</vscode-option>
                        <vscode-option value="success_trumphet.mp3" ${config.audio.successSound === 'success_trumphet.mp3' ? 'selected' : ''}>Success Trumpet</vscode-option>
                    </vscode-dropdown>
                    <vscode-button id="testSuccessSoundBtn" appearance="secondary"><span class="codicon codicon-play"></span> Play</vscode-button>
                </div>
            </div>
        </div>

        <div id="section-ai" class="section">
            <h2>AI Intelligence</h2>
            <div class="setting-item">
                <label class="setting-label">AI Provider</label>
                <div class="setting-description">Select which Large Language Model provider to use for error analysis.</div>
                <vscode-dropdown id="aiProvider">
                    ${providers.map(p => `<vscode-option value="${p.id}" ${config.ai.provider === p.id ? 'selected' : ''}>${p.displayName}</vscode-option>`).join('')}
                </vscode-dropdown>
            </div>
            <div class="setting-item" id="api-key-container" style="display: ${config.ai.provider === 'copilot' ? 'none' : 'flex'}">
                <label class="setting-label">API Key</label>
                <div class="setting-description">Your key will be stored securely in VS Code's encrypted SecretStorage. It is never saved to disk in plain text.</div>
                
                <div style="display: flex; gap: 8px; margin-top: 8px; align-items: center;">
                    <vscode-text-field id="apiKey" type="password" placeholder="Enter API key..." style="flex: 1;"></vscode-text-field>
                    <vscode-button id="apiKeySubmit">Save API Key</vscode-button>
                </div>
                <div id="apiKeyStatus" style="color: var(--vscode-charts-green); margin-top: 4px; font-size: 12px; height: 16px;"></div>
            </div>
            
            <div class="setting-item" id="model-container" style="display: ${config.ai.provider === 'copilot' ? 'none' : 'flex'}">
                <label class="setting-label">AI Model</label>
                <div class="setting-description">Select a model for the provider. Fetch to see available free-tier models.</div>
                <div style="display: flex; gap: 8px; margin-top: 8px; align-items: center;">
                    <vscode-dropdown id="aiModel" style="flex: 1;">
                        <vscode-option value="${config.ai.model}" selected>${config.ai.model}</vscode-option>
                    </vscode-dropdown>
                    <vscode-button id="fetchModelsBtn" appearance="secondary">Fetch Models</vscode-button>
                </div>
                <div style="font-size: 11px; opacity: 0.7; margin-top: 8px; font-style: italic;">
                    Note: FaultLine is not responsible for API downtime or model unavailability. If a model fails to respond or produces errors, please switch to another model from the dropdown.
                </div>
            </div>
            <div class="setting-item">
                <vscode-checkbox id="aiSummaryEnabled" ${config.ai.summaryEnabled ? 'checked' : ''}>Enable AI Summaries</vscode-checkbox>
                <div class="setting-description">Automatically generate a concise summary of every failure in the output log.</div>
            </div>
        </div>
    </div>

    <script type="module" nonce="${nonce}" src="${toolkitUri.toString()}"></script>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        
        function notifyChange() {
            const config = {
                enabled: document.getElementById('enabled').checked,
                volume: parseInt(document.getElementById('volume').value),
                soundPack: document.getElementById('soundPack').value,
                successSound: document.getElementById('successSound').value,
                successEnabled: document.getElementById('successEnabled').checked,
                aiProvider: document.getElementById('aiProvider').value,
                'ai.model': document.getElementById('aiModel').value,
                'aiSummary.enabled': document.getElementById('aiSummaryEnabled').checked
            };
            
            const secrets = {};
            const apiKey = document.getElementById('apiKey').value;
            if (apiKey) {
                secrets[config.aiProvider] = apiKey;
            }

            vscode.postMessage({ 
                command: 'changed', 
                config,
                secrets
            });
            document.getElementById('apply-container').style.display = 'flex';
        }

        document.getElementById('aiProvider').addEventListener('change', (e) => {
            if (e.target.value === 'copilot') {
                document.getElementById('api-key-container').style.display = 'none';
                document.getElementById('model-container').style.display = 'none';
            } else {
                document.getElementById('api-key-container').style.display = 'flex';
                document.getElementById('model-container').style.display = 'flex';
            }
            notifyChange();
        });

        document.getElementById('enabled').addEventListener('change', notifyChange);
        document.getElementById('volume').addEventListener('input', notifyChange);
        
        document.getElementById('soundPack').addEventListener('change', notifyChange);
        document.getElementById('successSound').addEventListener('change', notifyChange);
        document.getElementById('successEnabled').addEventListener('change', (e) => {
            document.getElementById('success-sound-container').style.opacity = e.target.checked ? '1' : '0.5';
            document.getElementById('success-sound-container').style.pointerEvents = e.target.checked ? 'auto' : 'none';
            notifyChange();
        });
        
        document.getElementById('testErrorSoundBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'testSound', sound: document.getElementById('soundPack').value, volume: document.getElementById('volume').value });
        });
        document.getElementById('testSuccessSoundBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'testSound', sound: document.getElementById('successSound').value, volume: document.getElementById('volume').value });
        });


        document.getElementById('apiKey').addEventListener('input', notifyChange);
        document.getElementById('aiSummaryEnabled').addEventListener('change', notifyChange);
        document.getElementById('aiModel').addEventListener('change', notifyChange);

        const fetchModelsBtn = document.getElementById('fetchModelsBtn');
        const aiModelDropdown = document.getElementById('aiModel');

        if (fetchModelsBtn) {
            fetchModelsBtn.addEventListener('click', () => {
                const provider = document.getElementById('aiProvider').value;
                const apiKey = document.getElementById('apiKey').value;
                document.getElementById('apiKeyStatus').textContent = '';
                fetchModelsBtn.textContent = 'Fetching...';
                vscode.postMessage({ command: 'fetchModels', provider, key: apiKey });
            });
        }

        document.getElementById('apiKeySubmit').addEventListener('click', () => {
            const apiKey = document.getElementById('apiKey').value;
            const provider = document.getElementById('aiProvider').value;
            if (apiKey) {
                vscode.postMessage({ command: 'saveApiKey', provider: provider, key: apiKey });
                document.getElementById('apiKeyStatus').innerText = 'Saved securely!';
                setTimeout(() => { document.getElementById('apiKeyStatus').innerText = ''; }, 3000);
            }
        });

        document.getElementById('apply-btn').addEventListener('click', () => {
            vscode.postMessage({ command: 'apply' });
        });
        
        document.getElementById('reset-btn').addEventListener('click', () => {
            vscode.postMessage({ command: 'reset' });
        });

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'scrollTo') {
                const el = document.getElementById('section-' + message.section);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth' });
                    el.style.backgroundColor = 'var(--vscode-editor-findMatchHighlightBackground)';
                    setTimeout(() => {
                        el.style.transition = 'background-color 1s ease';
                        el.style.backgroundColor = 'transparent';
                    }, 1000);
                }
            } else if (message.command === 'modelsFetched') {
                const btn = document.getElementById('fetchModelsBtn');
                if (btn) btn.textContent = 'Fetch Models';
                
                if (message.error) {
                    document.getElementById('apiKeyStatus').textContent = message.error;
                    document.getElementById('apiKeyStatus').style.color = 'var(--vscode-charts-red)';
                    return;
                }

                const dd = document.getElementById('aiModel');
                if (message.models && message.models.length > 0) {
                    dd.innerHTML = message.models.map(m => 
                        \`<vscode-option value="\${m.id}">\${m.name}</vscode-option>\`
                    ).join('');
                    document.getElementById('apiKeyStatus').textContent = 'Models fetched successfully.';
                    document.getElementById('apiKeyStatus').style.color = 'var(--vscode-charts-green)';
                    notifyChange();
                } else {
                    document.getElementById('apiKeyStatus').textContent = 'No models available or fetch failed.';
                    document.getElementById('apiKeyStatus').style.color = 'var(--vscode-charts-red)';
                }
            }
        });
    </script>
</body>
</html>`;
    }

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    public async dispose(): Promise<void> {
        if (this.isDirty) {
            const action = await vscode.window.showWarningMessage(
                'FaultLine: You have unsaved changes. Do you want to apply them before closing?',
                'Apply', 'Discard'
            );
            if (action === 'Apply') {
                await this.applyChanges();
            }
        }
        
        SettingsPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const x = this.disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
