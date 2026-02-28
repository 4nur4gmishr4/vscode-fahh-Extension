import { execFile } from 'child_process';

let playing = false;

export function playAudio(filePath: string): void {
    if (playing) {
        return;
    }
    playing = true;

    const done = () => { playing = false; };

    switch (process.platform) {
        case 'win32': {
            const script = [
                'Add-Type -AssemblyName PresentationCore',
                `$p = New-Object System.Windows.Media.MediaPlayer`,
                `$p.Open([Uri]'${filePath.replace(/'/g, "''")}')`,
                `$p.Play()`,
                `Start-Sleep -Milliseconds 300`,
                `while ($p.Position -lt $p.NaturalDuration.TimeSpan) { Start-Sleep -Milliseconds 100 }`,
                `$p.Close()`
            ].join('; ');
            execFile('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', script], done);
            break;
        }
        case 'darwin':
            execFile('afplay', [filePath], done);
            break;
        default:
            execFile('ffplay', ['-nodisp', '-autoexit', '-loglevel', 'quiet', filePath], done);
            break;
    }
}
