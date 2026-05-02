import * as vscode from 'vscode';

/**
 * Manages secure storage of API keys using VS Code's SecretStorage API.
 * 
 * This class provides a secure way to store, retrieve, and manage API keys
 * for various AI providers (OpenRouter, Copilot, etc.) using VS Code's
 * built-in secret storage mechanism, which encrypts credentials at rest.
 * 
 * @example
 * ```typescript
 * const secretManager = new SecretManager(context.secrets);
 * 
 * // Store an API key
 * await secretManager.storeApiKey('openrouter', 'sk-or-v1-...');
 * 
 * // Retrieve an API key
 * const key = await secretManager.getApiKey('openrouter');
 * 
 * // Check if a key exists
 * const hasKey = await secretManager.hasApiKey('openrouter');
 * 
 * // Delete an API key
 * await secretManager.deleteApiKey('openrouter');
 * ```
 */
export class SecretManager implements ISecretManager {
    private readonly secretStorage: vscode.SecretStorage;
    private readonly keyPrefix = 'fahh.apiKey.';

    /**
     * Creates a new SecretManager instance.
     * 
     * @param secretStorage - VS Code's SecretStorage instance from ExtensionContext
     */
    constructor(secretStorage: vscode.SecretStorage) {
        this.secretStorage = secretStorage;
    }

    /**
     * Store an API key securely in VS Code's secret storage.
     * 
     * The key is validated before storage to ensure it meets basic format requirements.
     * Keys are stored with a prefix to namespace them within the extension.
     * 
     * @param provider - The provider name (e.g., 'openrouter', 'copilot')
     * @param apiKey - The API key to store
     * @throws {Error} If the provider name is empty
     * @throws {Error} If the API key is empty or invalid format
     * 
     * @example
     * ```typescript
     * await secretManager.storeApiKey('openrouter', 'sk-or-v1-abc123...');
     * ```
     */
    async storeApiKey(provider: string, apiKey: string): Promise<void> {
        if (!provider || provider.trim().length === 0) {
            throw new Error('Provider name cannot be empty');
        }

        if (!apiKey || apiKey.trim().length === 0) {
            throw new Error('API key cannot be empty');
        }

        // Validate API key format
        this.validateApiKeyFormat(provider, apiKey);

        const key = this.getStorageKey(provider);
        await this.secretStorage.store(key, apiKey.trim());
    }

    /**
     * Retrieve an API key securely from VS Code's secret storage.
     * 
     * @param provider - The provider name (e.g., 'openrouter', 'copilot')
     * @returns The API key, or null if not found
     * @throws {Error} If the provider name is empty
     * 
     * @example
     * ```typescript
     * const key = await secretManager.getApiKey('openrouter');
     * if (key) {
     *     console.log('API key found');
     * } else {
     *     console.log('No API key configured');
     * }
     * ```
     */
    async getApiKey(provider: string): Promise<string | null> {
        if (!provider || provider.trim().length === 0) {
            throw new Error('Provider name cannot be empty');
        }

        const key = this.getStorageKey(provider);
        const value = await this.secretStorage.get(key);
        return value || null;
    }

    /**
     * Delete an API key from VS Code's secret storage.
     * 
     * This operation is idempotent - it will not throw an error if the key
     * doesn't exist.
     * 
     * @param provider - The provider name (e.g., 'openrouter', 'copilot')
     * @throws {Error} If the provider name is empty
     * 
     * @example
     * ```typescript
     * await secretManager.deleteApiKey('openrouter');
     * ```
     */
    async deleteApiKey(provider: string): Promise<void> {
        if (!provider || provider.trim().length === 0) {
            throw new Error('Provider name cannot be empty');
        }

        const key = this.getStorageKey(provider);
        await this.secretStorage.delete(key);
    }

