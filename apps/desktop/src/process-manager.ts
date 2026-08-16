import { spawn, type ChildProcess } from 'node:child_process';
import { appendFileSync, createWriteStream, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { startBackendThenFrontend, stopProcessTree } from './process-lifecycle';
import type { DesktopRuntime } from './runtime-env';

const BACKEND_URL = 'http://127.0.0.1:3001/health';
const FRONTEND_URL = 'http://127.0.0.1:3000';

export class DesktopProcessManager {
  private backend: ChildProcess | undefined;
  private frontend: ChildProcess | undefined;
  private backendExitCode: number | null = null;
  private frontendExitCode: number | null = null;
  private logDir: string | undefined;
  private stopping: Promise<void> | undefined;

  async start(runtime: DesktopRuntime): Promise<void> {
    this.logDir = runtime.logDir;
    mkdirSync(runtime.logDir, { recursive: true });
    this.appendLog('app start');

    this.backendExitCode = null;
    this.frontendExitCode = null;

    const started = await startBackendThenFrontend({
      startBackend: () => {
        this.backend = this.spawnNode(this.backendEntry(), runtime.env, this.backendCwd());
        this.backend.once('exit', (code) => {
          this.backendExitCode = code ?? 1;
        });
        this.attachLog(this.backend, path.join(runtime.logDir, 'backend.log'));
        return this.backend;
      },
      startFrontend: () => {
        this.frontend = this.spawnFrontend(runtime.env);
        this.frontend.once('exit', (code) => {
          this.frontendExitCode = code ?? 1;
        });
        this.attachLog(this.frontend, path.join(runtime.logDir, 'frontend.log'));
        return this.frontend;
      },
      waitUntilReady: (name) => this.waitForService(name),
      stop: (child) => this.stopOne(child),
    });
    this.backend = started.backend;
    this.frontend = started.frontend;
  }

  async stop(): Promise<void> {
    if (this.stopping) {
      return this.stopping;
    }
    this.stopping = this.stopAll();
    try {
      await this.stopping;
    } finally {
      this.stopping = undefined;
    }
  }

  private async stopAll(): Promise<void> {
    const frontend = this.frontend;
    const backend = this.backend;
    await this.stopOne(frontend);
    await this.stopOne(backend);
    if (this.frontend === frontend) {
      this.frontend = undefined;
    }
    if (this.backend === backend) {
      this.backend = undefined;
    }
  }

  private async stopOne(child: ChildProcess | undefined): Promise<void> {
    await stopProcessTree(child, {
      platform: process.platform,
      log: (message) => this.appendLog(message),
    });
  }

  private async waitForService(name: 'backend' | 'frontend'): Promise<void> {
    const url = name === 'backend' ? BACKEND_URL : FRONTEND_URL;
    const timeoutMs = name === 'backend' ? 45_000 : 120_000;
    const started = Date.now();
    let lastError = 'timeout';
    while (Date.now() - started < timeoutMs) {
      const exitCode = name === 'backend' ? this.backendExitCode : this.frontendExitCode;
      if (exitCode !== null) {
        throw new Error(`${name} exited before it became ready (code ${exitCode})`);
      }
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
      path.join(process.resourcesPath, 'frontend', 'node_modules'),
      path.join(process.resourcesPath, 'node_modules'),
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

  private appendLog(message: string): void {
    if (!this.logDir) {
      return;
    }
    appendFileSync(path.join(this.logDir, 'app.log'), `${new Date().toISOString()} ${message}\n`);
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
      return path.join(process.resourcesPath, 'frontend');
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
