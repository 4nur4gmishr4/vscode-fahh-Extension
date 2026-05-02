import * as fs from 'fs';
import * as path from 'path';
import { WelcomePanel } from './welcome';

const CLIENT_SCRIPT_PATH = path.resolve(__dirname, '..', '..', 'resources', 'welcome-client.js');

interface FahhWelcomeApi {
    triggerTest(): void;
    triggerReset(): void;
}

interface WelcomeWindow extends Window {
    __fahhWelcome?: FahhWelcomeApi;
}

function loadClientScript(): void {
    const source = fs.readFileSync(CLIENT_SCRIPT_PATH, 'utf8');
    const script = document.createElement('script');
    script.textContent = source;
    document.body.appendChild(script);
}

function bootstrapPanel(): void {
    WelcomePanel.createOrShow({
        path: '/test/path',
        fsPath: '/test/path',
        scheme: 'file'
    } as never);
    const panel = WelcomePanel.currentPanel as unknown as { _panel: { webview: { html: string } } };
    document.body.innerHTML = panel._panel.webview.html;
    loadClientScript();
}

function getWelcomeApi(): FahhWelcomeApi {
    const api = (window as WelcomeWindow).__fahhWelcome;
    if (!api) {
        throw new Error('welcome-client.js did not expose window.__fahhWelcome');
    }
    return api;
}

describe('WelcomePanel webview', () => {
    let mockPostMessage: jest.Mock;
    let confirmMock: jest.Mock;

    beforeEach(() => {
        mockPostMessage = jest.fn();
        confirmMock = jest.fn(() => true);
        (global as unknown as { acquireVsCodeApi: () => { postMessage: jest.Mock } }).acquireVsCodeApi = () => ({
            postMessage: mockPostMessage
        });
        (global as unknown as { confirm: jest.Mock }).confirm = confirmMock;
        window.HTMLAudioElement.prototype.play = jest.fn(() => Promise.resolve());

        bootstrapPanel();
    });

    afterEach(() => {
        WelcomePanel.currentPanel?.dispose();
        delete (window as WelcomeWindow).__fahhWelcome;
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    it('renders required structural elements', () => {
        expect(document.getElementById('reset-btn')).not.toBeNull();
        expect(document.getElementById('test-btn')).not.toBeNull();
        expect(document.getElementById('fahh-audio')).not.toBeNull();
        expect(document.getElementById('visualizer')).not.toBeNull();
    });

    it('plays the bundled audio when the test button is clicked', () => {
        const playMock = jest
            .spyOn(window.HTMLAudioElement.prototype, 'play')
            .mockResolvedValue(undefined);

        getWelcomeApi().triggerTest();

        expect(playMock).toHaveBeenCalledTimes(1);
        expect(mockPostMessage).not.toHaveBeenCalledWith(expect.objectContaining({ command: 'error' }));
    });

    it('asks for confirmation and posts reset when accepted', () => {
        confirmMock.mockReturnValueOnce(true);

        getWelcomeApi().triggerReset();

        expect(confirmMock).toHaveBeenCalledWith(
            'Are you sure you want to reset all user preferences to their default values?'
        );
        expect(mockPostMessage).toHaveBeenCalledWith({ command: 'reset' });
    });

    it('does not post reset when confirmation is denied', () => {
        confirmMock.mockReturnValueOnce(false);

        getWelcomeApi().triggerReset();

        expect(confirmMock).toHaveBeenCalled();
        expect(mockPostMessage).not.toHaveBeenCalledWith({ command: 'reset' });
    });
});
