import * as vscode from 'vscode';
import * as path from 'path';
import { playAudio } from './audioPlayer';

let soundFile: string;

function onFailure(label: string): void {
    vscode.window.showWarningMessage(`${label} — playing Fahhh`);
    playAudio(soundFile);
}

export function activate(ctx: vscode.ExtensionContext): void {
    soundFile = path.join(ctx.extensionPath, 'Fahhh.mp3');

    ctx.subscriptions.push(
        vscode.tasks.onDidEndTaskProcess(e => {
            if (e.exitCode && e.exitCode !== 0) {
                onFailure(`Task "${e.execution.task.name}" failed (exit ${e.exitCode})`);
            }
        }),

        vscode.window.onDidEndTerminalShellExecution(e => {
            if (e.exitCode && e.exitCode !== 0) {
                onFailure(`Command failed (exit ${e.exitCode})`);
            }
        }),

        vscode.window.onDidCloseTerminal(t => {
            if (t.exitStatus?.code && t.exitStatus.code !== 0) {
                onFailure(`Terminal exited (code ${t.exitStatus.code})`);
            }
        })
    );
}

export function deactivate(): void { }
