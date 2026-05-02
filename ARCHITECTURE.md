# Fahh Architecture Documentation

## Overview

Fahh is a VS Code extension that provides audio feedback for build failures, terminal errors, and diagnostic issues. This document describes the internal architecture for developers who want to contribute or extend the extension.

## Core Principles

1. **Separation of Concerns** - Each module has a single, well-defined responsibility
2. **Async by Default** - All I/O operations use async/await
3. **Resource Management** - Proper disposal of all resources (timers, processes, listeners)
4. **Cross-Platform** - Support for Windows, macOS, Linux, and WSL
5. **Zero Dependencies** - No runtime dependencies for minimal footprint

## Module Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      extension.ts                            │
│                   (Main Orchestrator)                        │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ core/        │    │ config/      │    │ ui/          │
│              │    │              │    │              │
│ AudioPlayer  │    │ ConfigMgr    │    │ StatusBar    │
│ FailDetector │    │ SecretMgr    │    │ Welcome      │
│ SoundResolver│    │ Constants    │    │ ErrorExpl    │
└──────────────┘    └──────────────┘    └──────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ integrations/│    │ utils/       │    │ types/       │
│              │    │              │    │              │
│ Integrations │    │ Scheduler    │    │ FahhConfig   │
│ WSL          │    │ History      │    │ HistoryEntry │
│              │    │ Logger       │    │ FailureSource│
└──────────────┘    └──────────────┘    └──────────────┘
```

## Layered Architecture

Fahh follows a clean, modular architecture with clear separation of concerns:

### Core Layer (`src/core/`)
Business logic for audio playback, failure detection, and sound resolution.

- **AudioPlayer** - Cross-platform audio playback with queuing
- **FailureDetector** - Monitors VS Code events for failures
- **SoundResolver** - Determines which sound file to play

### Configuration Layer (`src/config/`)
Configuration management and secure credential storage.

- **ConfigManager** - Reads and validates extension configuration
- **SecretManager** - Secure API key storage using VS Code SecretStorage
- **Constants** - Centralized configuration keys and default values

### UI Layer (`src/ui/`)
User interface components and webviews.

- **StatusBarManager** - Status bar item with counter and flash animation
- **WelcomePanel** - Welcome screen with sound pack selector
- **ErrorExplanationManager** - AI-powered error explanation panel

### Integrations Layer (`src/integrations/`)
External service integrations and platform-specific features.

- **IntegrationsManager** - AI providers, webhooks, TTS, gamification
- **WSL** - WSL detection and path conversion

### Utils Layer (`src/utils/`)
Utility modules for logging, scheduling, and history management.

- **Logger** - Centralized logging with output channel
- **Scheduler** - Rate limiting, quiet hours, snooze
- **HistoryManager** - Failure history tracking and persistence

### Types Layer (`src/types/`)
Shared TypeScript type definitions used across all modules.

## Module Descriptions

### extension.ts (Main Entry Point)

**Responsibility:** Orchestrates all subsystems and handles the extension lifecycle.

**Key Classes:**
- `FahhExtension` - Main extension class

**Key Methods:**
- `start()` - Initializes all subsystems
- `handleFailure()` - Processes failure events
- `handleSuccess()` - Processes success events
- `registerCommands()` - Registers all VS Code commands

**Lifecycle:**
1. Extension activated on `onStartupFinished`
2. All subsystems initialized
3. Event listeners registered
4. Commands registered
5. Welcome screen shown (if first install)
6. Extension runs until VS Code closes
7. All resources disposed

### audioPlayer.ts (Audio Playback)

**Responsibility:** Cross-platform audio playback with queuing.

**Platform Implementations:**
- **Windows:** PowerShell + MCI API (winmm.dll)
- **macOS:** `afplay` command
- **Linux:** `ffplay` → `paplay` → `aplay` (fallback chain)
- **WSL:** Automatic routing to Windows host

**Key Features:**
- Queued playback (max 10 items)
- Volume control (0-100)
- Async file validation
- Process management

**Audio Flow:**
```
play() → validate file → check queue
                              │
                    ┌─────────┴─────────┐
                    │                   │
                 playing?            not playing
                    │                   │
                    ▼                   ▼
              add to queue         spawn process
                    │                   │
                    └─────────┬─────────┘
                              │
                         playback done
                              │
                         process queue
