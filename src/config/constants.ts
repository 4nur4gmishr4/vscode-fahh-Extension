/**
 * Centralized constants for the Fahh extension.
 * Eliminates magic strings and numbers throughout the codebase.
 */

/**
 * Extension metadata constants
 */
export const EXTENSION = {
    /** Extension identifier */
    ID: 'fahh',
    /** Display name */
    NAME: 'Fahh',
    /** Current version */
    VERSION: '2.1.0',
    /** Extension publisher */
    PUBLISHER: '4nur4gmishr4'
} as const;

/**
 * Configuration section and keys
 */
export const CONFIG = {
    /** Root configuration section */
    SECTION: 'fahh',
    
    /** Configuration keys */
    KEYS: {
        ENABLED: 'enabled',
        SOUND_PACK: 'soundPack',
        SOUND_PATH: 'soundPath',
        SOUND_FOLDER: 'soundFolder',
        SOUNDS: 'sounds',
        SUCCESS_ENABLED: 'successEnabled',
        SUCCESS_SOUND: 'successSound',
        VOLUMES: 'volumes',
        VOLUME: 'volume',
        VOLUME_CURVE: 'volumeCurve',
        SHOW_NOTIFICATION: 'showNotification',
        NOTIFICATION_LEVEL: 'notificationLevel',
        SOURCES: 'sources',
        COOLDOWN_MS: 'cooldownMs',
        COOLDOWN_PER_SOURCE: 'cooldownPerSource',
        MAX_PER_MINUTE: 'maxPerMinute',
        IGNORE_PATTERNS: 'ignorePatterns',
        SHOW_STATUS_BAR: 'showStatusBar',
        STATUS_BAR_COUNTER: 'statusBarCounter',
        FLASH_STATUS_BAR: 'flashStatusBar',
        QUIET_HOURS: 'quietHours',
        QUIET_HOURS_ENABLED: 'quietHours.enabled',
        QUIET_HOURS_FROM: 'quietHours.from',
        QUIET_HOURS_TO: 'quietHours.to',
        MUTE_WHEN_FOCUSED: 'muteWhenFocused',
        SNOOZE_MINUTES: 'snoozeMinutes',
        DIAGNOSTICS_THRESHOLD: 'diagnosticsThreshold',
        LONG_TASK_THRESHOLD_MS: 'longTaskThresholdMs',
        LOG_LEVEL: 'logLevel',
        HISTORY_MAX: 'historyMax',
        SPEAK_LABEL: 'speakLabel',
        WEBHOOK_URL: 'webhookUrl',
        AI_SUMMARY_ENABLED: 'aiSummary.enabled',
        AI_PROVIDER: 'aiProvider',
        OPENROUTER_API_KEY: 'openrouterApiKey',
        OPENROUTER_MODEL: 'openrouterModel',
        DAILY_SUMMARY: 'dailySummary',
        STREAK_COUNTER: 'streakCounter',
        BOSS_FIGHT_MODE: 'bossFightMode',
        ERROR_EXPLANATION_ENABLED: 'errorExplanation.enabled',
        ERROR_EXPLANATION_AUTO_SHOW: 'errorExplanation.autoShow'
    }
} as const;

/**
 * Command identifiers
 */
export const COMMANDS = {
    TEST: 'fahh.test',
    TEST_SUCCESS: 'fahh.testSuccess',
    TOGGLE: 'fahh.toggle',
    TOGGLE_WORKSPACE: 'fahh.toggleWorkspace',
    SELECT_SOUND: 'fahh.selectSound',
    SELECT_SOUND_FOLDER: 'fahh.selectSoundFolder',
    RESET_SOUND: 'fahh.resetSound',
    PICK_SOUND_PACK: 'fahh.pickSoundPack',
    STOP: 'fahh.stop',
    SNOOZE: 'fahh.snooze',
    CLEAR_HISTORY: 'fahh.clearHistory',
    REPLAY_LAST: 'fahh.replayLast',
    SHOW_HISTORY: 'fahh.showHistory',
    SHOW_OUTPUT: 'fahh.showOutput',
    RESET_SETTINGS: 'fahh.resetSettings',
    FACTORY_RESET: 'fahh.factoryReset',
    SHOW_WELCOME: 'fahh.showWelcome',
    HISTORY_FOCUS: 'fahh.history.focus'
} as const;

/**
 * View identifiers
 */
export const VIEWS = {
    HISTORY: 'fahh.history'
} as const;

/**
 * Context value identifiers
 */
export const CONTEXT_VALUES = {
    HISTORY_ENTRY: 'fahh.historyEntry'
} as const;

