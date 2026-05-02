import * as vscode from 'vscode';

/**
 * Log level type for controlling logging verbosity.
 */
export type LogLevel = 'off' | 'error' | 'warn' | 'info' | 'debug';

/**
 * Numeric ranking for log levels to determine if a message should be logged.
 */
const LEVEL_RANK: Record<LogLevel, number> = {
    off: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4
};

/**
 * Logger class for structured logging to VS Code output channel.
 * Provides level-based filtering and automatic timestamping of all log messages.
 * 
 * @example
 * const logger = new Logger('Fahh');
 * logger.setLevel('info');
 * logger.info('Extension activated');
 * logger.error('Failed to load config', error);
 */
export class Logger {
    private readonly channel: vscode.OutputChannel;
    private level: LogLevel = 'warn';

    /**
     * Creates a new Logger instance.
     * 
     * @param name - The name of the output channel to create
     */
    public constructor(name: string) {
        this.channel = vscode.window.createOutputChannel(name);
    }

    /**
     * Sets the minimum log level for messages to be displayed.
     * Messages below this level will be filtered out.
     * 
     * @param level - The minimum log level ('off', 'error', 'warn', 'info', 'debug')
     */
    public setLevel(level: LogLevel): void {
        this.level = level;
    }

    /**
     * Shows the output channel in the UI.
     * 
     * @param preserveFocus - If true, the output channel will not take focus
     */
    public show(preserveFocus?: boolean): void {
        this.channel.show(preserveFocus ?? true);
    }

    /**
     * Disposes of the output channel and releases resources.
     */
    public dispose(): void {
        this.channel.dispose();
    }

    /**
     * Logs an error message with optional error details.
     * Includes error message and stack trace if an Error object is provided.
     * 
     * @param message - The error message to log
     * @param error - Optional error object or value to include in the log
     * 
     * @example
     * logger.error('Failed to load configuration');
     * logger.error('API call failed', new Error('Network timeout'));
     */
    public error(message: string, error?: unknown): void {
        if (!this.shouldLog('error')) { return; }
        const detail = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : error !== undefined ? String(error) : '';
        this.write('ERROR', detail ? `${message} :: ${detail}` : message);
    }

    /**
     * Logs a warning message.
     * 
     * @param message - The warning message to log
     * 
     * @example
     * logger.warn('API key not configured, some features will be disabled');
     */
    public warn(message: string): void {
        if (!this.shouldLog('warn')) { return; }
        this.write('WARN', message);
    }

    /**
     * Logs an informational message.
     * Use for important state changes, user actions, and configuration updates.
     * 
     * @param message - The informational message to log
     * 
     * @example
     * logger.info('Extension activated successfully');
     * logger.info('Configuration updated: soundPack = default');
     */
    public info(message: string): void {
        if (!this.shouldLog('info')) { return; }
        this.write('INFO', message);
    }

    /**
     * Logs a debug message.
     * Use for detailed diagnostic information, API calls, and file operations.
     * 
     * @param message - The debug message to log
     * 
     * @example
     * logger.debug('Checking sound file at path: /sounds/default.mp3');
     * logger.debug('API request: POST /v1/chat/completions');
     */
    public debug(message: string): void {
        if (!this.shouldLog('debug')) { return; }
        this.write('DEBUG', message);
    }

    /**
     * Determines if a message at the given level should be logged.
     * 
     * @param level - The log level to check
     * @returns True if the message should be logged, false otherwise
     */
    private shouldLog(level: LogLevel): boolean {
        return LEVEL_RANK[level] <= LEVEL_RANK[this.level];
    }

    /**
     * Writes a formatted log message to the output channel.
     * Automatically adds timestamp and log level tag to all messages.
     * 
     * @param tag - The log level tag (ERROR, WARN, INFO, DEBUG)
     * @param message - The message content to log
     */
    private write(tag: string, message: string): void {
        const timestamp = new Date().toISOString();
        this.channel.appendLine(`[${timestamp}] [${tag}] ${message}`);
    }
}