```

### config/ (Configuration Management)

**Responsibility:** Read, validate, and manage extension configuration with secure credential storage.

**Key Classes:**

1. **ConfigManager** - Configuration management
   - Reads and validates all extension settings
   - Integrates with SecretManager for API keys
   - Provides type-safe configuration access
   - **SECURITY FIX**: Reads AI provider from user config instead of hardcoding
   - **SECURITY FIX**: API keys retrieved via SecretManager, not plaintext config

2. **SecretManager** - Secure credential storage
   - Stores API keys in VS Code's encrypted SecretStorage
   - Validates API key formats before storage
   - Provider-specific validation (OpenRouter, Copilot, etc.)
   - **SECURITY**: Keys encrypted at rest, never in plaintext

3. **Constants** - Centralized configuration
   - All configuration keys in one place
   - Default values for all settings
   - Validation rules (min/max, regex patterns)
   - Eliminates magic strings throughout codebase

**Configuration Categories:**
1. Basic (enabled, volume, sounds)
2. Per-source (sounds, volumes)
3. Rate limiting (cooldown, max per minute)
4. Smart muting (quiet hours, focus, snooze)
5. AI features (provider, models) - **API keys stored securely**
6. Gamification (boss fight, streaks, daily summary)

**Validation:**
- Time format validation for quiet hours
- Volume clamping (0-100)
- Source filtering (only valid sources)
- Regex compilation for ignore patterns
- API key format validation

**Security Features:**
- API keys stored in VS Code SecretStorage (encrypted at rest)
- Automatic migration from plaintext to secure storage
- User prompts for missing API keys
- Provider-specific key validation

### failureDetector.ts (Event Detection)

**Responsibility:** Monitor VS Code events and detect failures.

**Monitored Sources:**

1. **Tasks** (`onDidEndTaskProcess`)
   - Exit code monitoring
   - Duration tracking
   - Build task identification

2. **Shell Commands** (`onDidEndTerminalShellExecution`)
   - Per-command exit codes
   - Command line capture

3. **Terminal Sessions** (`onDidCloseTerminal`)
   - Session exit status
   - Crash detection

4. **Diagnostics** (`onDidChangeDiagnostics`)
   - Error count tracking
   - Debounced (500ms)
   - Per-file monitoring

5. **Build Tasks**
   - Subset of tasks with `TaskGroup.Build`

6. **Long Tasks**
   - Tasks exceeding threshold (default 60s)

**Memory Management:**
- Task start TTL (1 hour)
- Periodic cleanup (15 minutes)
- Document close cleanup

### history.ts (History Management)

**Responsibility:** Track and persist failure history.

**Features:**
- Implements `TreeDataProvider` for VS Code tree view
- Async persistence with queue
- Configurable max entries (default 50)
- Survives VS Code restarts

**Data Structure:**
```typescript
interface HistoryEntry {
    id: string;           // Unique identifier
    timestamp: number;    // Unix timestamp
    source: string;       // Failure source
    label: string;        // Failure message
    soundPath: string;    // Sound file played
}
```

### integrations.ts (External Integrations)

**Responsibility:** Integrate with external services and features.

**Features:**

1. **AI Summaries**
   - Copilot (VS Code Language Model API)
   - OpenRouter (REST API with free models)
   - Concise one-sentence summaries

2. **AI Explanations**
   - Detailed multi-paragraph analysis
   - Cause, fix, and tips
   - Used by error explanation panel

3. **Text-to-Speech**
   - Platform-specific commands
   - Queued speech (max 5 items)
   - Base64 encoding for Windows

4. **Webhooks**
   - HTTP/HTTPS POST requests
   - Retry with exponential backoff (max 3 retries)
   - 5 second timeout

5. **Gamification**
   - Boss fight mode (HP system)
   - Success streak tracking
   - Daily summary (6 PM)

### scheduler.ts (Rate Limiting & Muting)

**Responsibility:** Control when sounds can play.

**Muting Logic:**

```
isMuted() → check enabled
                │
                ▼
           check snooze
                │
                ▼
         check quiet hours
                │
                ▼
        check window focus
                │
                ▼
        check max per minute
                │
                ▼
          check cooldown
                │
                ▼
            not muted
```

**Features:**
- Global or per-source cooldown
- Time-based quiet hours
- Window focus muting
- Temporary snooze
- Rate limiting (max per minute)

### soundResolver.ts (Sound Resolution)

**Responsibility:** Resolve which sound file to play.

**Resolution Priority:**

1. Success sound (if `successEnabled` and `isSuccess`)
2. Per-source sound (`sounds.{source}`)
3. Random sound from folder (`soundFolder`)
4. Global custom sound (`soundPath`)
5. Sound pack selection (`soundPack`)
6. Default bundled sound

**Volume Resolution:**
- Per-source volume (if >= 0)
- Global volume (fallback)

### statusBar.ts (Status Bar UI)

**Responsibility:** Manage status bar item.

**Features:**
- Enabled/disabled indicator
- Failure counter (optional)
- Flash animation (1 second red)
- Click to toggle

### welcome.ts (Welcome Screen)

**Responsibility:** Show welcome screen on first install.

**Features:**
- Sound pack selector
- Test audio button
- Visualizer animation
- Factory reset button
- CSP-protected webview

### errorExplanation.ts (Error Explanation UI)

**Responsibility:** Show AI-powered error explanations.

**Features:**
- Glassmorphic UI design
- AI explanation fetching
- Copy to clipboard
- Loading states
- Floating particle animations

**Workflow:**
1. Failure occurs → Panel created
2. User clicks "Explain"
3. Loading state shown
4. AI explanation fetched
5. Explanation displayed

### wsl.ts (WSL Support)

**Responsibility:** Detect WSL and convert paths.

**Features:**
- WSL detection caching
- Path conversion (`/mnt/c/...` → `C:\...`)
- Fallback to `wslpath` command

## Data Flow

### Failure Event Flow

```
1. VS Code Event (task end, terminal close, etc.)
        │
        ▼
