import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { PrismaClient } from '../../generated/prisma/client';

export async function ensureSqliteSchema(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ name: string }[]>`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'
  `;
  if (tables.length > 0) {
    return;
  }

  const sqlPath = resolveMigrationSql();
  for (const statement of splitSqliteMigrationStatements(readFileSync(sqlPath, 'utf8'))) {
    await prisma.$executeRawUnsafe(statement);
  }
}

export function splitSqliteMigrationStatements(sql: string): string[] {
  return sql
    .replace(/^\s*--.*$/gm, '')
    .split(';')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function resolveMigrationSql(): string {
  const candidates = [
    path.join(
      __dirname,
      '../../../prisma/migrations/20260816090000_desktop_v1_sqlite/migration.sql',
    ),
    path.join(process.cwd(), 'prisma/migrations/20260816090000_desktop_v1_sqlite/migration.sql'),
    path.join(
      process.cwd(),
      'apps/backend/prisma/migrations/20260816090000_desktop_v1_sqlite/migration.sql',
    ),
    path.join(
      process.cwd(),
      'backend/prisma/migrations/20260816090000_desktop_v1_sqlite/migration.sql',
    ),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error('SQLite migration file was not found');
  }
  return found;
}
