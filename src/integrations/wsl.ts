import * as fs from 'fs';
import { execFile } from 'child_process';

let cachedIsWSL: boolean | undefined;
const wslPathCache = new Map<string, string>();

/**
 * Detects if the current environment is running under Windows Subsystem for Linux (WSL).
 * 
 * This function checks the kernel OS release information to determine if the code is
 * running in a WSL environment. The result is cached after the first check for performance.
 * 
 * @returns A promise that resolves to true if running under WSL, false otherwise
 * 
 * @example
 * ```typescript
 * if (await isWSL()) {
 *   console.log('Running in WSL environment');
 * }
 * ```
 */
export async function isWSL(): Promise<boolean> {
    if (cachedIsWSL !== undefined) {
        return cachedIsWSL;
    }
    if (process.platform !== 'linux') {
        cachedIsWSL = false;
        return false;
    }
    try {
        const release: string = await fs.promises.readFile('/proc/sys/kernel/osrelease', 'utf8');
        cachedIsWSL = release.toLowerCase().includes('microsoft');
    } catch {
        cachedIsWSL = false;
    }
    return cachedIsWSL;
}

/**
 * Converts a WSL (Linux) path to its equivalent Windows path.
 * 
 * This function handles two conversion strategies:
 * 1. Direct conversion for /mnt/ paths (e.g., /mnt/c/Users -> C:\Users)
 * 2. Using the wslpath utility for other paths
 * 
 * Results are cached to improve performance for repeated conversions.
 * 
 * @param wslPath - The WSL/Linux path to convert (e.g., "/mnt/c/Users/file.txt")
 * @returns A promise that resolves to the Windows path (e.g., "C:\Users\file.txt")
 * 
 * @example
 * ```typescript
 * const windowsPath = await convertWSLPathToWindows('/mnt/c/Users/Documents/file.txt');
 * // Returns: "C:\Users\Documents\file.txt"
 * ```
 */
export async function convertWSLPathToWindows(wslPath: string): Promise<string> {
    const cached: string | undefined = wslPathCache.get(wslPath);
    if (cached !== undefined) {
        return cached;
    }
    const result: string = await computeWindowsPath(wslPath);
    wslPathCache.set(wslPath, result);
    return result;
}

/**
 * Internal helper function that performs the actual path conversion.
 * 
 * Attempts to convert a WSL path to Windows format using two methods:
 * 1. Pattern matching for /mnt/ paths (fast, synchronous)
 * 2. Executing wslpath utility (slower, handles edge cases)
 * 
 * @param wslPath - The WSL path to convert
 * @returns A promise that resolves to the Windows path, or the original path if conversion fails
 * 
 * @internal
 */
function computeWindowsPath(wslPath: string): Promise<string> {
    return new Promise<string>((resolve) => {
        // Convert /mnt/c/Users/... to C:\Users\...
        const mntMatch: RegExpMatchArray | null = wslPath.match(/^\/mnt\/([a-z])\//i);
        if (mntMatch) {
            const drive: string = mntMatch[1].toUpperCase();
            return resolve(`${drive}:${wslPath.slice(6)}`.replace(/\//g, '\\'));
        }
        execFile('wslpath', ['-w', wslPath], {
            encoding: 'utf8'
        }, (err, stdout) => {
            if (err) {
                return resolve(wslPath);
            }
            resolve(stdout.trim());
        });
    });
}