2. failureDetector.ts detects failure
        │
        ▼
3. Calls onFailure handler in extension.ts
        │
        ▼
4. extension.handleFailure()
        │
        ├─→ Check if muted (scheduler.isMuted())
        ├─→ Check ignore patterns
        ├─→ Record event (scheduler.record())
        ├─→ Flash status bar (statusBar.flash())
        ├─→ Get AI summary (integrations.getAiSummary())
        ├─→ Show notification
        ├─→ Resolve sound (soundResolver.resolveForFailure())
        ├─→ Play sound (audioPlayer.play())
        ├─→ Speak label (integrations.speak())
        ├─→ Post webhook (integrations.postWebhook())
        ├─→ Update gamification (integrations.recordFailure())
        ├─→ Add to history (history.add())
        └─→ Show error explanation (errorExplanation.showFailureExplanation())
```

### Configuration Change Flow

```
1. User changes setting in VS Code
        │
        ▼
2. onDidChangeConfiguration event fires
        │
        ▼
3. extension.ts reloads config
        │
        ▼
4. All subsystems use updated config
   (via config getter function)
```

## Extension Points

### Adding a New Failure Source

1. Add source to `FailureSource` type in `config.ts`
2. Add to `VALID_SOURCES` set in `config.ts`
3. Add configuration properties in `package.json`
4. Implement detector in `failureDetector.ts`
5. Register detector in `registerFailureDetectors()`
6. Add per-source sound/volume support in `soundResolver.ts`

### Adding a New AI Provider

1. Add provider to `aiProvider` enum in `package.json`
2. Implement provider method in `integrations.ts`
3. Add configuration properties (API key, model, etc.)
4. Update `getAiSummary()` to route to new provider

### Adding a New Command

1. Add command to `contributes.commands` in `package.json`
2. Add localization to `package.nls.json`
3. Implement command handler in `extension.registerCommands()`
4. Add to `ctx.subscriptions`

## Testing Strategy

### Unit Tests
- Test each module in isolation
- Mock VS Code API
- Mock file system
- Mock child processes

### Integration Tests
- Test failure detection end-to-end
- Test audio playback
- Test configuration changes

### E2E Tests
- Test extension activation
- Test command execution
- Test webview interactions

## Performance Considerations

### Memory
- History limited to configurable max (default 50)
- Task starts cleaned up periodically (15 min)
- Diagnostic counts cleaned on document close
- Audio queue limited (max 10)
- TTS queue limited (max 5)

### CPU
- Diagnostics debounced (500ms)
- Cleanup intervals use `unref()` to not block exit
- Async I/O to avoid blocking

### Disk I/O
- Async file operations
- Queued history persistence
- Sound files read on-demand

## Security Considerations

### Input Validation
- Webhook URL validation (protocol check)
- Quiet hours time format validation
- Volume clamping (0-100)
- Regex compilation with try-catch

### Command Execution
- Platform-specific audio commands
- Base64 encoding for Windows paths
- Parameterized execution where possible

### Network Requests
- HTTPS preferred for webhooks
- 5 second timeout
- Retry with exponential backoff
- Error handling for all requests

### Data Storage
- Settings in VS Code configuration
- History in globalState (encrypted at rest)
- **API keys in SecretStorage (encrypted at rest)** ✅
- Automatic migration from plaintext to secure storage

### API Key Security
- **SecretStorage Integration**: All API keys stored using VS Code's SecretStorage API
- **Encryption at Rest**: Keys encrypted by VS Code's credential manager
- **No Plaintext Storage**: Keys never stored in configuration files
- **Automatic Migration**: Existing plaintext keys automatically migrated to secure storage
- **Format Validation**: API keys validated before storage to prevent errors
- **Provider-Specific Validation**: Different validation rules for different providers (OpenRouter, Copilot, etc.)

## Future Improvements

### High Priority
1. ~~Migrate API keys to SecretStorage~~ ✅ **COMPLETED**
2. Add comprehensive test suite (in progress - 57/61 tests passing)
3. Add telemetry (opt-in)

### Medium Priority
1. Add more sound packs
2. Add localization
3. Add analytics dashboard

### Low Priority
1. Add plugin system for custom detectors
2. Add marketplace for sound packs
3. Add team collaboration features

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow and guidelines.

## License

MIT © Anurag Mishra
