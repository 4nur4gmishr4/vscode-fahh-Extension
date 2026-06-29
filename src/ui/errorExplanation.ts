/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { AIService } from '../services/aiService';
import type { FailureEvent } from '../types';

/**
 * Manages the error explanation webview panel.
 * 
 * Provides a user interface for displaying AI-generated explanations of
 * build failures and terminal errors using native VS Code styling.
 */
export class ErrorExplanationManager {
    public static readonly viewType = 'faultlineErrorExplanation';
    private panel: vscode.WebviewPanel | undefined;
    private disposables: vscode.Disposable[] = [];
    private pendingFailures: FailureEvent[] = [];

    constructor(
        private readonly logger: Logger,
        private readonly aiService: AIService,
        private readonly extensionUri: vscode.Uri
    ) {}

    public showFailureExplanation(failure: FailureEvent): void {
        if (!this.panel) {
            this.pendingFailures.push(failure);
            this.createPanel();
        } else {
            this.panel.reveal();
            this.sendFailureToWebview(failure);
        }
    }

    private createPanel(): void {
        this.panel = vscode.window.createWebviewPanel(
            ErrorExplanationManager.viewType,
            'FaultLine Error Analysis',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'resources')]
            }
        );

        this.panel.webview.html = this.getWebviewContent(this.panel.webview);
        this.setupWebviewMessageHandlers();

        this.panel.onDidDispose(() => {
            this.panel = undefined;
            this.disposables.forEach(d => d.dispose());
            this.disposables = [];
        });
    }

    private setupWebviewMessageHandlers(): void {
        if (!this.panel) return;

        this.panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'explainError':
                        await this.explainError(message.failure);
                        return;
                    case 'ready':
                        this.pendingFailures.forEach(f => this.sendFailureToWebview(f));
                        this.pendingFailures = [];
                        return;
                    case 'copyError':
                        await vscode.env.clipboard.writeText(message.errorText);
                        void vscode.window.showInformationMessage('Error copied to clipboard');
                        return;
                }
            },
            undefined,
            this.disposables
        );
    }

    private sendFailureToWebview(failure: FailureEvent): void {
        if (this.panel) {
            void this.panel.webview.postMessage({
                command: 'showFailure',
                failure: failure
            });
        }
    }

    private async explainError(failure: FailureEvent): Promise<void> {
        if (!this.panel) return;

        try {
            void this.panel.webview.postMessage({ command: 'explanationLoading' });
            const promptText = failure.output ? `Command: ${failure.label}\n\nTerminal Output:\n${failure.output}` : failure.label;
            const explanation = await this.aiService.getAiExplanation(promptText);
            
            if (this.panel) {
                if (explanation) {
                    void this.panel.webview.postMessage({
                        command: 'explanationReady',
                        explanation: explanation
                    });
                } else {
                    void this.panel.webview.postMessage({
                        command: 'explanationError',
                        error: 'AI explanation unavailable. Please check your AI provider settings.'
                    });
                }
            }
        } catch (error) {
            this.logger.error('Error getting AI explanation', error);
            if (this.panel) {
                void this.panel.webview.postMessage({
                    command: 'explanationError',
                    error: 'Failed to connect to AI provider.'
                });
            }
        }
    }

    private getWebviewContent(webview: vscode.Webview): string {
        const nonce = this.getNonce();
        const toolkitUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode', 'webview-ui-toolkit', 'dist', 'toolkit.min.js')).toString();
        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css')).toString();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; img-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <link href="${codiconsUri}" rel="stylesheet" />
    <title>FaultLine Error Analysis</title>
    <style>
        body {
            padding: 20px;
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
            line-height: 1.6;
        }
        .incident-card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 4px;
            padding: 16px;
            margin-bottom: 24px;
        }
        .error-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
            color: var(--vscode-errorForeground);
        }
        .source-badge {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .error-text {
            background: var(--vscode-textCodeBlock-background);
            padding: 12px;
            border-radius: 4px;
            font-family: var(--vscode-editor-font-family);
            white-space: pre-wrap;
            word-break: break-all;
            margin: 12px 0;
            border-left: 4px solid var(--vscode-errorForeground);
        }
        .analysis-section {
            border-top: 1px solid var(--vscode-divider);
            padding-top: 20px;
            margin-top: 20px;
        }
        .ai-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: bold;
            margin-bottom: 12px;
        }
        .explanation-text {
            color: var(--vscode-foreground);
        }
        .loading-state {
            display: flex;
            align-items: center;
            gap: 10px;
            color: var(--vscode-descriptionForeground);
        }
        vscode-button {
            cursor: pointer;
            margin-right: 8px;
        }
        .footer {
            margin-top: 40px;
            font-size: 11px;
            opacity: 0.6;
        }
    </style>