/**
 * State keys for global/workspace state
 */
export const STATE_KEYS = {
    LAST_VERSION: 'lastVersion',
    DAILY_FAIL_COUNT: 'fahh.dailyFailCount',
    LAST_SUCCESS_STREAK: 'fahh.lastSuccessStreak',
    BOSS_HP: 'fahh.bossHp',
    HISTORY: 'fahh.history'
} as const;

/**
 * Default sound paths and pack information
 */
export const SOUNDS = {
    /** Default sound file relative to resources */
    DEFAULT: 'packs/default/fahh.mp3',
    
    /** Default sound pack directory */
    DEFAULT_PACK_DIR: 'packs/default',
    
    /** Available sound packs */
    PACKS: {
        FAHH: 'fahh.mp3',
        FAHH_HARD: 'fahhhard.mp3',
        FART_REVERB: 'fartreverb.mp3',
        FAHH_DEEP: 'fahhdeep.mp3',
        FAHH_BROKE: 'fahhbroke.mp3',
        OH_SHIT: 'ohshit.mp3'
    }
} as const;

/**
 * Timeout and interval values (in milliseconds)
 */
export const TIMEOUTS = {
    /** Cleanup interval for scheduler (1 minute) */
    CLEANUP_INTERVAL_MS: 60000,
    
    /** Per-minute window for rate limiting (1 minute) */
    PER_MINUTE_WINDOW_MS: 60000,
    
    /** Milliseconds per minute for snooze calculations */
    MILLISECONDS_PER_MINUTE: 60000,
    
    /** Status bar flash duration */
    STATUS_BAR_FLASH_MS: 500,
    
    /** Daily summary schedule interval (24 hours) */
    DAILY_SUMMARY_INTERVAL_MS: 86400000
} as const;

/**
 * Default configuration values
 */
export const DEFAULTS = {
    /** Default enabled state */
    ENABLED: true,
    
    /** Default sound pack */
    SOUND_PACK: 'fahh.mp3',
    
    /** Default volume (0-100) */
    VOLUME: 100,
    
    /** Default volume curve */
    VOLUME_CURVE: 'linear' as const,
    
    /** Default notification level */
    NOTIFICATION_LEVEL: 'warning' as const,
    
    /** Default sources to monitor */
    SOURCES: ['task', 'shell', 'terminal'] as const,
    
    /** Default cooldown in milliseconds */
    COOLDOWN_MS: 50,
    
    /** Default max sounds per minute (0 = unlimited) */
    MAX_PER_MINUTE: 0,
    
    /** Default quiet hours start time */
    QUIET_HOURS_FROM: '22:00',
    
    /** Default quiet hours end time */
    QUIET_HOURS_TO: '08:00',
    
    /** Default snooze duration in minutes */
    SNOOZE_MINUTES: 10,
    
    /** Default diagnostics threshold */
    DIAGNOSTICS_THRESHOLD: 1,
    
    /** Default long task threshold in milliseconds (1 minute) */
    LONG_TASK_THRESHOLD_MS: 60000,
    
    /** Default log level */
    LOG_LEVEL: 'warn' as const,
    
    /** Default maximum history entries */
    HISTORY_MAX: 50,
    
    /** Default AI provider */
    AI_PROVIDER: 'copilot',
    
    /** Default OpenRouter model */
    OPENROUTER_MODEL: 'meta-llama/llama-3.2-3b-instruct:free',
    
    /** Default boss HP */
    BOSS_HP: 100
} as const;

/**
 * Validation patterns and limits
 */
export const VALIDATION = {
    /** Time format pattern (HH:MM) */
    TIME_FORMAT: /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/,
    
    /** Volume range */
    VOLUME: {
        MIN: 0,
        MAX: 100,
        DEFAULT_PER_SOURCE: -1 // -1 means use global volume
    },
    
    /** Cooldown range (milliseconds) */
    COOLDOWN: {
        MIN: 0,
        MAX: 60000
    },
    
    /** Max per minute range */
    MAX_PER_MINUTE: {
        MIN: 0,
        MAX: 120
    },
    
    /** Snooze duration range (minutes) */
    SNOOZE: {
        MIN: 1,
        MAX: 1440 // 24 hours
    },
    
    /** Diagnostics threshold range */
    DIAGNOSTICS_THRESHOLD: {
        MIN: 1,
        MAX: 100
    },
    
    /** Long task threshold range (milliseconds) */
    LONG_TASK_THRESHOLD: {
        MIN: 1000,
        MAX: 3600000 // 1 hour
    },
    
    /** History size range */
    HISTORY: {
        MIN: 10,
        MAX: 500
    }
} as const;

