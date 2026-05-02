# Implementation Plan: Production-Ready Refactor

## Overview

This implementation plan refactors the Fahh VS Code extension to address critical security vulnerabilities (hardcoded API keys), configuration bugs (ignored user settings), code organization issues (flat file structure), and missing functionality (incomplete error explanation feature). The refactor maintains backward compatibility while improving maintainability, security, and code quality.

**Key Changes:**
- Remove hardcoded API keys and implement secure credential storage
- Fix configuration system to respect user AI provider settings
- Reorganize flat file structure into logical modules (core, config, ui, integrations, utils, types)
- Complete incomplete features (error explanation getNonce method)
- Add centralized constants and type definitions
- Improve documentation, error handling, and testing infrastructure

## Tasks

- [x] 1. Prepare repository and clean up artifacts
  - Remove build artifacts from version control (fahh-2.1.0.vsix, coverage/, out/)
  - Update .gitignore to exclude coverage/ and *.vsix
  - Remove unused dependency jest-util from package.json
  - Commit cleanup changes
  - _Requirements: 1.3, 1.4, 1.5_

- [ ] 2. Create new project structure and shared infrastructure
  - [x] 2.1 Create new folder structure
    - Create src/core/, src/config/, src/ui/, src/integrations/, src/utils/, src/types/ directories
    - _Requirements: 1.6_

  - [x] 2.2 Create centralized constants module
    - Create src/config/constants.ts with extension metadata, config keys, timeouts, and default values
    - Export CONSTANTS object with all magic strings and numbers
    - _Requirements: 1.8_

  - [x] 2.3 Create shared type definitions
    - Create src/types/index.ts with FahhConfig, HistoryEntry, and other shared interfaces
    - Export all types for use across modules
    - _Requirements: 1.10_

- [ ] 3. Implement secure API key storage
  - [x] 3.1 Create SecretManager class
    - Create src/config/secretManager.ts implementing ISecretManager interface
    - Implement storeApiKey, getApiKey, deleteApiKey, hasApiKey methods using VS Code SecretStorage API
    - Add API key format validation
    - Add JSDoc documentation
    - _Requirements: 1.1, 1.19_

  - [ ]* 3.2 Write unit tests for SecretManager
    - Test API key storage and retrieval
    - Test validation logic
    - Test error handling
    - _Requirements: 1.18_

- [ ] 4. Refactor configuration management
  - [x] 4.1 Create ConfigManager class
    - Create src/config/configManager.ts (renamed from config.ts)
    - Remove hardcoded OpenRouter API key (security fix)
    - Fix aiProvider to read from user config: `cfg.get<string>('aiProvider', 'copilot')` instead of hardcoding "openrouter"
    - Integrate SecretManager for API key retrieval
    - Use CONSTANTS for all configuration keys
    - Add getAiApiKey() method that retrieves from SecretManager
    - Add JSDoc documentation with @param, @returns, @throws tags
    - _Requirements: 1.1, 1.2, 1.8, 1.11_

  - [ ]* 4.2 Write unit tests for ConfigManager
    - Test configuration reading and validation
    - Test AI provider selection respects user settings
    - Test SecretManager integration
    - _Requirements: 1.18_

- [x] 5. Checkpoint - Verify configuration system
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Reorganize core business logic
  - [x] 6.1 Move AudioPlayer to core layer
    - Move src/audioPlayer.ts to src/core/audioPlayer.ts
    - Update import paths to use ../utils/logger
    - Add explicit return types to all public methods
    - Add JSDoc documentation
    - _Requirements: 1.6, 1.10, 1.11_

  - [x] 6.2 Move SoundResolver to core layer
    - Move src/soundResolver.ts to src/core/soundResolver.ts
    - Update imports to use ../config/configManager and ../utils/logger
    - Replace magic strings with CONSTANTS references
    - Add explicit return types
    - Add JSDoc documentation
    - _Requirements: 1.6, 1.8, 1.10, 1.11_

  - [x] 6.3 Move FailureDetector to core layer
    - Move src/failureDetector.ts to src/core/failureDetector.ts
    - Update imports to use ../config/configManager and ../utils/logger
    - Add explicit return types
    - Add JSDoc documentation
    - _Requirements: 1.6, 1.10, 1.11_

  - [ ]* 6.4 Write integration tests for core layer
    - Test failure detection for tasks, terminals, diagnostics
    - Test audio playback on different platforms
    - Test sound resolution logic
    - _Requirements: 1.18_

