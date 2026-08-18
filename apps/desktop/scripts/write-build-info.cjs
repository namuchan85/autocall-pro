/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

function safeExec(cmd) {
  try {
    return cp
      .execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

const rootDir = path.join(__dirname, '..', '..', '..');
const desktopPkgPath = path.join(rootDir, 'apps', 'desktop', 'package.json');
const desktopPkg = JSON.parse(fs.readFileSync(desktopPkgPath, 'utf8'));

const gitSha = safeExec('git rev-parse --short HEAD') || 'unknown';
const buildAt = new Date().toISOString();

// dist is emitted by `tsc -p tsconfig.json` (apps/desktop -> dist/*)
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  // If dist doesn't exist yet, fail loudly so CI/build doesn't silently ship stale artifacts.
  throw new Error(`Desktop dist folder not found: ${distDir}`);
}

const outPath = path.join(distDir, 'build-info.json');
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      buildAt,
      gitSha,
      version: desktopPkg.version,
    },
    null,
    2,
  ),
  'utf8',
);

console.log(`Wrote ${outPath}`);