/**
 * Resource paths relative to extension root
 */
export const RESOURCES = {
    /** Logo image path */
    LOGO: 'resources/fahh-logo.jpeg',
    
    /** Sound packs directory */
    PACKS_DIR: 'resources/packs',
    
    /** Default pack directory */
    DEFAULT_PACK: 'resources/packs/default',
    
    /** Welcome screen resources */
    WELCOME: {
        CLIENT_JS: 'resources/welcome-client.js',
        STEP1_MD: 'resources/step1.md',
        STEP2_MD: 'resources/step2.md',
        SETTINGS_PNG: 'resources/settings.png'
    }
} as const;

/**
 * AI provider configuration
 */
export const AI = {
    /** Available AI providers */
    PROVIDERS: {
        COPILOT: 'copilot',
        OPENROUTER: 'openrouter'
    },
    
    /** OpenRouter API configuration */
    OPENROUTER: {
        BASE_URL: 'https://openrouter.ai/api/v1',
        CHAT_ENDPOINT: '/chat/completions',
        MODELS: {
            LLAMA_3_2_3B: 'meta-llama/llama-3.2-3b-instruct:free',
            GEMMA_4_31B: 'google/gemma-4-31b-it:free',
            GEMMA_4_26B: 'google/gemma-4-26b-a4b-it:free',
            HERMES_3_405B: 'nousresearch/hermes-3-llama-3.1-405b:free',
            NEMOTRON_30B: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
            LAGUNA_XS: 'poolside/laguna-xs.2:free',
            LAGUNA_M: 'poolside/laguna-m.1:free'
        }
    },
    
    /** Request timeout for AI calls (milliseconds) */
    REQUEST_TIMEOUT_MS: 30000
} as const;

/**
 * Gamification constants
 */
export const GAMIFICATION = {
    /** Boss fight mode */
    BOSS: {
        INITIAL_HP: 100,
        DAMAGE_PER_FAILURE: 10,
        HEAL_PER_SUCCESS: 5
    },
    
    /** Streak counter milestones */
    STREAK_MILESTONES: [5, 10, 25, 50, 100] as const
} as const;

/**
 * Webview panel identifiers
 */
export const WEBVIEW_PANELS = {
    ERROR_EXPLANATION: 'fahhErrorExplanation',
    WELCOME: 'fahhWelcome'
} as const;

/**
 * Status bar configuration
 */
export const STATUS_BAR = {
    /** Icon when enabled */
    ICON_ENABLED: '$(unmute)',
    
    /** Icon when disabled */
    ICON_DISABLED: '$(mute)',
    
    /** Text prefix */
    TEXT_PREFIX: 'Fahh'
} as const;

/**
 * File filters for file dialogs
 */
export const FILE_FILTERS = {
    AUDIO: {
        Audio: ['mp3', 'wav', 'ogg', 'flac', 'm4a']
    }
} as const;

/**
 * Notification messages
 */
export const MESSAGES = {
    SOUND_UPDATED: 'Fahh sound updated.',
    SOUND_FOLDER_SET: 'Fahh sound folder set. Sounds will be random from this folder.',
    SOUND_RESET: 'Fahh sound reset to default.',
    HISTORY_CLEARED: 'Failure history cleared.',
    NO_RECENT_FAILURE: 'No recent failure to replay.',
    SETTINGS_RESET: 'Fahh settings have been reset.',
    FACTORY_RESET_COMPLETE: 'Fahh has been factory reset.',
    NO_SOUND_PACKS: 'No sound packs installed. Use custom sound instead.',
    
    /** Confirmation prompts */
    CONFIRM: {
        RESET_SETTINGS: 'Are you sure you want to reset all Fahh settings to default?',
        FACTORY_RESET: 'This will reset all settings AND clear your failure history. Proceed?'
    },
    
    /** Error messages */
    ERRORS: {
        NO_SOUND_RESOLVED: 'Fahh: no sound file resolved.',
        NO_SUCCESS_SOUND: 'Fahh: no success sound resolved.',
        PLAYBACK_FAILED: 'Fahh playback failed',
        CHECK_OUTPUT_LOG: 'Open "Fahh: Show Output Log" for details.'
    }
} as const;

/**
 * Logging prefixes and formats
 */
export const LOGGING = {
    /** Output channel name */
    CHANNEL_NAME: 'Fahh',
    
    /** Log levels */
    LEVELS: {
        OFF: 'off',
        ERROR: 'error',
        WARN: 'warn',
        INFO: 'info',
        DEBUG: 'debug'
    }
} as const;
