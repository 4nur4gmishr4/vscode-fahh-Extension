# Requirements Document: Production-Ready Refactor

## Introduction

This document specifies the requirements for refactoring the Fahh VS Code extension into a production-ready, professionally structured project. The refactor addresses critical security vulnerabilities, configuration bugs, code organization issues, and missing functionality while maintaining all existing features and improving maintainability.

## Glossary

- **Extension**: The Fahh VS Code extension that plays audio feedback for task/build/terminal failures
- **Security_Manager**: Component responsible for secure API key management
- **Config_System**: Component that reads and validates user configuration settings
- **Project_Structure**: The organization of source files into logical modules and folders
- **Build_System**: The compilation and packaging infrastructure for the extension
- **Error_Explanation_Feature**: AI-powered feature that explains build/task failures to users
- **Hardcoded_Secret**: API key or credential embedded directly in source code (security vulnerability)
- **Dependency_Manager**: System that tracks and manages npm package dependencies
- **Git_Ignore_System**: Configuration that prevents tracking of build artifacts and sensitive files

## Requirements

### Requirement 1: Remove Security Vulnerabilities

**User Story:** As a security-conscious developer, I want all hardcoded API keys removed from the codebase, so that credentials are not exposed in version control or distributed packages.

#### Acceptance Criteria

1. THE Extension SHALL NOT contain any hardcoded API keys in source files
2. WHEN the Extension reads OpenRouter API keys, THE Config_System SHALL retrieve them from user configuration only
3. THE Extension SHALL remove the hardcoded key from `config.ts` (security fix)
4. THE Extension SHALL remove the hardcoded key from `integrations.ts`
5. THE Extension SHALL use the user-configured `fahh.openrouterApiKey` setting for all API calls

### Requirement 2: Fix Configuration System Bugs

**User Story:** As a user, I want the AI provider setting to be respected, so that I can choose between Copilot and OpenRouter for error explanations.

#### Acceptance Criteria

1. WHEN a user sets `fahh.aiProvider` to "copilot", THE Config_System SHALL return "copilot" as the provider
2. WHEN a user sets `fahh.aiProvider` to "openrouter", THE Config_System SHALL return "openrouter" as the provider
3. THE Config_System SHALL NOT hardcode the `aiProvider` value to "openrouter"
4. THE Config_System SHALL read the `aiProvider` value from user configuration using `cfg.get<string>('aiProvider', 'copilot')`
5. WHEN the AI provider is "copilot", THE Extension SHALL use the Copilot API for error explanations
6. WHEN the AI provider is "openrouter", THE Extension SHALL use the OpenRouter API for error explanations

### Requirement 3: Clean Up Dependencies

**User Story:** As a maintainer, I want unused dependencies removed from package.json, so that the extension has a minimal and correct dependency footprint.

#### Acceptance Criteria

1. THE Dependency_Manager SHALL NOT include `jest-util` in package.json
2. THE Extension SHALL remove the `jest-util@30.3.0` dependency from devDependencies
3. THE Extension SHALL verify all remaining dependencies are actually used in the codebase
4. THE Extension SHALL maintain all required dependencies for testing, building, and runtime

### Requirement 4: Update Git Ignore Configuration

**User Story:** As a developer, I want build artifacts and test coverage excluded from version control, so that the repository only tracks source files.

#### Acceptance Criteria

1. THE Git_Ignore_System SHALL include `coverage/` in .gitignore
2. THE Git_Ignore_System SHALL include `*.vsix` in .gitignore
3. THE Git_Ignore_System SHALL prevent tracking of test coverage reports
4. THE Git_Ignore_System SHALL prevent tracking of packaged extension files

### Requirement 5: Remove Build Artifacts from Repository

**User Story:** As a repository maintainer, I want existing build artifacts deleted from version control, so that the repository is clean and follows best practices.

#### Acceptance Criteria

1. THE Extension SHALL delete the `fahh-2.1.0.vsix` file from the repository
2. THE Extension SHALL delete the `coverage/` folder from the repository
3. THE Extension SHALL delete the `out/` folder from the repository if it exists
4. THE Extension SHALL commit these deletions to version control

