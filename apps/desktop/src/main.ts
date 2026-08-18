import { app, BrowserWindow, Menu, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { FRONTEND_ORIGIN, isAllowedFrontendUrl } from './frontend-url';
import { isTrustedIpcSender } from './ipc-sender';
import { DesktopProcessManager } from './process-manager';
import { createDesktopRuntime } from './runtime-env';
import { focusExistingWindow, shouldQuitForSecondInstance } from './single-instance';

const WINDOW_TITLE = 'AutoCall Lite';
const processes = new DesktopProcessManager();
let mainWindow: BrowserWindow | undefined;
let isShuttingDown = false;

function loadDesktopBuildInfo(): { buildAt: string; gitSha: string; version: string } {
  try {
    const candidate = path.join(__dirname, 'build-info.json');
    const raw = readFileSync(candidate, 'utf8');
    const parsed = JSON.parse(raw) as { buildAt: string; gitSha: string; version: string };
    return parsed;
  } catch {
    return { buildAt: 'unknown', gitSha: 'unknown', version: '0.0.0' };
  }
}

function renderStartingHtml(desktopBuildInfo: {
  buildAt: string;
  gitSha: string;
  version: string;
}): string {
  const desktopLine = `${desktopBuildInfo.version} · ${desktopBuildInfo.gitSha} · ${desktopBuildInfo.buildAt}`;
  return `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'" />
    <title>AutoCall Lite</title>
    <style>
      body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; font-family:Segoe UI,sans-serif; background:#0f172a; color:#e2e8f0; }
      main { max-width:36rem; padding:2rem; text-align:center; }
    </style>
  </head>
  <body><main><h1>AutoCall Lite를 시작하는 중입니다.</h1><p>로컬 서비스가 준비되면 화면이 바뀝니다.</p><p style="margin-top:1rem;opacity:.85;font-size:.9rem">${desktopLine}</p></main></body>
</html>`;
}

const STARTING_DESKTOP_BUILD_INFO = loadDesktopBuildInfo();
const STARTING_HTML = renderStartingHtml(STARTING_DESKTOP_BUILD_INFO);

function applyWebContentsGuards(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', (event, url) => {
      if (!isAllowedFrontendUrl(url)) {
        event.preventDefault();
      }
    });
    contents.on('will-redirect', (event, url) => {
      if (!isAllowedFrontendUrl(url)) {
        event.preventDefault();
      }
    });
  });
}

async function createMainWindow(): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    title: WINDOW_TITLE,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  window.on('page-title-updated', (event) => {
    event.preventDefault();
  });
  window.setTitle(WINDOW_TITLE);
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(STARTING_HTML)}`);
  return window;
}

function isTrustedPickAdbSender(event: IpcMainInvokeEvent, window: BrowserWindow): boolean {
  const frame = event.senderFrame;
  return isTrustedIpcSender({
    senderUrl: frame?.url,
    isMainFrame: Boolean(frame && frame === event.sender.mainFrame),
    senderWebContentsId: event.sender.id,
    mainWindowWebContentsId: window.webContents.id,
  });
}

async function bootstrap(): Promise<void> {
  app.setName(WINDOW_TITLE);
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.autocall.lite');
  }

  applyWebContentsGuards();
  Menu.setApplicationMenu(null);
  ipcMain.handle('pick-adb-path', async (event) => {
    const window = mainWindow;
    if (!window || window.isDestroyed() || !isTrustedPickAdbSender(event, window)) {
      return '';
    }
    const result = await dialog.showOpenDialog(window, {
      title: 'adb.exe 선택',
      properties: ['openFile'],
      filters: [{ name: 'adb', extensions: ['exe'] }],
    });
    return result.canceled ? '' : (result.filePaths[0] ?? '');
  });

  ipcMain.handle('desktop-build-info', async () => {
    return loadDesktopBuildInfo();
  });

  await app.whenReady();
  mainWindow = await createMainWindow();
  try {
    const runtime = createDesktopRuntime();
    await processes.start(runtime);
    await mainWindow.loadURL(FRONTEND_ORIGIN);
  } catch (error) {
    await processes.stop();
    const message = error instanceof Error ? error.message : '서비스를 시작하지 못했습니다.';
    const logHint = '로그: %APPDATA%\\AutoCall Lite\\logs\\';
    await mainWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(
        `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"/><title>AutoCall Lite</title></head><body style="font-family:Segoe UI;background:#0f172a;color:#e2e8f0;padding:2rem"><h1>AutoCall Lite를 시작하지 못했습니다.</h1><p>${message}</p><p>${logHint}</p></body></html>`,
      )}`,
    );
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow().then((window) => {
        mainWindow = window;
      });
    }
  });
}

async function shutdownAndQuit(): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  await processes.stop();
  app.quit();
}

const gotLock = app.requestSingleInstanceLock();
if (shouldQuitForSecondInstance(gotLock)) {
  app.quit();
} else {
  app.on('second-instance', () => {
    focusExistingWindow(mainWindow ?? null);
  });

  app.on('before-quit', (event) => {
    if (isShuttingDown) {
      return;
    }
    event.preventDefault();
    void shutdownAndQuit();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      void shutdownAndQuit();
    }
  });

  void bootstrap();
}