- [ ] 7. Reorganize UI components
  - [x] 7.1 Move StatusBarManager to ui layer
    - Move src/statusBar.ts to src/ui/statusBar.ts
    - Update imports to use ../config/configManager and ../utils/logger
    - Add explicit return types
    - Add JSDoc documentation
    - _Requirements: 1.6, 1.10, 1.11_

  - [x] 7.2 Move WelcomePanel to ui layer
    - Move src/welcome.ts to src/ui/welcome.ts
    - Update imports to use ../utils/logger
    - Add explicit return types
    - Add JSDoc documentation
    - _Requirements: 1.6, 1.10, 1.11_

  - [x] 7.3 Complete and move ErrorExplanationManager to ui layer
    - Move src/errorExplanation.ts to src/ui/errorExplanation.ts
    - Complete the truncated getNonce() method implementation
    - Update imports to use ../integrations/integrations and ../utils/logger
    - Add explicit return types
    - Add JSDoc documentation
    - _Requirements: 1.6, 1.7, 1.10, 1.11_

- [ ] 8. Reorganize integrations layer
  - [x] 8.1 Move IntegrationsManager to integrations layer
    - Move src/integrations.ts to src/integrations/integrations.ts
    - Remove hardcoded OpenRouter API key
    - Update to use SecretManager for API key retrieval
    - Fix AI provider selection to respect user config (use ConfigManager.getAiApiKey())
    - Update imports to use ../config/configManager, ../config/secretManager, ../utils/logger
    - Add explicit return types
    - Add JSDoc documentation
    - Wrap all async operations in try-catch blocks
    - _Requirements: 1.1, 1.2, 1.6, 1.9, 1.10, 1.11_

  - [x] 8.2 Move WSL support to integrations layer
    - Move src/wsl.ts to src/integrations/wsl.ts
    - Add explicit return types
    - Add JSDoc documentation
    - _Requirements: 1.6, 1.10, 1.11_

  - [ ]* 8.3 Write integration tests for AI features
    - Test AI error explanation with Copilot provider
    - Test AI error explanation with OpenRouter provider
    - Test provider selection respects user settings
    - _Requirements: 1.18_

- [~] 9. Checkpoint - Verify integrations and UI
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Reorganize utility layer
  - [x] 10.1 Move Logger to utils layer
    - Move src/logger.ts to src/utils/logger.ts
    - Add explicit return types
    - Add JSDoc documentation
    - Add timestamps and context to all log messages
    - _Requirements: 1.6, 1.10, 1.11, 1.15_

  - [x] 10.2 Move Scheduler to utils layer
    - Move src/scheduler.ts to src/utils/scheduler.ts
    - Update imports to use ../config/configManager and logger
    - Add explicit return types
    - Add JSDoc documentation
    - _Requirements: 1.6, 1.10, 1.11_

  - [x] 10.3 Move HistoryManager to utils layer
    - Move src/history.ts to src/utils/history.ts
    - Update imports to use ../config/configManager and logger
    - Add explicit return types
    - Add JSDoc documentation
    - _Requirements: 1.6, 1.10, 1.11_

- [ ] 11. Update extension entry point
  - [x] 11.1 Update extension.ts imports
    - Update all imports to reflect new folder structure
    - Import from ./core/, ./config/, ./ui/, ./integrations/, ./utils/
    - Update ConfigManager import (renamed from config)
    - Add explicit return types to activate() and deactivate()
    - Add JSDoc documentation
    - _Requirements: 1.6, 1.10, 1.11_

  - [~] 11.2 Add API key migration logic
    - Detect users upgrading from versions with hardcoded keys
    - Prompt users to configure their own OpenRouter API key if using openrouter provider
    - Migrate plaintext API keys from settings to SecretStorage
    - Log all migration actions
    - _Requirements: 1.20_

