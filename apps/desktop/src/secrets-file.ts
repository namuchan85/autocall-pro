import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export interface SecretsFile {
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
}

export function readOrCreateSecrets(filePath: string): SecretsFile {
  if (existsSync(filePath)) {
    const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
    const secrets = parseSecrets(parsed);
    if (secrets) {
      if (hasLegacyAdminPassword(parsed)) {
        writeSecrets(filePath, secrets);
      }
      return secrets;
    }
  }

  const created: SecretsFile = {
    jwtAccessSecret: randomBytes(32).toString('hex'),
    jwtRefreshSecret: randomBytes(32).toString('hex'),
  };
  writeSecrets(filePath, created);
  return created;
}

export function parseSecrets(value: unknown): SecretsFile | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.jwtAccessSecret !== 'string' ||
    record.jwtAccessSecret.length < 32 ||
    typeof record.jwtRefreshSecret !== 'string' ||
    record.jwtRefreshSecret.length < 32
  ) {
    return null;
  }
  return {
    jwtAccessSecret: record.jwtAccessSecret,
    jwtRefreshSecret: record.jwtRefreshSecret,
  };
}

function hasLegacyAdminPassword(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && 'adminPassword' in value);
}

function writeSecrets(filePath: string, secrets: SecretsFile): void {
  writeFileSync(filePath, `${JSON.stringify(secrets, null, 2)}\n`, 'utf8');
}
