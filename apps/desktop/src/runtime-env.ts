import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { discoverAdbPath } from './adb-discover';
import { discoverCompanionApkPath } from './companion-apk-discover';
import { readOrCreateSecrets } from './secrets-file';

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

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    SETTINGS_PATH: settingsPath,
    JWT_ACCESS_SECRET: secrets.jwtAccessSecret,
    JWT_REFRESH_SECRET: secrets.jwtRefreshSecret,
    FRONTEND_URL: 'http://127.0.0.1:3000',
    COOKIE_SECURE: 'false',
    NODE_ENV: app.isPackaged ? 'production' : 'development',
    PORT: '3001',
    TRUST_PROXY: 'false',
    ADB_PATH: process.env.ADB_PATH || discoveredAdb,
    COMPANION_APK_PATH: process.env.COMPANION_APK_PATH || discoverCompanionApkPath(),
  };
  delete env.SEED_ADMIN_PASSWORD;

  return {
    userDataDir,
    dataDir,
    logDir,
    databaseUrl,
    settingsPath,
    env,
  };
}

function ensureDefaultSettings(filePath: string, adbPath: string): void {
  if (existsSync(filePath) || !adbPath) {
    return;
  }
  writeFileSync(filePath, `${JSON.stringify({ adbPath, adbDeviceId: '' }, null, 2)}\n`, 'utf8');
}
