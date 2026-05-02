/**
 * Tests for constants module
 */

import {
    EXTENSION,
    CONFIG,
    COMMANDS,
    SOUNDS,
    TIMEOUTS,
    DEFAULTS,
    VALIDATION,
    AI,
    MESSAGES
} from './constants';

describe('Constants Module', () => {
    describe('EXTENSION', () => {
        it('should have correct extension metadata', () => {
            expect(EXTENSION.ID).toBe('fahh');
            expect(EXTENSION.NAME).toBe('Fahh');
            expect(EXTENSION.VERSION).toBe('2.1.0');
            expect(EXTENSION.PUBLISHER).toBe('4nur4gmishr4');
        });
    });

    describe('CONFIG', () => {
        it('should have correct configuration section', () => {
            expect(CONFIG.SECTION).toBe('fahh');
        });

        it('should have all required configuration keys', () => {
            expect(CONFIG.KEYS.ENABLED).toBe('enabled');
            expect(CONFIG.KEYS.SOUND_PACK).toBe('soundPack');
            expect(CONFIG.KEYS.AI_PROVIDER).toBe('aiProvider');
            expect(CONFIG.KEYS.OPENROUTER_API_KEY).toBe('openrouterApiKey');
        });
    });

    describe('COMMANDS', () => {
        it('should have all command identifiers', () => {
            expect(COMMANDS.TEST).toBe('fahh.test');
            expect(COMMANDS.TOGGLE).toBe('fahh.toggle');
            expect(COMMANDS.SHOW_HISTORY).toBe('fahh.showHistory');
        });
    });

    describe('SOUNDS', () => {
        it('should have default sound path', () => {
            expect(SOUNDS.DEFAULT).toBe('packs/default/fahh.mp3');
        });

        it('should have all sound pack names', () => {
            expect(SOUNDS.PACKS.FAHH).toBe('fahh.mp3');
            expect(SOUNDS.PACKS.FAHH_HARD).toBe('fahhhard.mp3');
            expect(SOUNDS.PACKS.OH_SHIT).toBe('ohshit.mp3');
        });
    });

    describe('TIMEOUTS', () => {
        it('should have correct timeout values', () => {
            expect(TIMEOUTS.CLEANUP_INTERVAL_MS).toBe(60000);
            expect(TIMEOUTS.PER_MINUTE_WINDOW_MS).toBe(60000);
            expect(TIMEOUTS.MILLISECONDS_PER_MINUTE).toBe(60000);
        });
    });

    describe('DEFAULTS', () => {
        it('should have correct default values', () => {
            expect(DEFAULTS.ENABLED).toBe(true);
            expect(DEFAULTS.VOLUME).toBe(100);
            expect(DEFAULTS.SOUND_PACK).toBe('fahh.mp3');
            expect(DEFAULTS.AI_PROVIDER).toBe('copilot');
        });
    });

    describe('VALIDATION', () => {
        it('should have time format regex', () => {
            expect(VALIDATION.TIME_FORMAT).toBeInstanceOf(RegExp);
            expect(VALIDATION.TIME_FORMAT.test('22:00')).toBe(true);
            expect(VALIDATION.TIME_FORMAT.test('08:00')).toBe(true);
            expect(VALIDATION.TIME_FORMAT.test('25:00')).toBe(false);
        });

        it('should have volume range', () => {
            expect(VALIDATION.VOLUME.MIN).toBe(0);
            expect(VALIDATION.VOLUME.MAX).toBe(100);
            expect(VALIDATION.VOLUME.DEFAULT_PER_SOURCE).toBe(-1);
        });
    });

    describe('AI', () => {
        it('should have AI provider names', () => {
            expect(AI.PROVIDERS.COPILOT).toBe('copilot');
            expect(AI.PROVIDERS.OPENROUTER).toBe('openrouter');
        });

        it('should have OpenRouter configuration', () => {
            expect(AI.OPENROUTER.BASE_URL).toBe('https://openrouter.ai/api/v1');
            expect(AI.OPENROUTER.CHAT_ENDPOINT).toBe('/chat/completions');
        });
    });

    describe('MESSAGES', () => {
        it('should have user-facing messages', () => {
            expect(MESSAGES.SOUND_UPDATED).toBe('Fahh sound updated.');
            expect(MESSAGES.HISTORY_CLEARED).toBe('Failure history cleared.');
        });

        it('should have confirmation messages', () => {
            expect(MESSAGES.CONFIRM.RESET_SETTINGS).toContain('reset all Fahh settings');
            expect(MESSAGES.CONFIRM.FACTORY_RESET).toContain('reset all settings');
        });
    });

    describe('Constants Availability', () => {
        it('should export all constant objects', () => {
            // Verify all main constant objects are defined
            expect(EXTENSION).toBeDefined();
            expect(CONFIG).toBeDefined();
            expect(COMMANDS).toBeDefined();
            expect(SOUNDS).toBeDefined();
            expect(TIMEOUTS).toBeDefined();
            expect(DEFAULTS).toBeDefined();
            expect(VALIDATION).toBeDefined();
            expect(AI).toBeDefined();
            expect(MESSAGES).toBeDefined();
        });
    });
});
