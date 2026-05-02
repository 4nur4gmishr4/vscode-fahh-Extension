# Changelog

All notable changes to the Fahh extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.2] - 2024-12-XX

### Security
- **CRITICAL**: Removed hardcoded OpenRouter API key from source code
- Implemented secure API key storage using VS Code SecretStorage (encrypted at rest)
- Added automatic migration from plaintext configuration to secure storage
- Added API key format validation before storage
- Added provider-specific validation (OpenRouter, Copilot)

### Fixed
- Fixed AI provider configuration bug (was hardcoded to "openrouter", now respects user settings)
- Fixed truncated `getNonce()` method in errorExplanation.ts
- Fixed all import paths after code reorganization
- Fixed TypeScript compilation warnings for unused parameters

### Added
- New `SecretManager` class for secure credential storage
- Centralized constants module (`src/config/constants.ts`)
- Shared type definitions module (`src/types/index.ts`)
- API key migration logic with user prompts
- Comprehensive JSDoc documentation for all classes and methods
- Explicit return types for all public methods
- New npm scripts: `clean`, `lint:fix`, `prebuild`, `build`, `package:prod`

### Changed
- **Major refactor**: Reorganized flat file structure into modular architecture
  - `src/core/` - Business logic (audio, failure detection, sound resolution)
  - `src/config/` - Configuration and secure credential storage
  - `src/ui/` - User interface components
  - `src/integrations/` - External service integrations
  - `src/utils/` - Utility modules
  - `src/types/` - Shared type definitions
- Optimized TypeScript configuration with incremental compilation
- Enhanced build configuration for faster rebuilds
- Updated README.md with project structure and security notes
- Updated ARCHITECTURE.md with layered architecture documentation

### Improved
- Better code organization and maintainability
- Improved type safety across all modules
- Enhanced error handling with try-catch blocks
- Better logging throughout extension
- Cleaner separation of concerns

## [2.1.1] - 2024-XX-XX

### Fixed
- Fixed truncated `getNonce()` method in errorExplanation.ts
- Fixed memory leak in audio player queue (added max size limit of 10)
- Fixed memory leak in TTS queue (added max size limit of 5)
- Fixed synchronous file operations (migrated to async fs.promises)
- Fixed unbounded webhook retries (added exponential backoff with max 3 retries)
- Fixed missing validation for quiet hours time format
- Fixed missing validation for webhook URLs

### Added
- Added JSDoc comments to public API methods
- Added constants for magic numbers (cleanup intervals, debounce times)
- Added webhook retry logic with exponential backoff
- Added timeout handling for webhook requests (5 second timeout)
- Added multi-platform CI testing (Windows, Linux, macOS)
- Added security audit to CI pipeline
- Added proper CHANGELOG.md

### Improved
- Improved error handling consistency across modules
- Improved webhook error messages with retry information
- Improved configuration validation with warnings for invalid formats
- Improved CI/CD pipeline with linting and security checks

### Security
- Added webhook URL protocol validation (http/https only)
- Added proper error handling for malformed URLs
- Added timeout protection for webhook requests

## [2.1.0] - 2024-XX-XX

### Added
- AI-powered error explanations with beautiful UI
- Support for OpenRouter API with free AI models
- Error explanation panel with glassmorphic design
- Boss fight mode for gamified failure tracking
- Success streak counter
- Daily summary feature (6 PM report)
- Configurable daily summary time
- Auto-show error explanations on failure

### Changed
- Improved AI integration architecture
- Enhanced error explanation UI with animations
- Better handling of AI provider failures

## [2.0.0] - 2024-XX-XX

### Added
- Complete rewrite in TypeScript
- Support for 6 failure sources (task, shell, terminal, diagnostics, build, longTask)
- Per-source sound and volume configuration
- Sound pack system with 6 bundled sounds
- Random sound folder support
- Success sounds (optional)
- Quiet hours with time-based muting
- Rate limiting (cooldown, max per minute)
- Status bar with failure counter and flash animation
- Failure history with tree view
- Webhook integration
- Text-to-speech support (macOS, Windows, Linux)
- WSL support with automatic path conversion
- Welcome screen with sound selector
- 17 commands for full control
- Extensive configuration (44+ settings)

### Changed
- Migrated from JavaScript to TypeScript
- Improved audio playback reliability
- Better cross-platform support
- Enhanced error handling

## [1.0.0] - 2023-XX-XX

### Added
- Initial release
- Basic audio playback on task failure
- Windows, macOS, and Linux support
- Simple configuration options