    /**
     * Check if an API key exists for a provider.
     * 
     * This is more efficient than retrieving the key when you only need to
     * check for existence.
     * 
     * @param provider - The provider name (e.g., 'openrouter', 'copilot')
     * @returns True if the key exists, false otherwise
     * @throws {Error} If the provider name is empty
     * 
     * @example
     * ```typescript
     * if (await secretManager.hasApiKey('openrouter')) {
     *     console.log('OpenRouter is configured');
     * }
     * ```
     */
    async hasApiKey(provider: string): Promise<boolean> {
        if (!provider || provider.trim().length === 0) {
            throw new Error('Provider name cannot be empty');
        }

        const key = await this.getApiKey(provider);
        return key !== null && key.length > 0;
    }

    /**
     * Get the full storage key for a provider.
     * 
     * @param provider - The provider name
     * @returns The namespaced storage key
     * @private
     */
    private getStorageKey(provider: string): string {
        return `${this.keyPrefix}${provider.toLowerCase()}`;
    }

    /**
     * Validate API key format based on provider-specific rules.
     * 
     * This provides basic validation to catch obvious errors before storage.
     * It does not verify that the key is valid with the provider's API.
     * 
     * @param provider - The provider name
     * @param apiKey - The API key to validate
     * @throws {Error} If the API key format is invalid
     * @private
     */
    private validateApiKeyFormat(provider: string, apiKey: string): void {
        const trimmedKey = apiKey.trim();

        // Minimum length check (most API keys are at least 20 characters)
        if (trimmedKey.length < 20) {
            throw new Error(`API key for ${provider} is too short (minimum 20 characters)`);
        }

        // Maximum length check (prevent abuse)
        if (trimmedKey.length > 500) {
            throw new Error(`API key for ${provider} is too long (maximum 500 characters)`);
        }

        // Provider-specific validation
        switch (provider.toLowerCase()) {
            case 'openrouter':
                // OpenRouter keys start with 'sk-or-v1-'
                if (!trimmedKey.startsWith('sk-or-v1-')) {
                    throw new Error(
                        'Invalid OpenRouter API key format. Expected format: sk-or-v1-...'
                    );
                }
                break;

            case 'copilot':
                // Copilot uses GitHub tokens, which typically start with 'ghp_' or 'gho_'
                // However, Copilot API might use different formats, so we're lenient here
                // Just ensure it's not obviously wrong
                if (trimmedKey.includes(' ')) {
                    throw new Error('Invalid Copilot API key format. Key should not contain spaces');
                }
                break;

            default:
                // For unknown providers, just do basic sanity checks
                // No spaces, no obvious placeholder text
                if (trimmedKey.includes(' ')) {
                    throw new Error(`Invalid API key format for ${provider}. Key should not contain spaces`);
                }
                if (
                    trimmedKey.toLowerCase().includes('your-api-key') ||
                    trimmedKey.toLowerCase().includes('placeholder') ||
                    trimmedKey.toLowerCase().includes('example')
                ) {
                    throw new Error(`API key for ${provider} appears to be a placeholder value`);
                }
                break;
        }
    }
}

/**
 * Interface for secure API key management.
 * 
 * Implementations of this interface should use secure storage mechanisms
 * (like VS Code's SecretStorage) rather than storing keys in plaintext.
 */
export interface ISecretManager {
    /**
     * Store an API key securely.
     * 
     * @param provider - The provider name ('openrouter', 'copilot', etc.)
     * @param apiKey - The API key to store
     * @throws {Error} If the API key format is invalid
     */
    storeApiKey(provider: string, apiKey: string): Promise<void>;

    /**
     * Retrieve an API key securely.
     * 
     * @param provider - The provider name
     * @returns The API key, or null if not found
     */
    getApiKey(provider: string): Promise<string | null>;

    /**
     * Delete an API key.
     * 
     * @param provider - The provider name
     */
    deleteApiKey(provider: string): Promise<void>;

    /**
     * Check if an API key exists for a provider.
     * 
     * @param provider - The provider name
     * @returns True if the key exists
     */
    hasApiKey(provider: string): Promise<boolean>;
}