### Requirement 6: Organize Project Structure

**User Story:** As a developer, I want source files organized into logical modules, so that the codebase is easier to navigate and maintain.

#### Acceptance Criteria

1. THE Project_Structure SHALL organize source files into the following folders:
   - `src/core/` - Core business logic (audioPlayer, soundResolver, failureDetector)
   - `src/config/` - Configuration management (config.ts)
   - `src/ui/` - User interface components (statusBar, welcome, errorExplanation)
   - `src/integrations/` - External integrations (integrations.ts, wsl.ts)
   - `src/utils/` - Utility functions (logger, scheduler, history)
   - `src/types/` - TypeScript type definitions
2. THE Project_Structure SHALL maintain all import paths correctly after reorganization
3. THE Project_Structure SHALL keep extension.ts at the root of src/ as the entry point
4. THE Project_Structure SHALL update all relative imports to reflect new folder structure

### Requirement 7: Complete Error Explanation Feature

**User Story:** As a user, I want the error explanation feature to be fully functional, so that I can get AI-powered help with build failures.

#### Acceptance Criteria

1. THE Error_Explanation_Feature SHALL have a complete `getNonce()` method implementation
2. THE Error_Explanation_Feature SHALL return a valid nonce string for CSP headers
3. THE Error_Explanation_Feature SHALL not have truncated or incomplete code
4. THE Error_Explanation_Feature SHALL properly close all methods and classes

### Requirement 8: Add Centralized Constants

**User Story:** As a developer, I want configuration constants centralized, so that magic strings and numbers are defined in one place.

#### Acceptance Criteria

1. THE Extension SHALL create a `src/constants.ts` file for shared constants
2. THE Extension SHALL define default sound paths in constants
3. THE Extension SHALL define configuration keys in constants
4. THE Extension SHALL define timeout values in constants
5. THE Extension SHALL replace magic strings throughout the codebase with constant references

### Requirement 9: Improve Error Handling

**User Story:** As a user, I want consistent error handling throughout the extension, so that failures are logged and reported properly.

#### Acceptance Criteria

1. THE Extension SHALL wrap all async operations in try-catch blocks
2. THE Extension SHALL log all errors using the Logger component
3. THE Extension SHALL provide user-friendly error messages for common failure scenarios
4. THE Extension SHALL handle missing API keys gracefully with clear instructions
5. THE Extension SHALL handle network failures with appropriate retry logic or user feedback

### Requirement 10: Add Type Safety Improvements

**User Story:** As a developer, I want improved TypeScript type safety, so that type errors are caught at compile time.

#### Acceptance Criteria

1. THE Extension SHALL define explicit return types for all public methods
2. THE Extension SHALL avoid using `any` type except where absolutely necessary
3. THE Extension SHALL use strict TypeScript compiler options
4. THE Extension SHALL define interfaces for all data structures passed between components
5. THE Extension SHALL use discriminated unions for state management where appropriate

### Requirement 11: Add JSDoc Documentation

**User Story:** As a developer, I want public APIs documented with JSDoc comments, so that I can understand component interfaces without reading implementation details.

#### Acceptance Criteria

1. THE Extension SHALL add JSDoc comments to all public class methods
2. THE Extension SHALL document all function parameters with @param tags
3. THE Extension SHALL document all return values with @returns tags
4. THE Extension SHALL document all thrown exceptions with @throws tags
5. THE Extension SHALL include usage examples in JSDoc for complex APIs

### Requirement 12: Optimize Build Configuration

**User Story:** As a maintainer, I want an optimized build configuration, so that the extension compiles efficiently and produces minimal output.

#### Acceptance Criteria

1. THE Build_System SHALL use TypeScript's incremental compilation
2. THE Build_System SHALL exclude test files from production builds
3. THE Build_System SHALL minify output for production releases
4. THE Build_System SHALL generate source maps for debugging
5. THE Build_System SHALL validate all configuration files during build

### Requirement 13: Add Development Scripts

