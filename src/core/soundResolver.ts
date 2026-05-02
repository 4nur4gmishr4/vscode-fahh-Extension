import * as fs from 'fs';
import * as path from 'path';
import { SOUNDS, RESOURCES } from '../config/constants';
import { Logger } from '../utils/logger';
import type { FahhConfig, FailureSource } from '../types';

/**
 * Resolves sound file paths based on configuration and failure source.
 * 
 * This class implements a priority-based sound resolution system:
 * 1. Success sounds (if enabled and isSuccess=true)
 * 2. Per-source sounds (configured for specific failure types)
 * 3. Sound folder (random selection from folder)
 * 4. Global sound path (single custom sound)
 * 5. Sound pack selection (from built-in packs)
 * 6. Default sound (fallback)
 * 
 * @example
 * ```typescript
 * const resolver = new SoundResolver(extensionPath, () => config, logger);
 * 
 * // Resolve sound for a task failure
 * const soundPath = await resolver.resolveForFailure('task');
 * 
 * // Resolve sound for a success event
 * const successPath = await resolver.resolveForFailure('task', true);
 * 
 * // Get volume for a specific source
 * const volume = resolver.getVolume('task');
 * ```
 */
export class SoundResolver {
    private readonly defaultSoundPath: string;
    private readonly packDir: string;

    /**
     * Creates a new SoundResolver instance.
     * 
     * @param extensionPath - Absolute path to the extension root directory
     * @param config - Function that returns the current extension configuration
     * @param logger - Logger instance for error reporting
     */
    public constructor(
        extensionPath: string,
        private readonly config: () => FahhConfig,
        private readonly logger: Logger
    ) {
        this.defaultSoundPath = path.join(extensionPath, RESOURCES.DEFAULT_PACK, SOUNDS.PACKS.FAHH);
        this.packDir = path.join(extensionPath, RESOURCES.PACKS_DIR);
    }

    /**
     * Resolve the sound file path for a failure or success event.
     * 
     * This method implements the priority-based resolution system:
     * 1. If isSuccess=true and successEnabled, use success sound
     * 2. Check per-source sound configuration
     * 3. Check sound folder (random selection)
     * 4. Check global sound path
     * 5. Check sound pack selection
     * 6. Fall back to default sound
     * 
     * @param source - The failure source type
     * @param isSuccess - Whether this is a success event (default: false)
     * @returns The resolved sound file path, or null if no sound is available
     * 
     * @example
     * ```typescript
     * // Resolve for task failure
     * const path = await resolver.resolveForFailure('task');
     * 
     * // Resolve for task success
     * const successPath = await resolver.resolveForFailure('task', true);
     * ```
     */
    public async resolveForFailure(source: FailureSource, isSuccess = false): Promise<string | null> {
        const cfg = this.config();

        // Priority 1: Success sound (if enabled and this is a success event)
        if (isSuccess && cfg.successEnabled) {
            if (cfg.successSound && await this.fileExists(cfg.successSound)) {
                return cfg.successSound;
            }
            return this.defaultSoundPath;
        }

        // Priority 2: Per-source sound (highest priority after success sound)
        const perSource = cfg.sounds[source as keyof typeof cfg.sounds] as string | undefined;
        if (perSource && await this.fileExists(perSource)) {
            return perSource;
        }

        // Priority 3: Sound folder (random selection)
        if (cfg.soundFolder && await this.fileExists(cfg.soundFolder)) {
            const files = await this.listAudioFiles(cfg.soundFolder);
            if (files.length > 0) {
                const pick = files[Math.floor(Math.random() * files.length)];
                return pick;
            }
        }

        // Priority 4: Global sound path
        if (cfg.soundPath && await this.fileExists(cfg.soundPath)) {
            return cfg.soundPath;
        }

        // Priority 5: Sound pack selection (fallback before default)
        if (cfg.soundPack) {
            const packSoundPath = path.join(this.packDir, SOUNDS.DEFAULT_PACK_DIR.split('/').pop()!, path.basename(cfg.soundPack));
            if (await this.fileExists(packSoundPath)) {
                return packSoundPath;
            }
        }

        // Priority 6: Default sound
        if (await this.fileExists(this.defaultSoundPath)) {
            return this.defaultSoundPath;
        }

        this.logger.error(`No sound file available for source: ${source}`);
        return null;
    }

