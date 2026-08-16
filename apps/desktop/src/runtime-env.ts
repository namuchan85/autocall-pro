import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { discoverAdbPath } from './adb-discover';

const DEFAULT_ADMIN_PASSWORD = 'AutoCall1!';

interface SecretsFile {
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  adminPassword: string;
}

export interface DesktopRuntime {
  userDataDir: string;
  dataDir: string;
  logDir: string;
  databaseUrl: string;
  settingsPath: string;
  env: NodeJS.ProcessEnv;
}

export function createDesktopRuntime(): DesktopRuntime {
  const userDataDir = app.getPath('userData');
  const dataDir = path.join(userDataDir, 'data');
  const logDir = path.join(userDataDir, 'logs');
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(logDir, { recursive: true });

  const secrets = readOrCreateSecrets(path.join(userDataDir, 'secrets.json'));
  const settingsPath = path.join(userDataDir, 'settings.json');
  const databaseUrl = `file:${path.join(dataDir, 'autocall.db')}`;
  const discoveredAdb = discoverAdbPath();
  ensureDefaultSettings(settingsPath, discoveredAdb);

  return {
    userDataDir,
    dataDir,
    logDir,
    databaseUrl,
    settingsPath,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      SETTINGS_PATH: settingsPath,
      JWT_ACCESS_SECRET: secrets.jwtAccessSecret,
      JWT_REFRESH_SECRET: secrets.jwtRefreshSecret,
      SEED_ADMIN_PASSWORD: secrets.adminPassword,
      FRONTEND_URL: 'http://127.0.0.1:3000',
      COOKIE_SECURE: 'false',
      NODE_ENV: app.isPackaged ? 'production' : 'development',
      PORT: '3001',
      TRUST_PROXY: 'false',
      ADB_PATH: process.env.ADB_PATH || discoveredAdb,
    },
  };
}

function readOrCreateSecrets(filePath: string): SecretsFile {
  if (existsSync(filePath)) {
    const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
    if (isSecretsFile(parsed)) {
      return parsed;
    }
  }
  const created: SecretsFile = {
    jwtAccessSecret: randomBytes(32).toString('hex'),
    jwtRefreshSecret: randomBytes(32).toString('hex'),
    adminPassword: DEFAULT_ADMIN_PASSWORD,
  };
  writeFileSync(filePath, `${JSON.stringify(created, null, 2)}\n`, 'utf8');
  return created;
}

function ensureDefaultSettings(filePath: string, adbPath: string): void {
  if (existsSync(filePath) || !adbPath) {
    return;
  }
  writeFileSync(filePath, `${JSON.stringify({ adbPath, adbDeviceId: '' }, null, 2)}\n`, 'utf8');
}

function isSecretsFile(value: unknown): value is SecretsFile {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.jwtAccessSecret === 'string' &&
    record.jwtAccessSecret.length >= 32 &&
    typeof record.jwtRefreshSecret === 'string' &&
    record.jwtRefreshSecret.length >= 32 &&
    typeof record.adminPassword === 'string' &&
    record.adminPassword.length > 0
  );
}
