import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { parseSecrets, readOrCreateSecrets } from './secrets-file';

describe('secrets-file', () => {
  it('stores JWT secrets without an admin password', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'autocall-secrets-'));
    try {
      const filePath = path.join(dir, 'secrets.json');
      const created = readOrCreateSecrets(filePath);
      const stored = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
      assert.equal(created.jwtAccessSecret.length >= 32, true);
      assert.equal(Object.hasOwn(stored, 'adminPassword'), false);
      assert.equal(JSON.stringify(stored).includes('AutoCall1!'), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('strips a legacy plaintext adminPassword and keeps JWT secrets', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'autocall-secrets-'));
    try {
      const filePath = path.join(dir, 'secrets.json');
      writeFileSync(
        filePath,
        JSON.stringify({
          jwtAccessSecret: 'a'.repeat(32),
          jwtRefreshSecret: 'b'.repeat(32),
          adminPassword: 'AutoCall1!',
        }),
        'utf8',
      );
      const secrets = readOrCreateSecrets(filePath);
      const stored = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
      assert.equal(secrets.jwtAccessSecret, 'a'.repeat(32));
      assert.equal(Object.hasOwn(stored, 'adminPassword'), false);
      assert.equal(JSON.stringify(stored).includes('AutoCall1!'), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects incomplete JWT secrets', () => {
    assert.equal(
      parseSecrets({ jwtAccessSecret: 'short', jwtRefreshSecret: 'b'.repeat(32) }),
      null,
    );
  });
});
