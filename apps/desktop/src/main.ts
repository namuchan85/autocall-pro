import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { FRONTEND_ORIGIN, isAllowedFrontendUrl } from './frontend-url';
import { DesktopProcessManager } from './process-manager';
import { createDesktopRuntime } from './runtime-env';

const WINDOW_TITLE = 'AutoCall Lite';
const processes = new DesktopProcessManager();

const STARTING_HTML = `<!DOCTYPE html>
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
  <body><main><h1>AutoCall Lite를 시작하는 중입니다.</h1><p>로컬 서비스가 준비되면 화면이 바뀝니다.</p></main></body>
</html>`;

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

async function bootstrap(): Promise<void> {
  app.setName(WINDOW_TITLE);
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.autocall.lite');
  }

  applyWebContentsGuards();
  Menu.setApplicationMenu(null);
  ipcMain.handle('pick-adb-path', async () => {
    const result = await dialog.showOpenDialog({
      title: 'adb.exe 선택',
      properties: ['openFile'],
      filters: [{ name: 'adb', extensions: ['exe'] }],
    });
    return result.canceled ? '' : (result.filePaths[0] ?? '');
  });

  await app.whenReady();
  const window = await createMainWindow();
  try {
    const runtime = createDesktopRuntime();
    await processes.start(runtime);
    await window.loadURL(FRONTEND_ORIGIN);
  } catch (error) {
    const message = error instanceof Error ? error.message : '서비스를 시작하지 못했습니다.';
    const logHint = '로그: %APPDATA%\\AutoCall Lite\\logs\\';
    await window.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(
        `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"/><title>AutoCall Lite</title></head><body style="font-family:Segoe UI;background:#0f172a;color:#e2e8f0;padding:2rem"><h1>AutoCall Lite를 시작하지 못했습니다.</h1><p>${message}</p><p>${logHint}</p></body></html>`,
      )}`,
    );
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
}

app.on('before-quit', () => {
  processes.stop();
});

app.on('window-all-closed', () => {
  processes.stop();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

void bootstrap();
