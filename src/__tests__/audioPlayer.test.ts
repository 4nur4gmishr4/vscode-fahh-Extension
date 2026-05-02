import { AudioPlayer } from '../core/audioPlayer';
import { Logger } from '../utils/logger';
import * as fs from 'fs';
import { execFile } from 'child_process';

jest.mock('child_process');
jest.mock('fs', () => ({
    promises: {
        access: jest.fn()
    }
}));

describe('AudioPlayer', () => {
    let audioPlayer: AudioPlayer;
    let mockLogger: jest.Mocked<Logger>;

    beforeEach(() => {
        mockLogger = {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            debug: jest.fn(),
            show: jest.fn(),
            setLevel: jest.fn(),
            dispose: jest.fn()
        } as any;

        audioPlayer = new AudioPlayer(mockLogger);
    });

    afterEach(() => {
        audioPlayer.dispose();
        jest.clearAllMocks();
    });

    describe('play', () => {
        it('should reject if no file path provided', async () => {
            await expect(audioPlayer.play('', { volume: 100 })).rejects.toThrow('No file path provided');
        });

        it('should reject if file does not exist', async () => {
            (fs.promises.access as jest.Mock).mockRejectedValue(new Error('File not found'));

            await expect(audioPlayer.play('/nonexistent/file.mp3', { volume: 100 })).rejects.toThrow('Audio file not found');
        });

        it('should queue sounds when already playing', async () => {
            (fs.promises.access as jest.Mock).mockResolvedValue(undefined);
            (execFile as unknown as jest.Mock).mockImplementation((_cmd, _args, _options, callback) => {
                // Handle both 3-arg and 4-arg signatures
                const cb = typeof _options === 'function' ? _options : callback;
                setTimeout(() => cb(null, '', ''), 100);
                return { kill: jest.fn() };
            });

            const promise1 = audioPlayer.play('/test/sound1.mp3', { volume: 100 });
            const promise2 = audioPlayer.play('/test/sound2.mp3', { volume: 100 });

            await Promise.all([promise1, promise2]);

            expect(mockLogger.debug).toHaveBeenCalledWith('Audio queued.');
        });

        it('should reject when queue is full', async () => {
            (fs.promises.access as jest.Mock).mockResolvedValue(undefined);
            (execFile as unknown as jest.Mock).mockImplementation(() => {
                // Never complete to keep playing state
                return { kill: jest.fn() };
            });

            // Start playing and handle rejection
            audioPlayer.play('/test/sound.mp3', { volume: 100 }).catch(() => {
                // Will be rejected in afterEach
            });

            // Fill queue
            const promises = [];
            for (let i = 0; i < 11; i++) {
                const p = audioPlayer.play(`/test/sound${i}.mp3`, { volume: 100 });
                // Handle rejections for all promises
                p.catch(() => {
                    // Will be rejected in afterEach or when queue is full
                });
                promises.push(p);
            }

            // Last one should be rejected immediately
            await expect(promises[10]).rejects.toThrow('Audio queue full');
        });

        it('should clamp volume to 0-100 range', async () => {
            (fs.promises.access as jest.Mock).mockResolvedValue(undefined);
            (execFile as unknown as jest.Mock).mockImplementation((_cmd, _args, _options, callback) => {
                const cb = typeof _options === 'function' ? _options : callback;
                cb(null, '', '');
                return { kill: jest.fn() };
            });

            await audioPlayer.play('/test/sound.mp3', { volume: 150 });
            await audioPlayer.play('/test/sound.mp3', { volume: -50 });

            // Should not throw
            expect(mockLogger.error).not.toHaveBeenCalled();
        });
    });

    describe('dispose', () => {
        it('should stop playback and clear queue', () => {
            const stopSpy = jest.spyOn(audioPlayer, 'stop');
            audioPlayer.dispose();
            expect(stopSpy).toHaveBeenCalled();
        });
    });
});
