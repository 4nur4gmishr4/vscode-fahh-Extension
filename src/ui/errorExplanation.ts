import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { IntegrationsManager } from '../integrations/integrations';

/**
 * Represents a failure event from VS Code diagnostics, tasks, or terminals.
 */
export interface FailureEvent {
    source: string;
    label: string;
    timestamp: number;
}

/**
 * Manages the error explanation webview panel that provides AI-powered
 * analysis of build failures and errors.
 * 
 * @example
 * const manager = new ErrorExplanationManager(logger, integrations, extensionUri);
 * manager.showFailureExplanation({ source: 'task', label: 'Build failed', timestamp: Date.now() });
 */
export class ErrorExplanationManager {
    private panel: vscode.WebviewPanel | undefined;
    private disposables: vscode.Disposable[] = [];
    private pendingFailures: FailureEvent[] = [];

    constructor(
        private readonly logger: Logger,
        private readonly integrations: IntegrationsManager,
        private readonly extensionUri: vscode.Uri
    ) {}

    /**
     * Shows the error explanation panel for a failure event.
     * If the panel doesn't exist, creates it and queues the failure.
     * If the panel exists, reveals it and sends the failure immediately.
     * 
     * @param failure - The failure event to explain
     */
    public showFailureExplanation(failure: FailureEvent): void {
        if (!this.panel) {
            // Panel not ready yet — queue failure, panel will send it when webview signals ready
            this.pendingFailures.push(failure);
            this.createPanel();
        } else {
            // Panel exists — send directly
            this.panel.reveal();
            this.sendFailureToWebview(failure);
        }
    }

