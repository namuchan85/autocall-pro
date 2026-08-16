import { spawn, type ChildProcess } from 'node:child_process';
import { appendFileSync, createWriteStream, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { DesktopRuntime } from './runtime-env';

const BACKEND_URL = 'http://127.0.0.1:3001/health';
const FRONTEND_URL = 'http://127.0.0.1:3000';

export class DesktopProcessManager {
  private backend: ChildProcess | undefined;
  private frontend: ChildProcess | undefined;

  async start(runtime: DesktopRuntime): Promise<void> {
    mkdirSync(runtime.logDir, { recursive: true });
    appendFileSync(path.join(runtime.logDir, 'app.log'), `${new Date().toISOString()} app start\n`);

    this.backend = this.spawnNode(this.backendEntry(), runtime.env, this.backendCwd());
    this.attachLog(this.backend, path.join(runtime.logDir, 'backend.log'));
    this.frontend = this.spawnFrontend(runtime.env);
    this.attachLog(this.frontend, path.join(runtime.logDir, 'frontend.log'));
    await Promise.all([waitForUrl(BACKEND_URL, 45_000), waitForUrl(FRONTEND_URL, 120_000)]);
  }

  stop(): void {
    stopChild(this.frontend);
    stopChild(this.backend);
    this.frontend = undefined;
    this.backend = undefined;
  }

  private spawnFrontend(env: NodeJS.ProcessEnv): ChildProcess {
    if (app.isPackaged) {
      return this.spawnNode(
        this.frontendEntry(),
        { ...env, PORT: '3000', HOSTNAME: '127.0.0.1' },
        this.frontendCwd(),
      );
    }
    return spawn(process.execPath, [this.nextBin(), 'dev', '-H', '127.0.0.1', '-p', '3000'], {
      cwd: this.frontendCwd(),
      env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: 'pipe',
      windowsHide: true,
    });
  }

  private spawnNode(entry: string, env: NodeJS.ProcessEnv, cwd: string): ChildProcess {
    return spawn(process.execPath, [entry], {
      cwd,
      env: {
        ...env,
        ELECTRON_RUN_AS_NODE: '1',
        NODE_PATH: app.isPackaged ? this.packagedNodePath() : env.NODE_PATH,
      },
      stdio: 'pipe',
      windowsHide: true,
    });
  }

  private packagedNodePath(): string {
    return [
      path.join(process.resourcesPath, 'node_modules'),
      path.join(process.resourcesPath, 'frontend', 'node_modules'),
    ].join(path.delimiter);
  }

  private attachLog(child: ChildProcess, logFile: string): void {
    const stream = createWriteStream(logFile, { flags: 'a' });
    child.stdout?.pipe(stream);
    child.stderr?.pipe(stream);
    child.once('close', () => {
      stream.end();
    });
  }

  private repoRoot(): string {
    return path.resolve(__dirname, '../../..');
  }

  private backendEntry(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'backend/dist/src/main.js');
    }
    return path.join(this.repoRoot(), 'apps/backend/dist/src/main.js');
  }

  private backendCwd(): string {
    if (app.isPackaged) {
      return process.resourcesPath;
    }
    return path.join(this.repoRoot(), 'apps/backend');
  }

  private frontendEntry(): string {
    return path.join(process.resourcesPath, 'frontend/apps/frontend/server.js');
  }

  private frontendCwd(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'frontend/apps/frontend');
    }
    return path.join(this.repoRoot(), 'apps/frontend');
  }

  private nextBin(): string {
    const candidate = path.join(this.repoRoot(), 'node_modules/next/dist/bin/next');
    if (!existsSync(candidate)) {
      throw new Error('Next.js binary was not found');
    }
    return candidate;
  }
}

async function waitForUrl(url: string, timeoutMs: number): Promise<void> {
  const started = Date.now();
  let lastError = 'timeout';
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.ok || response.status === 307 || response.status === 308) {
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'unreachable';
    }
    await delay(500);
  }
  throw new Error(`Service was not ready: ${url} (${lastError})`);
}

function stopChild(child: ChildProcess | undefined): void {
  if (!child?.pid) {
    return;
  }
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    return;
  }
  child.kill('SIGTERM');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
