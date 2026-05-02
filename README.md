# Fahh! 🔊

[![CI](https://github.com/4nur4gmishr4/vscode-fahh-Extension/actions/workflows/ci.yml/badge.svg)](https://github.com/4nur4gmishr4/vscode-fahh-Extension/actions/workflows/ci.yml)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/4nur4gmishr4.fahh)](https://marketplace.visualstudio.com/items?itemName=4nur4gmishr4.fahh)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/4nur4gmishr4.fahh)](https://marketplace.visualstudio.com/items?itemName=4nur4gmishr4.fahh&ssr=false#review-details)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Plays a sound when things go wrong (and can celebrate when they go right).

Fahh monitors your VS Code tasks, terminal sessions, tests, builds, and more. When something fails, it plays a sound so you know immediately — even if you're looking away from the screen. With 44 features and extensive customization, Fahh is the most configurable failure notification extension for VS Code.

## What it catches (6 sources)

| Source | How | Configurable |
|---|---|---|
| Tasks | `onDidEndTaskProcess` — any task that exits non-zero | ✅ |
| Shell commands | `onDidEndTerminalShellExecution` — per command | ✅ |
| Terminal crashes | `onDidCloseTerminal` — session exits non-zero | ✅ |
| Diagnostics | New lint/build errors crossing threshold | ✅ |
| Build failures | Build-group tasks specifically | ✅ |

## Quick Start

1. Install from Marketplace or `.vsix`
2. Run `Fahh: Play Test Sound` to verify audio
3. Let it run — Fahh works automatically

**Security Note**: If you're using AI features with OpenRouter, your API key is now stored securely in VS Code's encrypted secret storage, not in plaintext configuration files.

## Project Structure

Fahh follows a clean, modular architecture:

```
src/
├── core/          # Core business logic (audio, failure detection, sound resolution)
├── config/        # Configuration management and secure credential storage
├── ui/            # User interface components (status bar, welcome, error explanation)
├── integrations/  # External integrations (AI providers, webhooks, TTS)
├── utils/         # Utility modules (logging, scheduling, history)
├── types/         # Shared TypeScript type definitions
└── extension.ts   # Extension entry point
```

This structure improves maintainability, testability, and makes it easier to understand how different parts of the extension work together.

## Sound Customization Guide

### Method 1: Settings Dropdown (Easiest)
1. Open VS Code Settings (`Ctrl+,` or `Cmd+,`)
2. Search for "fahh"
3. Select your preferred sound from the **"Sound Pack"** dropdown:
   - Classic Fahh (Default)
   - Impact Strike
   - Reverb Blast
   - Deep Resonance
   - System Crash
   - Quick Expletive

### Method 2: Welcome Screen
- Appears on first install or major version update
- Use the "Choose Your Sound" dropdown to select from bundled sounds
- Selection persists across VS Code sessions

### Method 3: Command Palette
Press `Ctrl+Shift+P` (or `Cmd+Shift+P`) and use:
- `Fahh: Select Custom Sound File...` - Choose your own MP3/WAV/OGG/FLAC
- `Fahh: Select Sound Folder (Random)` - Random sounds from a folder
- `Fahh: Pick Sound Pack` - Choose from bundled sound packs
- `Fahh: Reset Sound to Default` - Back to original sound

### Method 4: Advanced Settings
For per-source customization, set different sounds for:
- `fahh.sounds.task` - Task failures
- `fahh.sounds.terminal` - Terminal failures
- `fahh.sounds.shell` - Shell command failures
- `fahh.sounds.diagnostics` - Diagnostic errors
- `fahh.sounds.build` - Build failures
- `fahh.sounds.longTask` - Long-running task failures

### Test Your Sound
After changing sounds, run `Fahh: Play Test Sound` to verify it works.

## All 14 Commands

| Command | Description |
|---|---|
| `Fahh: Play Test Sound` | Test failure sound |
| `Fahh: Play Test Success Sound` | Test success sound |
| `Fahh: Toggle Enable / Disable` | Global master switch |
| `Fahh: Toggle (This Workspace)` | Workspace-only toggle |
| `Fahh: Select Custom Sound File…` | Pick your own MP3/WAV/OGG/FLAC |
| `Fahh: Select Sound Folder (Random)` | Random sounds from folder |
| `Fahh: Reset Sound to Default` | Back to bundled fahh.mp3 |
| `Fahh: Pick Sound Pack` | Choose from bundled packs |
| `Fahh: Stop Currently Playing Sound` | Kill audio immediately |
| `Fahh: Snooze for Configured Minutes` | Temporary silence |
| `Fahh: Clear Failure History` | Wipe history |
| `Fahh: Replay Last Failure Sound` | Play last sound again |
| `Fahh: Show Failure History` | Open history view |
| `Fahh: Show Output Log` | Open output channel |

## Key Settings

### Basic
| Key | Default | Description |
|---|---|---|
| `fahh.enabled` | `true` | Master switch |
| `fahh.soundPath` | `""` | Custom sound file |
| `fahh.volume` | `100` | 0-100 (Win/Linux) |
| `fahh.sources` | `["task","shell","terminal"]` | Which events to catch |

### Per-Source Sounds & Volumes
| Key | Description |
|---|---|
| `fahh.sounds.task` | Sound for task failures |
| `fahh.sounds.shell` | Sound for shell command failures |
| `fahh.sounds.terminal` | Sound for terminal exits |
| `fahh.sounds.diagnostics` | Sound for lint errors |
| `fahh.sounds.build` | Sound for build failures |
| `fahh.sounds.longTask` | Sound for long-task completion / failure |
| `fahh.volumes.task` | Volume (-1 = use global) |
| `fahh.volumes.shell` | Volume (-1 = use global) |
| `fahh.volumes.terminal` | Volume (-1 = use global) |

### Smart Muting
| Key | Default | Description |
|---|---|---|
| `fahh.quietHours.enabled` | `false` | Enable quiet hours |
| `fahh.quietHours.from` | `"22:00"` | Start time (24h) |
| `fahh.quietHours.to` | `"08:00"` | End time (24h) |
| `fahh.muteWhenFocused` | `false` | Mute when VS Code focused |
| `fahh.snoozeMinutes` | `10` | Snooze duration |

### Rate Limiting
| Key | Default | Description |
|---|---|---|
| `fahh.cooldownMs` | `50` | Min gap between sounds (ms) |
| `fahh.cooldownPerSource` | `false` | Separate cooldowns per source |
| `fahh.maxPerMinute` | `0` | Hard cap per minute |

### Advanced Features
| Key | Default | Description |
|---|---|---|
| `fahh.successEnabled` | `false` | Play sound on success |
| `fahh.successSound` | `""` | Success sound file |
| `fahh.soundFolder` | `""` | Random sounds from folder |
| `fahh.volumeCurve` | `"linear"` | `linear` or `log` |
| `fahh.notificationLevel` | `"warning"` | `info`/`warning`/`error`/`none` |
| `fahh.diagnosticsThreshold` | `1` | Errors needed to trigger |
| `fahh.longTaskThresholdMs` | `60000` | Long task duration (ms) |
| `fahh.statusBarCounter` | `true` | Show failure count |
| `fahh.flashStatusBar` | `true` | Red flash on failure |
| `fahh.historyMax` | `50` | History entries to keep |
| `fahh.speakLabel` | `false` | TTS the failure label |
| `fahh.webhookUrl` | `""` | POST failures to URL |
| `fahh.aiSummary.enabled` | `false` | AI failure summaries |
| `fahh.aiProvider` | `"copilot"` | AI provider (`copilot` or `openrouter`) |
| `fahh.openrouterModel` | `"meta-llama/llama-3.2-3b-instruct:free"` | OpenRouter model to use |
| `fahh.dailySummary` | `false` | 6 PM daily report |
| `fahh.streakCounter` | `false` | Track success streaks |
| `fahh.bossFightMode` | `false` | Gamified HP system |
| `fahh.errorExplanation.enabled` | `true` | Enable AI error explanations |
| `fahh.errorExplanation.autoShow` | `true` | Auto-show explanations on failure |

### AI Provider Configuration

Fahh supports two AI providers for error explanations and summaries:

1. **GitHub Copilot** (default) - Uses your existing Copilot subscription, no additional setup required
2. **OpenRouter** - Free AI models, requires API key

**To use OpenRouter**:
1. Get a free API key from [openrouter.ai](https://openrouter.ai)
2. Set `fahh.aiProvider` to `"openrouter"`
3. When prompted, enter your API key (starts with `sk-or-v1-`)
4. Your key is stored securely in VS Code's encrypted secret storage

**Security**: API keys are never stored in plaintext configuration files. They are encrypted at rest using VS Code's SecretStorage API.

## Platform Notes

- **Windows** — PowerShell + Win32 `mciSendString` (winmm.dll, built-in)
- **macOS** — `afplay` (built-in)
- **Linux** — `ffplay` → `paplay` → `aplay` (ffplay requires ffmpeg)
- **WSL** — Automatically routes audio to Windows host

## Remote Development

Fahh works with Remote-SSH, Dev Containers, and WSL. Set `extensionKind` to `["ui", "workspace"]` ensures audio plays on your local machine (where the speakers are).

## Building

```bash
npm install
npm run compile      # Compile TypeScript
npm run lint         # Check for errors
npm test             # Run test suite
npm run clean        # Remove build artifacts
npm run package:prod # Build production .vsix package
```

### Development Scripts

- `npm run watch` - Watch mode for development
- `npm run test:watch` - Test-driven development
- `npm run test:coverage` - Generate coverage report
- `npm run lint:fix` - Auto-fix linting issues

## License

MIT © Anurag Mishra