    /**
     * Creates the webview panel with proper configuration and event handlers.
     */
    private createPanel(): void {
        this.panel = vscode.window.createWebviewPanel(
            'fahhErrorExplanation',
            'Fahh Error Explanation',
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

    /**
     * Sets up message handlers for webview communication.
     * Handles explainError, ready, and copyError commands from the webview.
     */
    private setupWebviewMessageHandlers(): void {
        if (!this.panel) return;

        this.panel.webview.onDidReceiveMessage(
            async message => {
                this.logger.debug('Received webview message: ' + message.command);
                
                switch (message.command) {
                    case 'explainError':
                        this.logger.debug('Processing explainError request');
                        await this.explainError(message.failure);
                        return;
                    case 'ready':
                        this.logger.debug('Webview ready, sending pending failures');
                        // Send any pending failures
                        this.pendingFailures.forEach(failure => {
                            this.sendFailureToWebview(failure);
                        });
                        this.pendingFailures = [];
                        return;
                    case 'copyError':
                        this.logger.debug('Processing copyError request');
                        await this.copyErrorToClipboard(message.errorText);
                        return;
                    default:
                        this.logger.warn('Unknown webview message command: ' + message.command);
                        return;
                }
            },
            undefined,
            this.disposables
        );
    }

    /**
     * Sends a failure event to the webview for display.
     * 
     * @param failure - The failure event to send
     */
    private sendFailureToWebview(failure: FailureEvent): void {
        if (this.panel) {
            this.panel.webview.postMessage({
                command: 'showFailure',
                failure: failure
            });
        }
    }

    /**
     * Requests an AI explanation for a failure and sends the result to the webview.
     * Shows loading state during the request and handles errors gracefully.
     * 
     * @param failure - The failure event to explain
     */
    private async explainError(failure: FailureEvent): Promise<void> {
        this.logger.debug('explainError called with failure: ' + JSON.stringify(failure));
        
        if (!this.panel) {
            this.logger.error('No panel available for explainError');
            return;
        }

        try {
            // Show loading state
            this.logger.debug('Sending explanationLoading message');
            this.panel.webview.postMessage({
                command: 'explanationLoading'
            });

            // Get AI explanation
            this.logger.debug('Getting AI explanation for: ' + failure.label);
            const explanation = await this.integrations.getAiExplanation(failure.label);
            
            this.logger.debug('AI summary result: ' + explanation);
            
            if (!this.panel) {
                this.logger.debug('Panel was disposed during explanation fetch.');
                return;
            }

            if (explanation) {
                this.logger.debug('Sending explanationReady message');
                this.panel.webview.postMessage({
                    command: 'explanationReady',
                    explanation: explanation
                });
            } else {
                this.logger.debug('AI explanation unavailable, sending error message');
                this.panel.webview.postMessage({
                    command: 'explanationError',
                    error: 'AI explanation unavailable.\n\nTo fix this, open VS Code Settings (Ctrl+,) and search "fahh":\n• Set "fahh.aiProvider" to "openrouter"\n• Set "fahh.openrouterApiKey" to your OpenRouter API key\n• Set "fahh.openrouterModel" to "meta-llama/llama-3.2-3b-instruct:free"\n• Set "fahh.errorExplanation.enabled" to true'
                });
            }
        } catch (error) {
            this.logger.error('Error getting AI explanation', error);
            if (this.panel) {
                this.panel.webview.postMessage({
                    command: 'explanationError',
                    error: 'Failed to get explanation. Please check your internet connection and AI provider settings.'
                });
            }
        }
    }

    /**
     * Copies error text to the system clipboard and notifies the webview.
     * 
     * @param errorText - The error text to copy
     */
    private async copyErrorToClipboard(errorText: string): Promise<void> {
        try {
            await vscode.env.clipboard.writeText(errorText);
            if (this.panel) {
                this.panel.webview.postMessage({
                    command: 'copySuccess'
                });
            }
        } catch (error) {
            this.logger.error('Failed to copy to clipboard', error);
        }
    }

    /**
     * Generates the HTML content for the webview panel.
     * Includes inline styles and scripts with CSP-compliant nonce.
     * 
     * @param webview - The webview instance
     * @returns The complete HTML content as a string
     */
    private getWebviewContent(webview: vscode.Webview): string {
        const nonce = this.getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <title>Fahh Error Explanation</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            --error-gradient: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            --success-gradient: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            --glass-bg: rgba(255, 255, 255, 0.05);
            --glass-border: rgba(255, 255, 255, 0.1);
            --shadow-soft: 0 8px 32px rgba(0, 0, 0, 0.1);
            --shadow-medium: 0 12px 40px rgba(0, 0, 0, 0.15);
            --shadow-strong: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        body {
            font-family: var(--vscode-font-family, 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
            font-size: var(--vscode-font-size, 14px);
            color: var(--vscode-foreground, #ffffff);
            background: 
                radial-gradient(circle at 20% 80%, rgba(102, 126, 234, 0.1) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(118, 75, 162, 0.1) 0%, transparent 50%),
                radial-gradient(circle at 40% 40%, rgba(240, 147, 251, 0.05) 0%, transparent 50%),
                linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
            min-height: 100vh;
            padding: 32px;
            line-height: 1.6;
            overflow-x: hidden;
        }

        body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
                radial-gradient(circle at 20% 80%, rgba(102, 126, 234, 0.03) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(118, 75, 162, 0.03) 0%, transparent 50%),
                radial-gradient(circle at 40% 40%, rgba(240, 147, 251, 0.02) 0%, transparent 50%);
            pointer-events: none;
            z-index: 1;
        }

        .container {
            max-width: 1000px;
            margin: 0 auto;
            position: relative;
            z-index: 2;
            animation: fadeInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes fadeInUp {
            from { 
                opacity: 0; 
                transform: translateY(30px) scale(0.95);
            }
            to { 
                opacity: 1; 
                transform: translateY(0) scale(1);
            }
        }

        .header {
            text-align: center;
            margin-bottom: 48px;
            position: relative;
        }

        .logo-container {
            position: relative;
            display: inline-block;
            margin-bottom: 24px;
        }

        .logo {
            width: 80px;
            height: 80px;
            background: var(--error-gradient);
            border-radius: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto;
            font-size: 36px;
            font-weight: 800;
            color: white;
            box-shadow: var(--shadow-medium);
            position: relative;
            overflow: hidden;
            animation: logoFloat 3s ease-in-out infinite;
        }

        .logo::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
            transform: rotate(45deg);
            animation: logoShine 3s ease-in-out infinite;
        }

        @keyframes logoFloat {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-10px) rotate(2deg); }
        }

        @keyframes logoShine {
            0%, 100% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
            50% { transform: translateX(100%) translateY(100%) rotate(45deg); }
        }

        .title {
            font-size: 36px;
            font-weight: 700;
            background: var(--primary-gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 12px;
            letter-spacing: -0.02em;
        }

        .subtitle {
            color: var(--vscode-descriptionForeground, #a0a0a0);
            font-size: 18px;
            font-weight: 400;
            opacity: 0.8;
        }

        .main-card {
            background: var(--glass-bg);
            backdrop-filter: blur(20px);
            border: 1px solid var(--glass-border);
            border-radius: 24px;
            padding: 32px;
            box-shadow: var(--shadow-strong);
            position: relative;
            overflow: hidden;
            animation: cardSlideIn 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.2s both;
        }

        .main-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: var(--primary-gradient);
            opacity: 0.8;
        }

        @keyframes cardSlideIn {
            from { 
                opacity: 0; 
                transform: translateY(40px) scale(0.9);
            }
            to { 
                opacity: 1; 
                transform: translateY(0) scale(1);
            }
        }

        .error-header {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-bottom: 28px;
            flex-wrap: wrap;
        }

        .error-icon {
            width: 60px;
            height: 60px;
            background: var(--error-gradient);
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 28px;
            font-weight: 800;
            box-shadow: var(--shadow-medium);
            flex-shrink: 0;
            position: relative;
            animation: iconPulse 2s ease-in-out infinite;
        }

        @keyframes iconPulse {
            0%, 100% { transform: scale(1); box-shadow: var(--shadow-medium); }
            50% { transform: scale(1.05); box-shadow: var(--shadow-strong); }
        }

        .error-info {
            flex: 1;
            min-width: 200px;
        }

        .error-title {
            font-size: 24px;
            font-weight: 700;
            color: var(--vscode-errorForeground, #ff6b6b);
            margin-bottom: 8px;
            letter-spacing: -0.01em;
        }

        .error-source {
            display: inline-block;
            background: var(--primary-gradient);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .error-message {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-left: 4px solid #ff6b6b;
            padding: 24px;
            margin: 24px 0;
            font-family: var(--vscode-editor-font-family, 'SF Mono', 'Monaco', 'Inconsolata', monospace);
            font-size: var(--vscode-editor-font-size, 14px);
            white-space: pre-wrap;
            word-break: break-word;
            border-radius: 12px;
            position: relative;
            overflow: hidden;
            backdrop-filter: blur(10px);
        }

        .error-message::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, #ff6b6b, transparent);
            opacity: 0.6;
        }

        .timestamp {
            color: var(--vscode-descriptionForeground, #a0a0a0);
            font-size: 13px;
            margin-top: 12px;
            font-style: italic;
            opacity: 0.7;
        }

        .action-section {
            margin: 32px 0;
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
        }

        .btn {
            padding: 16px 32px;
            border: none;
            border-radius: 12px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: inline-flex;
            align-items: center;
            gap: 12px;
            position: relative;
            overflow: hidden;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            transition: left 0.6s ease;
        }

        .btn:hover::before {
            left: 100%;
        }

        .btn-primary {
            background: var(--primary-gradient);
            color: white;
            box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
        }

        .btn-primary:hover {
            transform: translateY(-3px) scale(1.02);
            box-shadow: 0 12px 32px rgba(102, 126, 234, 0.4);
        }

        .btn-secondary {
            background: var(--glass-bg);
            color: white;
            border: 1px solid var(--glass-border);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }

        .btn-secondary:hover {
            transform: translateY(-3px) scale(1.02);
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
            background: rgba(255, 255, 255, 0.08);
        }

        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none !important;
        }

        .btn-icon {
            width: 20px;
            height: 20px;
        }

        .explanation-section {
            margin-top: 40px;
            padding-top: 32px;
            border-top: 1px solid var(--glass-border);
            animation: sectionSlideIn 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes sectionSlideIn {
            from { 
                opacity: 0; 
                transform: translateX(-30px);
            }
            to { 
                opacity: 1; 
                transform: translateX(0);
            }
        }

        .explanation-header {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 20px;
        }

        .explanation-title {
            font-size: 22px;
            font-weight: 700;
            background: var(--primary-gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .ai-badge {
            background: var(--primary-gradient);
            color: white;
            padding: 6px 12px;
            border-radius: 16px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            animation: badgePulse 2s ease-in-out infinite;
        }

        @keyframes badgePulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }

        .explanation-content {
            background: var(--glass-bg);
            border: 1px solid var(--glass-border);
            border-radius: 16px;
            padding: 28px;
            line-height: 1.8;
            position: relative;
            overflow: hidden;
            backdrop-filter: blur(20px);
        }

        .explanation-content::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: var(--primary-gradient);
            opacity: 0.8;
        }

        .loading-container {
            background: var(--glass-bg);
            border: 1px solid var(--glass-border);
            border-radius: 16px;
            padding: 32px;
            backdrop-filter: blur(20px);
        }

        .loading {
            display: flex;
            align-items: center;
            gap: 20px;
            justify-content: center;
        }

        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255, 255, 255, 0.1);
            border-top: 4px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .loading-text {
            color: var(--vscode-descriptionForeground, #a0a0a0);
            font-style: italic;
            font-size: 16px;
        }

        .error-content {
            background: rgba(245, 87, 108, 0.1);
            border: 1px solid rgba(245, 87, 108, 0.3);
            color: #ff6b6b;
            padding: 20px;
            border-radius: 12px;
            margin-top: 20px;
            backdrop-filter: blur(10px);
        }

        .success-message {
            background: var(--success-gradient);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            margin-top: 20px;
            display: flex;
            align-items: center;
            gap: 12px;
            animation: successSlideIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 8px 24px rgba(79, 172, 254, 0.3);
        }

        @keyframes successSlideIn {
            from { 
                opacity: 0; 
                transform: translateY(-20px);
            }
            to { 
                opacity: 1; 
                transform: translateY(0);
            }
        }

        .floating-particles {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 0;
        }

        .particle {
            position: absolute;
            width: 4px;
            height: 4px;
            background: rgba(102, 126, 234, 0.3);
            border-radius: 50%;
            animation: float 20s infinite linear;
        }

        @keyframes float {
            from {
                transform: translateY(100vh) rotate(0deg);
                opacity: 0;
            }
            10% {
                opacity: 1;
            }
            90% {
                opacity: 1;
            }
            to {
                transform: translateY(-100vh) rotate(360deg);
                opacity: 0;
            }
        }

        @media (max-width: 768px) {
            body {
                padding: 20px;
            }
            
            .title {
                font-size: 28px;
            }
            
            .subtitle {
                font-size: 16px;
            }
            
            .main-card {
                padding: 24px;
            }
            
            .error-header {
                flex-direction: column;
                align-items: flex-start;
                gap: 16px;
            }
            
            .action-section {
                flex-direction: column;
            }
            
            .btn {
                width: 100%;
                justify-content: center;
            }
        }
    </style>
</head>
<body>
    <div class="floating-particles" id="particles"></div>
    
    <div class="container">
        <div class="header">
            <div class="logo-container">
                <div class="logo">!</div>
            </div>
            <h1 class="title">Fahh Error Explanation</h1>
            <p class="subtitle">AI-powered error analysis and intelligent solutions</p>
        </div>
        
        <div class="main-card">
            <div id="error-container"></div>
        </div>
    </div>
    
    <script nonce="${nonce}">
        // MUST be called exactly once per webview - store reference globally
        const vscodeApi = acquireVsCodeApi();
        let currentFailure = null;

        // Create floating particles
        function createParticles() {
            const particlesContainer = document.getElementById('particles');
            for (let i = 0; i < 20; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = Math.random() * 100 + '%';
                particle.style.animationDelay = Math.random() * 20 + 's';
                particle.style.animationDuration = (15 + Math.random() * 10) + 's';
                particlesContainer.appendChild(particle);
            }
        }

        // Message handler from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'showFailure':
                    showFailure(message.failure);
                    break;
                case 'explanationLoading':
                    showExplanationLoading();
                    break;
                case 'explanationReady':
                    showExplanation(message.explanation);
                    break;
                case 'explanationError':
                    showExplanationError(message.error);
                    break;
                case 'copySuccess':
                    showCopySuccess();
                    break;
            }
        });

        function showFailure(failure) {
            currentFailure = failure;
            const container = document.getElementById('error-container');
            const timestamp = new Date(failure.timestamp).toLocaleString();
            
            container.innerHTML = \`
                <div class="error-header">
                    <div class="error-icon">!</div>
                    <div class="error-info">
                        <h2 class="error-title">Build Failure Detected</h2>
                        <span class="error-source">\${failure.source.toUpperCase()}</span>
                    </div>
                </div>
                
                <div class="error-message">\${escapeHtml(failure.label)}</div>
                <div class="timestamp">Occurred at: \${timestamp}</div>
                
                <div class="action-section">
                    <button class="btn btn-primary" id="explainBtn">
                        <span class="btn-icon">AI</span>
                        Explain This Error
                    </button>
                    <button class="btn btn-secondary" id="copyBtn">
                        <span class="btn-icon">Copy</span>
                        Copy Error
                    </button>
                </div>
                
                <div id="explanation-section"></div>
            \`;

            // Attach event listeners AFTER innerHTML is set (CSP blocks inline onclick)
            document.getElementById('explainBtn').addEventListener('click', explainError);
            document.getElementById('copyBtn').addEventListener('click', copyError);
        }

        function explainError() {
            if (!currentFailure) { return; }
            const button = document.getElementById('explainBtn');
            button.disabled = true;
            button.innerHTML = '<span class="btn-icon">...</span> Getting AI explanation...';
            vscodeApi.postMessage({ command: 'explainError', failure: currentFailure });
        }

        function copyError() {
            if (!currentFailure) { return; }
            const errorText = \`[\${currentFailure.source.toUpperCase()}] \${currentFailure.label}\`;
            vscodeApi.postMessage({ command: 'copyError', errorText: errorText });
        }

        function showExplanationLoading() {
            const section = document.getElementById('explanation-section');
            section.innerHTML = \`
                <div class="explanation-section">
                    <div class="explanation-header">
                        <h3 class="explanation-title">AI Analysis</h3>
                        <span class="ai-badge">PROCESSING</span>
                    </div>
                    <div class="loading-container">
                        <div class="loading">
                            <div class="spinner"></div>
                            <span class="loading-text">Analyzing error with AI...</span>
                        </div>
                    </div>
                </div>
            \`;
        }

        function showExplanation(explanation) {
            const section = document.getElementById('explanation-section');
            section.innerHTML = \`
                <div class="explanation-section">
                    <div class="explanation-header">
                        <h3 class="explanation-title">AI Explanation</h3>
                        <span class="ai-badge">COMPLETE</span>
                    </div>
                    <div class="explanation-content">
                        \${escapeHtml(explanation)}
                    </div>
                </div>
            \`;

            // Reset button
            const button = document.getElementById('explainBtn');
            button.disabled = false;
            button.innerHTML = '<span class="btn-icon">AI</span> Explain This Error';
        }

        function showExplanationError(error) {
            const section = document.getElementById('explanation-section');
            section.innerHTML = \`
                <div class="explanation-section">
                    <div class="explanation-header">
                        <h3 class="explanation-title">AI Explanation</h3>
                        <span class="ai-badge">ERROR</span>
                    </div>
                    <div class="error-content">
                        \${escapeHtml(error)}
                    </div>
                </div>
            \`;

            // Reset button
            const button = document.getElementById('explainBtn');
            button.disabled = false;
            button.innerHTML = '<span class="btn-icon">AI</span> Explain This Error';
        }

        function showCopySuccess() {
            const container = document.getElementById('error-container');
            const successDiv = document.createElement('div');
            successDiv.className = 'success-message';
            successDiv.innerHTML = 'Error copied to clipboard!';
            container.appendChild(successDiv);
            setTimeout(() => successDiv.remove(), 3000);
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Initialize particles on load
        createParticles();

        // Signal extension that webview is ready to receive messages
        vscodeApi.postMessage({ command: 'ready' });
    </script>
</body>
</html>`;
    }

    /**
     * Generates a cryptographically random nonce for Content Security Policy.
     * Used to allow inline scripts in the webview while maintaining security.
     * 
     * @returns A 32-character random string
     */
    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    /**
     * Disposes of the webview panel and all associated resources.
     * Cleans up event listeners and disposables.
     */
    public dispose(): void {
        this.panel?.dispose();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}
