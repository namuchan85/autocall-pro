import { existsSync } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export function discoverCompanionApkPath(): string {
  const packaged = path.join(process.resourcesPath, 'companion', 'AutoCall Companion.apk');
  const candidates = [
    process.env.COMPANION_APK_PATH ?? '',
    packaged,
    path.join(
      app.getAppPath(),
      '..',
      '..',
      'android-companion',
      'app',
      'build',
      'outputs',
      'apk',
      'release',
      'app-release.apk',
    ),
    path.join(
      process.cwd(),
      'apps',
      'android-companion',
      'app',
      'build',
      'outputs',
      'apk',
      'release',
      'app-release.apk',
    ),
    path.join(
      process.cwd(),
      'apps',
      'android-companion',
      'app',
      'build',
      'outputs',
      'apk',
      'debug',
      'app-debug.apk',
    ),
  ];
  return candidates.find((candidate) => candidate.length > 0 && existsSync(candidate)) ?? '';
}
