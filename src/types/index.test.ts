/**
 * Unit tests for shared type definitions.
 * These tests verify that types are properly exported and can be used.
 */

import {
    LogLevel,
    FailureSource,
    NotificationLevel,
    VolumeCurve,
    QuietHours,
    PerSourceSounds,
    PerSourceVolumes,
    FahhConfig,
    HistoryEntry,
    AudioOptions,
    FailureEvent,
    FailureHandler,
    SuccessHandler
} from './index';

describe('Type Definitions', () => {
    describe('LogLevel', () => {
        it('should accept valid log levels', () => {
            const levels: LogLevel[] = ['off', 'error', 'warn', 'info', 'debug'];
            expect(levels).toHaveLength(5);
        });
    });

    describe('FailureSource', () => {
        it('should accept valid failure sources', () => {
            const sources: FailureSource[] = ['task', 'shell', 'terminal', 'diagnostics', 'build', 'longTask'];
            expect(sources).toHaveLength(6);
        });
    });

    describe('NotificationLevel', () => {
        it('should accept valid notification levels', () => {
            const levels: NotificationLevel[] = ['info', 'warning', 'error', 'none'];
            expect(levels).toHaveLength(4);
        });
    });

    describe('VolumeCurve', () => {
        it('should accept valid volume curves', () => {
            const curves: VolumeCurve[] = ['linear', 'log'];
            expect(curves).toHaveLength(2);
        });
    });

    describe('QuietHours', () => {
        it('should create a valid QuietHours object', () => {
            const quietHours: QuietHours = {
                enabled: true,
                from: '22:00',
                to: '08:00'
            };
            expect(quietHours.enabled).toBe(true);
            expect(quietHours.from).toBe('22:00');
            expect(quietHours.to).toBe('08:00');
        });
    });

    describe('PerSourceSounds', () => {
        it('should create a valid PerSourceSounds object', () => {
            const sounds: PerSourceSounds = {
                task: 'task.mp3',
                shell: 'shell.mp3',
                terminal: 'terminal.mp3',
                diagnostics: 'diagnostics.mp3',
                build: 'build.mp3',
                longTask: 'longTask.mp3'
            };
            expect(sounds.task).toBe('task.mp3');
            expect(sounds.shell).toBe('shell.mp3');
        });
    });

    describe('PerSourceVolumes', () => {
        it('should create a valid PerSourceVolumes object', () => {
            const volumes: PerSourceVolumes = {
                task: 100,
                shell: 80,
                terminal: 90,
                diagnostics: 70,
                build: 85,
                longTask: 95
            };
            expect(volumes.task).toBe(100);
            expect(volumes.shell).toBe(80);
        });
    });

    describe('FahhConfig', () => {
        it('should create a valid FahhConfig object', () => {
            const config: FahhConfig = {
                enabled: true,
                soundPack: 'fahh.mp3',
                soundPath: '',
                soundFolder: '',
                sounds: {
                    task: '',
                    shell: '',
                    terminal: '',
                    diagnostics: '',
                    build: '',
                    longTask: ''
                },
                successEnabled: false,
                successSound: '',
                volumes: {
                    task: -1,
                    shell: -1,
                    terminal: -1,
                    diagnostics: -1,
                    build: -1,
                    longTask: -1
                },
                volume: 100,
                volumeCurve: 'linear',
                showNotification: true,
                notificationLevel: 'warning',
                sources: new Set(['task', 'shell', 'terminal']),
                cooldownMs: 50,
                cooldownPerSource: false,
                maxPerMinute: 0,
                ignorePatterns: [],
                showStatusBar: true,
                statusBarCounter: true,
                flashStatusBar: true,
                quietHours: {
                    enabled: false,
                    from: '22:00',
                    to: '08:00'
                },
                muteWhenFocused: false,
                snoozeMinutes: 10,
                diagnosticsThreshold: 1,
                longTaskThresholdMs: 60000,
                logLevel: 'warn',
                historyMax: 50,
                speakLabel: false,
                webhookUrl: '',
                aiSummaryEnabled: false,
                aiProvider: 'copilot',
                openrouterApiKey: '',
                openrouterModel: 'meta-llama/llama-3.2-3b-instruct:free',
                dailySummary: false,
                streakCounter: false,
                bossFightMode: false,
                errorExplanationEnabled: true,
                errorExplanationAutoShow: true
            };
            expect(config.enabled).toBe(true);
            expect(config.soundPack).toBe('fahh.mp3');
            expect(config.sources.has('task')).toBe(true);
        });
    });

    describe('HistoryEntry', () => {
        it('should create a valid HistoryEntry object', () => {
            const entry: HistoryEntry = {
                id: 'test-id',
                timestamp: Date.now(),
                source: 'task',
                label: 'Test failure',
                soundPath: '/path/to/sound.mp3'
            };
            expect(entry.id).toBe('test-id');
            expect(entry.source).toBe('task');
            expect(entry.label).toBe('Test failure');
        });
    });

    describe('AudioOptions', () => {
        it('should create a valid AudioOptions object', () => {
            const options: AudioOptions = {
                volume: 75
            };
            expect(options.volume).toBe(75);
        });
    });

    describe('FailureEvent', () => {
        it('should create a valid FailureEvent object', () => {
            const event: FailureEvent = {
                source: 'task',
                label: 'Build failed',
                timestamp: Date.now()
            };
            expect(event.source).toBe('task');
            expect(event.label).toBe('Build failed');
            expect(event.timestamp).toBeGreaterThan(0);
        });
    });

    describe('FailureHandler', () => {
        it('should accept a valid failure handler function', () => {
            const handler: FailureHandler = (event) => {
                expect(event.source).toBeDefined();
                expect(event.label).toBeDefined();
            };
            handler({ source: 'task', label: 'Test' });
        });
    });

    describe('SuccessHandler', () => {
        it('should accept a valid success handler function', () => {
            const handler: SuccessHandler = (event) => {
                expect(event.source).toBeDefined();
                expect(event.label).toBeDefined();
            };
            handler({ source: 'task', label: 'Test' });
        });
    });
});
