import * as vscode from 'vscode';
import { ConfigManager } from './configManager';

// Mock VS Code API
jest.mock('vscode', () => ({
    workspace: {
        getConfiguration: jest.fn()
    },
    ConfigurationTarget: {
        Global: 1,
        Workspace: 2,
        WorkspaceFolder: 3
    }
}));

describe('ConfigManager', () => {
    let mockSecretStorage: jest.Mocked<vscode.SecretStorage>;
    let mockConfiguration: any;
    let configManager: ConfigManager;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Mock SecretStorage
        mockSecretStorage = {
            get: jest.fn(),
            store: jest.fn(),
            delete: jest.fn(),
            onDidChange: jest.fn()
        } as any;

        // Mock workspace configuration
        mockConfiguration = {
            get: jest.fn((key: string, defaultValue?: any) => {
                // Return defaults for most keys
                const defaults: Record<string, any> = {
                    'enabled': true,
                    'soundPack': 'fahh.mp3',
                    'soundPath': '',
                    'soundFolder': '',
                    'volume': 100,
                    'volumeCurve': 'linear',
                    'sources': ['task', 'shell', 'terminal'],
                    'cooldownMs': 50,
                    'maxPerMinute': 0,
                    'aiProvider': 'copilot',
                    'openrouterModel': 'meta-llama/llama-3.2-3b-instruct:free',
                    'logLevel': 'warn',
                    'historyMax': 50,
                    'ignorePatterns': [],
                    'quietHours.enabled': false,
                    'quietHours.from': '22:00',
                    'quietHours.to': '08:00',
                    'showNotification': true,
                    'notificationLevel': 'warning',
                    'cooldownPerSource': false,
                    'showStatusBar': true,
                    'statusBarCounter': true,
                    'flashStatusBar': true,
                    'muteWhenFocused': false,
                    'snoozeMinutes': 10,
                    'diagnosticsThreshold': 1,
                    'longTaskThresholdMs': 60000,
                    'speakLabel': false,
                    'webhookUrl': '',
                    'aiSummary.enabled': false,
                    'dailySummary': false,
                    'streakCounter': false,
                    'bossFightMode': false,
                    'errorExplanation.enabled': true,
                    'errorExplanation.autoShow': true,
                    'successEnabled': false,
                    'successSound': ''
                };

                // Handle per-source sounds and volumes
                if (key.startsWith('sounds.') || key.startsWith('volumes.')) {
                    return defaultValue;
                }

                return defaults[key] ?? defaultValue;
            }),
            update: jest.fn(),
            inspect: jest.fn()
        };

        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfiguration);

        // Create ConfigManager instance
        configManager = new ConfigManager(mockSecretStorage);
    });

    describe('readConfig', () => {
        it('should read configuration with default values', () => {
            const config = configManager.readConfig();

            expect(config.enabled).toBe(true);
            expect(config.soundPack).toBe('fahh.mp3');
            expect(config.volume).toBe(100);
            expect(config.aiProvider).toBe('copilot');
            expect(config.logLevel).toBe('warn');
        });

        it('should read aiProvider from user config instead of hardcoding', () => {
            // Mock user setting aiProvider to 'openrouter'
            mockConfiguration.get.mockImplementation((key: string, defaultValue?: any) => {
                if (key === 'aiProvider') {
                    return 'openrouter';
                }
                return defaultValue;
            });

            const config = configManager.readConfig();

            expect(config.aiProvider).toBe('openrouter');
            expect(mockConfiguration.get).toHaveBeenCalledWith('aiProvider', 'copilot');
        });

        it('should NOT return hardcoded API key in openrouterApiKey field', () => {
            const config = configManager.readConfig();

            // SECURITY FIX: openrouterApiKey should always be empty string
            // API keys must be retrieved via getAiApiKey()
            expect(config.openrouterApiKey).toBe('');
        });

        it('should validate and clamp volume to valid range', () => {
            mockConfiguration.get.mockImplementation((key: string, defaultValue?: any) => {
                if (key === 'volume') {
                    return 150; // Invalid: exceeds max of 100
                }
                return defaultValue;
            });

            const config = configManager.readConfig();

            expect(config.volume).toBe(100); // Clamped to max
        });

        it('should validate quiet hours time format', () => {
            mockConfiguration.get.mockImplementation((key: string, defaultValue?: any) => {
                if (key === 'quietHours.from') {
                    return '25:00'; // Invalid time
                }
                if (key === 'quietHours.to') {
                    return 'invalid'; // Invalid format
                }
                return defaultValue;
            });

            const config = configManager.readConfig();

            // Should fall back to defaults for invalid times
            expect(config.quietHours.from).toBe('22:00');
            expect(config.quietHours.to).toBe('08:00');
        });

        it('should filter invalid failure sources', () => {
            mockConfiguration.get.mockImplementation((key: string, defaultValue?: any) => {
                if (key === 'sources') {
                    return ['task', 'invalid-source', 'shell'];
                }
                return defaultValue;
            });

            const config = configManager.readConfig();

            expect(config.sources.has('task')).toBe(true);
            expect(config.sources.has('shell')).toBe(true);
            expect(config.sources.has('invalid-source' as any)).toBe(false);
        });

        it('should compile valid regex patterns and skip invalid ones', () => {
            mockConfiguration.get.mockImplementation((key: string, defaultValue?: any) => {
                if (key === 'ignorePatterns') {
                    return ['valid.*pattern', '[invalid(regex'];
                }
                return defaultValue;
            });

            const config = configManager.readConfig();

            expect(config.ignorePatterns).toHaveLength(1);
            expect(config.ignorePatterns[0].test('valid-pattern')).toBe(true);
        });
    });

    describe('getAiApiKey', () => {
        it('should retrieve OpenRouter API key from SecretManager', async () => {
            mockConfiguration.get.mockImplementation((key: string, defaultValue?: any) => {
                if (key === 'aiProvider') {
                    return 'openrouter';
                }
                return defaultValue;
            });

            mockSecretStorage.get.mockResolvedValue('sk-or-v1-test-key');

            const apiKey = await configManager.getAiApiKey();

            expect(apiKey).toBe('sk-or-v1-test-key');
            expect(mockSecretStorage.get).toHaveBeenCalledWith('fahh.apiKey.openrouter');
        });

        it('should return null for Copilot provider (no API key needed)', async () => {
            mockConfiguration.get.mockImplementation((key: string, defaultValue?: any) => {
                if (key === 'aiProvider') {
                    return 'copilot';
                }
                return defaultValue;
            });

            const apiKey = await configManager.getAiApiKey();

            expect(apiKey).toBeNull();
            expect(mockSecretStorage.get).not.toHaveBeenCalled();
        });

        it('should throw error for unsupported AI provider', async () => {
            mockConfiguration.get.mockImplementation((key: string, defaultValue?: any) => {
                if (key === 'aiProvider') {
                    return 'unsupported-provider';
                }
                return defaultValue;
            });

            await expect(configManager.getAiApiKey()).rejects.toThrow('Unsupported AI provider: unsupported-provider');
        });

        it('should return null when OpenRouter API key is not configured', async () => {
            mockConfiguration.get.mockImplementation((key: string, defaultValue?: any) => {
                if (key === 'aiProvider') {
                    return 'openrouter';
                }
                return defaultValue;
            });

            mockSecretStorage.get.mockResolvedValue(undefined);

            const apiKey = await configManager.getAiApiKey();

            expect(apiKey).toBeNull();
        });
    });

    describe('updateEnabled', () => {
        it('should update enabled state globally by default', async () => {
            await configManager.updateEnabled(false);

            expect(mockConfiguration.update).toHaveBeenCalledWith(
                'enabled',
                false,
                vscode.ConfigurationTarget.Global
            );
        });

        it('should update enabled state at specified target', async () => {
            await configManager.updateEnabled(true, vscode.ConfigurationTarget.Workspace);

            expect(mockConfiguration.update).toHaveBeenCalledWith(
                'enabled',
                true,
                vscode.ConfigurationTarget.Workspace
            );
        });
    });

    describe('updateSoundPath', () => {
        it('should update sound path globally', async () => {
            await configManager.updateSoundPath('/path/to/sound.mp3');

            expect(mockConfiguration.update).toHaveBeenCalledWith(
                'soundPath',
                '/path/to/sound.mp3',
                vscode.ConfigurationTarget.Global
            );
        });
    });

    describe('updateSoundFolder', () => {
        it('should update sound folder globally', async () => {
            await configManager.updateSoundFolder('/path/to/sounds/');

            expect(mockConfiguration.update).toHaveBeenCalledWith(
                'soundFolder',
                '/path/to/sounds/',
                vscode.ConfigurationTarget.Global
            );
        });
    });

    describe('affectsFahh', () => {
        it('should return true when configuration change affects Fahh', () => {
            const mockEvent = {
                affectsConfiguration: jest.fn().mockReturnValue(true)
            } as any;

            const result = configManager.affectsFahh(mockEvent);

            expect(result).toBe(true);
            expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith('fahh');
        });

        it('should return false when configuration change does not affect Fahh', () => {
            const mockEvent = {
                affectsConfiguration: jest.fn().mockReturnValue(false)
            } as any;

            const result = configManager.affectsFahh(mockEvent);

            expect(result).toBe(false);
        });
    });

    describe('resetAllSettings', () => {
        it('should reset all settings at all configuration levels', async () => {
            mockConfiguration.inspect.mockReturnValue({
                globalValue: { enabled: false, volume: 50 },
                workspaceValue: { soundPack: 'custom.mp3' },
                workspaceFolderValue: { logLevel: 'debug' }
            });

            await configManager.resetAllSettings();

            // Should update each unique key at all levels
            expect(mockConfiguration.update).toHaveBeenCalledWith('enabled', undefined, vscode.ConfigurationTarget.Global);
            expect(mockConfiguration.update).toHaveBeenCalledWith('enabled', undefined, vscode.ConfigurationTarget.Workspace);
            expect(mockConfiguration.update).toHaveBeenCalledWith('enabled', undefined, vscode.ConfigurationTarget.WorkspaceFolder);
            
            expect(mockConfiguration.update).toHaveBeenCalledWith('volume', undefined, vscode.ConfigurationTarget.Global);
            expect(mockConfiguration.update).toHaveBeenCalledWith('soundPack', undefined, vscode.ConfigurationTarget.Workspace);
            expect(mockConfiguration.update).toHaveBeenCalledWith('logLevel', undefined, vscode.ConfigurationTarget.WorkspaceFolder);
        });

        it('should handle empty configuration gracefully', async () => {
            mockConfiguration.inspect.mockReturnValue(null);

            await expect(configManager.resetAllSettings()).resolves.not.toThrow();
            expect(mockConfiguration.update).not.toHaveBeenCalled();
        });
    });

    describe('Security Fixes', () => {
        it('should NOT contain hardcoded OpenRouter API key', () => {
            const config = configManager.readConfig();

            // The hardcoded key should NOT appear anywhere (security check)
            expect(config.openrouterApiKey).toBe('');
        });

        it('should read aiProvider from user config, not hardcode to "openrouter"', () => {
            // Test default (copilot)
            mockConfiguration.get.mockImplementation((key: string, defaultValue?: any) => {
                if (key === 'aiProvider') {
                    return defaultValue; // Use default
                }
                return defaultValue;
            });

            const config1 = configManager.readConfig();
            expect(config1.aiProvider).toBe('copilot'); // Default should be copilot

            // Test user-configured value (openrouter)
            mockConfiguration.get.mockImplementation((key: string, defaultValue?: any) => {
                if (key === 'aiProvider') {
                    return 'openrouter';
                }
                return defaultValue;
            });

            const config2 = configManager.readConfig();
            expect(config2.aiProvider).toBe('openrouter'); // Should respect user setting
        });
    });
});