**User Story:** As a developer, I want convenient npm scripts for common tasks, so that I can build, test, and package the extension easily.

#### Acceptance Criteria

1. THE Extension SHALL provide a `npm run clean` script to remove build artifacts
2. THE Extension SHALL provide a `npm run lint:fix` script to auto-fix linting issues
3. THE Extension SHALL provide a `npm run test:watch` script for test-driven development
4. THE Extension SHALL provide a `npm run package:prod` script for production builds
5. THE Extension SHALL document all available scripts in README.md

### Requirement 14: Validate Gamification Features

**User Story:** As a user, I want gamification features to be fully implemented or clearly marked as experimental, so that I know which features are production-ready.

#### Acceptance Criteria

1. THE Extension SHALL fully implement the boss fight mode feature or mark it as experimental
2. THE Extension SHALL fully implement the streak counter feature or mark it as experimental
3. THE Extension SHALL fully implement the daily summary feature or mark it as experimental
4. THE Extension SHALL document all gamification features in README.md with their status
5. THE Extension SHALL provide configuration options to enable/disable each gamification feature

### Requirement 15: Add Logging Improvements

**User Story:** As a developer debugging issues, I want comprehensive logging throughout the extension, so that I can trace execution flow and identify problems.

#### Acceptance Criteria

1. THE Extension SHALL log all configuration changes at info level
2. THE Extension SHALL log all API calls at debug level
3. THE Extension SHALL log all file operations at debug level
4. THE Extension SHALL log all user actions at info level
5. THE Extension SHALL include timestamps and context in all log messages

### Requirement 16: Add Performance Optimizations

**User Story:** As a user, I want the extension to have minimal performance impact, so that VS Code remains responsive.

#### Acceptance Criteria

1. THE Extension SHALL debounce diagnostic change events to avoid excessive processing
2. THE Extension SHALL cache sound file paths to avoid repeated filesystem checks
3. THE Extension SHALL use lazy loading for webview panels
4. THE Extension SHALL dispose of resources properly when features are disabled
5. THE Extension SHALL limit memory usage by capping history size and cleaning up old data

### Requirement 17: Update Documentation

**User Story:** As a new user, I want comprehensive documentation, so that I can understand how to configure and use all features.

#### Acceptance Criteria

1. THE Extension SHALL update README.md to reflect new project structure
2. THE Extension SHALL document all configuration options with examples
3. THE Extension SHALL provide troubleshooting guide for common issues
4. THE Extension SHALL document the AI provider setup process
5. THE Extension SHALL include architecture diagrams showing component relationships

### Requirement 18: Add Integration Tests

**User Story:** As a maintainer, I want integration tests for critical paths, so that refactoring doesn't break core functionality.

#### Acceptance Criteria

1. THE Extension SHALL add integration tests for failure detection
2. THE Extension SHALL add integration tests for audio playback
3. THE Extension SHALL add integration tests for configuration loading
4. THE Extension SHALL add integration tests for AI error explanation
5. THE Extension SHALL achieve at least 70% code coverage for core modules

### Requirement 19: Implement Secure API Key Storage

**User Story:** As a security-conscious user, I want API keys stored securely, so that my credentials are protected.

#### Acceptance Criteria

1. THE Security_Manager SHALL use VS Code's SecretStorage API for API keys
2. THE Security_Manager SHALL migrate existing plaintext API keys to SecretStorage
3. THE Security_Manager SHALL provide a command to update stored API keys
4. THE Security_Manager SHALL never log or display API keys in plaintext
5. THE Security_Manager SHALL validate API key format before storage

### Requirement 20: Add Migration System

**User Story:** As a user upgrading from an older version, I want my settings migrated automatically, so that I don't lose my configuration.

#### Acceptance Criteria

1. THE Extension SHALL detect when a user upgrades from a version with hardcoded keys
2. THE Extension SHALL prompt users to configure their own API keys after upgrade
3. THE Extension SHALL migrate old configuration keys to new structure
4. THE Extension SHALL preserve all user customizations during migration
5. THE Extension SHALL log all migration actions for troubleshooting
