import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

describe('Electron security', () => {
  it('keeps renderer isolation settings', () => {
    const source = readFileSync(path.join(__dirname, 'main.js'), 'utf8');
    assert.match(source, /nodeIntegration:\s*false/);
    assert.match(source, /contextIsolation:\s*true/);
    assert.match(source, /sandbox:\s*true/);
  });

  it('requests a single instance lock before starting child processes', () => {
    const source = readFileSync(path.join(__dirname, 'main.js'), 'utf8');
    assert.match(source, /requestSingleInstanceLock/);
    assert.match(source, /showOpenDialog\(window/);
    assert.match(source, /isTrustedIpcSender/);
  });

  it('exposes only the ADB path picker from preload', () => {
    const source = readFileSync(path.join(__dirname, 'preload.js'), 'utf8');
    assert.match(source, /pick-adb-path/);
    assert.match(source, /exposeInMainWorld/);
    assert.equal(source.includes('execFile'), false);
    assert.equal(source.includes('child_process'), false);
  });
});