</head>
<body>
    <div id="content">
        <div class="loading-state">
            <vscode-progress-ring></vscode-progress-ring>
            <span>Waiting for failure data...</span>
        </div>
    </div>

    <script type="module" nonce="${nonce}" src="${toolkitUri}"></script>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let currentFailure = null;

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'showFailure':
                    renderFailure(message.failure);
                    break;
                case 'explanationLoading':
                    renderLoading();
                    break;
                case 'explanationReady':
                    renderExplanation(message.explanation);
                    break;
                case 'explanationError':
                    renderError(message.error);
                    break;
            }
        });

        function renderFailure(failure) {
            currentFailure = failure;
            const container = document.getElementById('content');
            container.innerHTML = \`
                <div class="incident-card" role="alert" aria-live="assertive">
                    <div class="error-header">
                        <span class="codicon codicon-error"></span>
                        <h2 style="margin:0; font-size: 1.2em;">Failure Detected</h2>
                        <span class="source-badge">\${escapeHtml(failure.source)}</span>
                    </div>
                    <div class="error-text">\${escapeHtml(failure.label)}</div>
                    <div style="font-size: 0.9em; opacity: 0.7; margin-bottom: 16px;">
                        \${new Date(failure.timestamp).toLocaleString()}
                    </div>
                    <div>
                        <vscode-button id="explainBtn" appearance="primary">
                            <span slot="start" class="codicon codicon-sparkle"></span>
                            AI Analysis
                        </vscode-button>
                        <vscode-button id="copyBtn" appearance="secondary">
                            Copy Error
                        </vscode-button>
                    </div>
                </div>
                <div id="analysis-container"></div>
            \`;

            document.getElementById('explainBtn').addEventListener('click', () => {
                vscode.postMessage({ command: 'explainError', failure: currentFailure });
            });
            document.getElementById('copyBtn').addEventListener('click', () => {
                vscode.postMessage({ command: 'copyError', errorText: failure.label });
            });
        }

        function renderLoading() {
            const container = document.getElementById('analysis-container');
            container.innerHTML = \`
                <div class="analysis-section">
                    <div class="loading-state">
                        <vscode-progress-ring></vscode-progress-ring>
                        <span>AI Assistant is analyzing the error...</span>
                    </div>
                </div>
            \`;
        }

        function renderExplanation(text) {
            const container = document.getElementById('analysis-container');
            container.innerHTML = \`
                <div class="analysis-section" role="region" aria-label="AI Analysis">
                    <div class="ai-title">
                        <span class="codicon codicon-hubot"></span>
                        AI Explanation
                    </div>
                    <div class="explanation-text">\${escapeHtml(text)}</div>
                </div>
            \`;
        }

        function renderError(err) {
            const container = document.getElementById('analysis-container');
            container.innerHTML = \`
                <div class="analysis-section">
                    <div style="color: var(--vscode-errorForeground);">
                        <span class="codicon codicon-warning"></span> \${escapeHtml(err)}
                    </div>
                </div>
            \`;
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        vscode.postMessage({ command: 'ready' });
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

    public dispose(): void {
        this.panel?.dispose();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}
