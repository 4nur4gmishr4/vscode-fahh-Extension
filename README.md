# Fahh

> Plays a sound when things go wrong.

Fahh monitors your VS Code tasks and terminal sessions. When something exits with a non-zero code, it plays `Fahhh.mp3` so you know immediately — even if you're looking away from the screen.

## What it catches

| Source | How |
|---|---|
| Tasks (build, test, custom) | `onDidEndTaskProcess` — fires when any task process exits |
| Shell commands | `onDidEndTerminalShellExecution` — fires per command in the integrated terminal |
| Terminal crashes | `onDidCloseTerminal` — fires when a terminal session closes with a non-zero exit status |

## Setup

Install from the Marketplace or from a `.vsix` file. That's it — Fahh activates on startup and runs silently in the background until something fails.

No configuration needed. No keybindings. No commands.

## Platform notes

- **Windows** — uses `System.Windows.Media.MediaPlayer` via PowerShell (built-in, no extra installs).
- **macOS** — uses `afplay`.
- **Linux** — uses `ffplay` (install via `sudo apt install ffmpeg` or equivalent).

## Packaging & publishing

### Build the `.vsix`

```sh
npm install
npx @vscode/vsce package
```

This produces `fahh-1.0.0.vsix`. Install it locally through **Extensions → ⋯ → Install from VSIX**.

### Publish to the Marketplace

1. Create a publisher at https://marketplace.visualstudio.com/manage.
2. Update `"publisher"` in `package.json` to match your publisher ID.
3. Generate a Personal Access Token (PAT) from Azure DevOps.
4. Run:

```sh
npx @vscode/vsce login <publisher-id>
npx @vscode/vsce publish
```

## License

MIT
