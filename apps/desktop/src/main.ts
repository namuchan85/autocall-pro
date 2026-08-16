import { app, BrowserWindow, Menu } from 'electron';
import path from 'node:path';
import { FRONTEND_ORIGIN, isAllowedFrontendUrl } from './frontend-url';

const WINDOW_TITLE = 'AutoCall Lite';
const FRONTEND_PROBE_TIMEOUT_MS = 2000;

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'" />
    <title>AutoCall Lite</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: Segoe UI, sans-serif;
        background: #0f172a;
        color: #e2e8f0;
      }
      main {
        max-width: 36rem;
        padding: 2rem;
        text-align: center;
      }
      h1 {
        font-size: 1.25rem;
        font-weight: 600;
      }
      p {
        color: #94a3b8;
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>AutoCall Lite frontend is not running.</h1>
      <p>Next.js를 http://127.0.0.1:3000 에서 먼저 실행한 뒤 Electron을 다시 시작하세요.</p>
    </main>
  </body>
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

async function isFrontendReachable(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FRONTEND_PROBE_TIMEOUT_MS);

  try {
    await fetch(FRONTEND_ORIGIN, { signal: controller.signal, redirect: 'manual' });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function createMainWindow(): Promise<void> {
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

  const frontendReady = await isFrontendReachable();
  if (frontendReady) {
    await window.loadURL(FRONTEND_ORIGIN);
    return;
  }

  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(OFFLINE_HTML)}`);
}

async function bootstrap(): Promise<void> {
  app.setName(WINDOW_TITLE);
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.autocall.lite');
  }

  applyWebContentsGuards();
  Menu.setApplicationMenu(null);

  await app.whenReady();
  await createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

void bootstrap();