- [ ] 12. Improve error handling and logging
  - [~] 12.1 Add comprehensive error handling
    - Wrap all async operations in try-catch blocks across all modules
    - Add user-friendly error messages for missing API keys
    - Add network failure handling with retry logic or user feedback
    - Log all errors using Logger component
    - _Requirements: 1.9, 1.15_

  - [~] 12.2 Enhance logging throughout extension
    - Log configuration changes at info level
    - Log API calls at debug level
    - Log file operations at debug level
    - Log user actions at info level
    - _Requirements: 1.15_

- [ ] 13. Add performance optimizations
  - [~] 13.1 Optimize file operations
    - Cache sound file paths to avoid repeated filesystem checks
    - Use lazy loading for webview panels
    - Dispose resources properly when features are disabled
    - _Requirements: 1.16_

  - [~] 13.2 Optimize event handling
    - Ensure diagnostic change events are properly debounced
    - Limit memory usage by capping history size
    - Clean up old data periodically
    - _Requirements: 1.16_

- [ ] 14. Update build configuration and scripts
  - [~] 14.1 Optimize TypeScript configuration
    - Enable incremental compilation in tsconfig.json
    - Exclude test files from production builds
    - Generate source maps for debugging
    - Use strict TypeScript compiler options
    - _Requirements: 1.10, 1.12_

  - [~] 14.2 Add development npm scripts
    - Add "clean" script to remove build artifacts
    - Add "lint:fix" script for auto-fixing linting issues
    - Add "test:watch" script for test-driven development
    - Add "package:prod" script for production builds
    - _Requirements: 1.13_

- [~] 15. Checkpoint - Verify build system
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Update documentation
  - [~] 16.1 Update README.md
    - Document new project structure
    - Document all configuration options with examples
    - Add troubleshooting guide for common issues
    - Document AI provider setup process (Copilot vs OpenRouter)
    - Document all npm scripts
    - Add security note about API key storage
    - _Requirements: 1.13, 1.17_

  - [~] 16.2 Update ARCHITECTURE.md
    - Add architecture diagrams showing component relationships
    - Document layered architecture (core, config, ui, integrations, utils)
    - Document data flow for failure detection and audio playback
    - Document SecretManager and ConfigManager integration
    - _Requirements: 1.17_

  - [~] 16.3 Document gamification features
    - Document boss fight mode feature status
    - Document streak counter feature status
    - Document daily summary feature status
    - Mark experimental features clearly
    - _Requirements: 1.14_

- [ ] 17. Add testing infrastructure
  - [ ]* 17.1 Set up test coverage reporting
    - Configure Jest for coverage reporting
    - Add coverage thresholds (70% for core modules)
    - Add coverage badge to README
    - _Requirements: 1.18_

  - [ ]* 17.2 Write integration tests for critical paths
    - Test complete failure detection flow
    - Test configuration loading and validation
    - Test audio playback end-to-end
    - Test AI error explanation flow
    - _Requirements: 1.18_

- [ ] 18. Final verification and cleanup
  - [~] 18.1 Verify all imports and paths
    - Run TypeScript compiler to check for errors
    - Verify all relative imports are correct
    - Test extension activation in VS Code
    - _Requirements: 1.6_

  - [~] 18.2 Run full test suite
    - Run all unit tests
    - Run all integration tests
    - Verify test coverage meets targets
    - _Requirements: 1.18_

  - [~] 18.3 Manual testing checklist
    - Test failure detection for tasks, terminals, diagnostics
    - Test audio playback on current platform
    - Test AI error explanation with both providers
    - Test configuration changes are respected
    - Test API key storage and retrieval
    - Test welcome screen and status bar
    - _Requirements: 1.1, 1.2, 1.7, 1.19_

- [~] 19. Final checkpoint - Production readiness
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- The refactor maintains backward compatibility with all existing features
- Security fixes (removing hardcoded API keys) are critical and must be completed
- Configuration bug fixes (respecting AI provider setting) are critical and must be completed
- File reorganization improves maintainability but can be done incrementally
- Testing tasks are optional but highly recommended for production readiness
