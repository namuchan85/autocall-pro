import { mkdirSync } from 'node:fs';
import path from 'node:path';

export function toSqliteFilePath(databaseUrl: string): string {
  const raw = databaseUrl.startsWith('file:') ? databaseUrl.slice('file:'.length) : databaseUrl;
  return path.resolve(raw);
}

export function toLibsqlFileUrl(databaseUrl: string): string {
  const filePath = toSqliteFilePath(databaseUrl);
  mkdirSync(path.dirname(filePath), { recursive: true });
  return `file:${filePath.replace(/\\/g, '/')}`;
}
