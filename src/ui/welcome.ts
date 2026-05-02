import * as vscode from 'vscode';

/**
 * Manages the welcome webview panel for first-run experience.
 * Displays extension features, sound selection, and test audio functionality.
 */
export class WelcomePanel {
    public static currentPanel: WelcomePanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    /**
     * Creates or reveals the welcome panel.
     * If a panel already exists, it will be revealed instead of creating a new one.
     * 
     * @param extensionUri - The URI of the extension root directory
     * @returns void
     */
    public static createOrShow(extensionUri: vscode.Uri): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (WelcomePanel.currentPanel) {
            WelcomePanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'fahhWelcome',
            'Welcome to Fahh!',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'resources')]
            }
        );

        WelcomePanel.currentPanel = new WelcomePanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview, extensionUri);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'test':
                        vscode.commands.executeCommand('fahh.test');
                        return;
                    case 'reset':
                        vscode.commands.executeCommand('fahh.resetSettings');
                        return;
                    case 'error':
                        vscode.window.showErrorMessage(message.text);
                        return;
                    case 'setSound':
                        if (message.sound) {
                            const soundPath = vscode.Uri.joinPath(extensionUri, 'resources', 'packs', 'default', message.sound).fsPath;
                            await vscode.workspace.getConfiguration('fahh').update('soundPath', soundPath, vscode.ConfigurationTarget.Global);
                        }
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    /**
     * Disposes of the welcome panel and cleans up resources.
     * Removes the current panel reference and disposes all event listeners.
     * 
     * @returns void
     */
    public dispose(): void {
        WelcomePanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    /**
     * Generates the HTML content for the welcome webview.
     * Includes styling, interactive elements, and CSP-compliant scripts.
     * 
     * @param webview - The webview instance to generate HTML for
     * @param extensionUri - The URI of the extension root directory
     * @returns The complete HTML string for the webview
     */
    private _getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri): string {
        const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'fahh-logo.jpeg'));
        const audioUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'packs', 'default', 'fahh.mp3'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'welcome-client.js'));
        const nonce = generateNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; media-src ${webview.cspSource}; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
    <title>Welcome to Fahh</title>
    <style>
        :root {
            --accent-color: #ffffff;
            --bg-color: #000000;
            --text-color: #ffffff;
            --secondary-bg: #1a1a1a;
            --border-color: #333333;
            --danger-color: #ff4444;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            overflow-x: hidden;
            position: relative;
        }

        .header-actions {
            position: absolute;
            top: 20px;
            right: 20px;
        }

        .btn-danger {
            background: transparent;
            color: var(--danger-color);
            border: 1px solid var(--danger-color);
            padding: 8px 16px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .btn-danger:hover {
            background: var(--danger-color);
            color: var(--bg-color);
        }

        .sound-selector {
            margin-bottom: 30px;
            text-align: center;
        }

        .selector-label {
            display: block;
            margin-bottom: 10px;
            font-size: 1rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 2px;
            opacity: 0.7;
        }

        .sound-select {
            background: var(--secondary-bg);
            color: var(--text-color);
            border: 1px solid var(--border-color);
            padding: 10px 15px;
            font-size: 1rem;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .sound-select:hover {
            border-color: var(--accent-color);
        }

        .sound-select:focus {
            outline: none;
            border-color: var(--accent-color);
            box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
        }

        .container {
            max-width: 800px;
            padding: 40px;
            text-align: center;
            animation: fadeIn 1s ease-out;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .logo-container {
            position: relative;
            margin-bottom: 30px;
        }

        .logo {
            width: 120px;
            height: 120px;
            filter: grayscale(1) brightness(2);
            animation: breathe 4s infinite ease-in-out;
        }

        @keyframes breathe {
            0%, 100% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.05); opacity: 1; }
        }

        h1 {
            font-size: 3.5rem;
            font-weight: 800;
            letter-spacing: -2px;
            margin: 0 0 10px 0;
            text-transform: uppercase;
        }

        .tagline {
            font-size: 1.1rem;
            letter-spacing: 4px;
            text-transform: uppercase;
            opacity: 0.5;
            margin-bottom: 50px;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 60px;
        }

        .card {
            background: var(--secondary-bg);
            border: 1px solid var(--border-color);
            padding: 30px 20px;
            border-radius: 4px;
            transition: all 0.3s ease;
        }

        .card:hover {
            border-color: var(--accent-color);
            transform: translateY(-5px);
        }

        .card-icon {
            font-size: 1.5rem;
            margin-bottom: 15px;
        }

        .card-title {
            font-size: 0.9rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .btn {
            background: var(--accent-color);
            color: var(--bg-color);
            border: none;
            padding: 15px 40px;
            font-size: 0.9rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            cursor: pointer;
            border-radius: 2px;
            transition: opacity 0.2s;
        }

        .btn:hover {
            opacity: 0.9;
        }

        .visualizer {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            height: 60px;
            margin-top: 40px;
        }

        .bar {
            width: 3px;
            background: var(--accent-color);
            height: 4px;
            animation: none;
        }

        .visualizer.active .bar {
            animation: barHeight 0.8s infinite ease-in-out;
        }

        @keyframes barHeight {
            0%, 100% { height: 4px; }
            50% { height: 40px; }
        }

        .bar:nth-child(1) { animation-delay: 0.1s; }
        .bar:nth-child(2) { animation-delay: 0.3s; }
        .bar:nth-child(3) { animation-delay: 0.2s; }
        .bar:nth-child(4) { animation-delay: 0.4s; }
        .bar:nth-child(5) { animation-delay: 0.15s; }
    </style>
</head>
<body>
    <div class="header-actions">
        <button id="reset-btn" class="btn-danger" type="button">Reset All Settings</button>
    </div>

    <div class="container">
        <div class="logo-container">
            <img src="${logoUri}" class="logo" alt="Fahh Logo">
        </div>
        <h1>Fahh!</h1>
        <div class="tagline">Audio error feedback</div>

        <div class="grid">
            <div class="card">
                <div class="card-icon">⚡</div>
                <div class="card-title">Zero Latency</div>
            </div>
            <div class="card">
                <div class="card-icon">🔊</div>
                <div class="card-title">Pure Audio</div>
            </div>
            <div class="card">
                <div class="card-icon">🤖</div>
                <div class="card-title">AI Insights</div>
            </div>
        </div>

        <div class="sound-selector">
            <label for="sound-select" class="selector-label">Choose Your Sound</label>
            <select id="sound-select" class="sound-select">
                <option value="fahh.mp3">Classic Fahh (Default)</option>
                <option value="fahhhard.mp3">Impact Strike</option>
                <option value="fartreverb.mp3">Reverb Blast</option>
                <option value="fahhdeep.mp3">Deep Resonance</option>
                <option value="fahhbroke.mp3">System Crash</option>
                <option value="ohshit.mp3">Quick Expletive</option>
            </select>
        </div>

        <button id="test-btn" class="btn" type="button">Test Audio Now</button>

        <div id="visualizer" class="visualizer">
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
        </div>

        <audio id="fahh-audio" src="${audioUri}" preload="auto"></audio>
    </div>

    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}

/**
 * Generates a cryptographically random nonce for Content Security Policy.
 * Used to allow specific inline scripts while maintaining CSP security.
 * 
 * @returns A 32-character random string
 */
function generateNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