    /**
     * Check if a file exists at the given path.
     * 
     * @param filePath - The file path to check
     * @returns True if the file exists and is accessible, false otherwise
     * @private
     */
    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get the volume level for a specific failure source.
     * 
     * Returns the per-source volume if configured (>= 0), otherwise returns
     * the global volume setting. Per-source volumes of -1 indicate "use global".
     * 
     * @param source - The failure source type
     * @returns Volume level (0-100)
     * 
     * @example
     * ```typescript
     * const volume = resolver.getVolume('task');
     * console.log(`Task volume: ${volume}%`);
     * ```
     */
    public getVolume(source: FailureSource): number {
        const cfg = this.config();
        const perSource = cfg.volumes[source as keyof typeof cfg.volumes];
        if (perSource !== undefined && perSource >= 0) {
            return perSource;
        }
        return cfg.volume;
    }

    /**
     * List all available sound packs.
     * 
     * Scans the packs directory and returns metadata for each pack that contains
     * at least one audio file. Packs are directories containing audio files.
     * 
     * @returns Array of sound pack metadata objects
     * 
     * @example
     * ```typescript
     * const packs = await resolver.listSoundPacks();
     * for (const pack of packs) {
     *     console.log(`Pack: ${pack.name} (${pack.id})`);
     * }
     * ```
     */
    public async listSoundPacks(): Promise<{ id: string; name: string; path: string }[]> {
        const packs: { id: string; name: string; path: string }[] = [];
        if (!(await this.fileExists(this.packDir))) {
            return packs;
        }
        try {
            const entries = await fs.promises.readdir(this.packDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const packPath = path.join(this.packDir, entry.name);
                    const files = await this.listAudioFiles(packPath);
                    if (files.length > 0) {
                        packs.push({ id: entry.name, name: this.titleCase(entry.name), path: packPath });
                    }
                }
            }
        } catch (error) {
            this.logger.error('Failed to list sound packs', error);
        }
        return packs;
    }

    /**
     * Pick a random sound file from a specific sound pack.
     * 
     * @param packId - The sound pack identifier (directory name)
     * @returns Path to a random sound file from the pack, or null if pack not found or empty
     * 
     * @example
     * ```typescript
     * const sound = await resolver.pickFromPack('default');
     * if (sound) {
     *     console.log(`Selected: ${sound}`);
     * }
     * ```
     */
    public async pickFromPack(packId: string): Promise<string | null> {
        const packPath = path.join(this.packDir, packId);
        if (!(await this.fileExists(packPath))) {
            return null;
        }
        const files = await this.listAudioFiles(packPath);
        if (files.length === 0) {
            return null;
        }
        return files[Math.floor(Math.random() * files.length)];
    }

    /**
     * List all audio files in a directory.
     * 
     * Scans the directory for files with audio extensions (.mp3, .wav, .ogg, .flac, .m4a, .aac)
     * and returns their full paths.
     * 
     * @param dir - Directory path to scan
     * @returns Array of full paths to audio files
     * @private
     */
    private async listAudioFiles(dir: string): Promise<string[]> {
        try {
            const files = await fs.promises.readdir(dir);
            return files
                .filter(f => /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(f))
                .map(f => path.join(dir, f));
        } catch (error) {
            this.logger.error(`Failed to list audio files in ${dir}`, error);
            return [];
        }
    }

    /**
     * Convert a string to title case.
     * 
     * Replaces hyphens and underscores with spaces and capitalizes the first letter
     * of each word. Used for displaying pack names in the UI.
     * 
     * @param str - String to convert
     * @returns Title-cased string
     * @private
     * 
     * @example
     * ```typescript
     * titleCase('my-sound-pack') // Returns: 'My Sound Pack'
     * titleCase('default_sounds') // Returns: 'Default Sounds'
     * ```
     */
    private titleCase(str: string): string {
        return str.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
}
