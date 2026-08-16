import { spawn } from 'node:child_process';

export interface ManagedChild {
  pid?: number;
  exitCode?: number | null;
  once(event: 'exit', listener: (code: number | null) => void): void;
  kill(signal?: NodeJS.Signals): boolean;
}

export interface SequentialStartDeps<TChild> {
  startBackend: () => TChild;
  startFrontend: () => TChild;
  waitUntilReady: (name: 'backend' | 'frontend', child: TChild) => Promise<void>;
  stop: (child: TChild | undefined) => Promise<void>;
}

export async function startBackendThenFrontend<TChild>(
  deps: SequentialStartDeps<TChild>,
): Promise<{ backend: TChild; frontend: TChild }> {
  const backend = deps.startBackend();
  try {
    await deps.waitUntilReady('backend', backend);
  } catch (error) {
    await deps.stop(backend);
    throw error;
  }

  const frontend = deps.startFrontend();
  try {
    await deps.waitUntilReady('frontend', frontend);
  } catch (error) {
    await deps.stop(frontend);
    await deps.stop(backend);
    throw error;
  }

  return { backend, frontend };
}

export async function stopProcessTree(
  child: ManagedChild | undefined,
  options: {
    platform: NodeJS.Platform;
    log: (message: string) => void;
    taskkill?: (pid: number) => Promise<number | null>;
    timeoutMs?: number;
  },
): Promise<void> {
  if (!child?.pid) {
    return;
  }
  if (child.exitCode !== null && child.exitCode !== undefined) {
    return;
  }

  const pid = child.pid;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const exited = waitForExit(child, timeoutMs);

  try {
    if (options.platform === 'win32') {
      const exitCode = await (options.taskkill ?? runTaskkill)(pid);
      if (exitCode !== 0 && exitCode !== 128 && exitCode !== 1) {
        options.log(`taskkill pid ${pid} exited with code ${String(exitCode)}`);
      }
    } else {
      child.kill('SIGTERM');
    }
  } catch (error) {
    options.log(
      `failed to stop pid ${pid}: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    try {
      child.kill('SIGKILL');
    } catch {
      // Child may already be gone.
    }
  }

  const result = await exited;
  if (!result.exited) {
    options.log(`child pid ${pid} did not exit after stop request`);
  }
}

export function runTaskkill(pid: number): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    killer.once('error', reject);
    killer.once('exit', (code) => {
      resolve(code);
    });
  });
}

function waitForExit(child: ManagedChild, timeoutMs: number): Promise<{ exited: boolean }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ exited: false });
    }, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve({ exited: true });
    });
  });
}
