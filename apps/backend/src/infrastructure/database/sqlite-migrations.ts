import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { toLibsqlFileUrl } from './sqlite-url';

export interface SqliteMigrationClient {
  $queryRawUnsafe<T = unknown>(sql: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(sql: string, ...values: unknown[]): Promise<number>;
}

export interface SqliteMigration {
  version: string;
  name: string;
  statements: string[];
}

const HISTORY_TABLE_SQL = `CREATE TABLE IF NOT EXISTS "_schema_migrations" (
  "version" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "appliedAt" TEXT NOT NULL
)`;

export const DESKTOP_V1_MIGRATION: Omit<SqliteMigration, 'statements'> = {
  version: '1',
  name: 'desktop_v1_sqlite',
};

export const DESKTOP_V2_MIGRATION: Omit<SqliteMigration, 'statements'> = {
  version: '2',
  name: 'desktop_v2_companion',
};

export const DESKTOP_V3_MIGRATION: Omit<SqliteMigration, 'statements'> = {
  version: '3',
  name: 'desktop_v3_companion_call_lifecycle',
};

export function splitSqliteMigrationStatements(sql: string): string[] {
  return sql
    .replace(/^\s*--.*$/gm, '')
    .split(';')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function loadDesktopV1Migration(): SqliteMigration {
  return {
    ...DESKTOP_V1_MIGRATION,
    statements: splitSqliteMigrationStatements(readFileSync(resolveMigrationSql('v1'), 'utf8')),
  };
}

export function loadDesktopV2Migration(): SqliteMigration {
  return {
    ...DESKTOP_V2_MIGRATION,
    statements: splitSqliteMigrationStatements(readFileSync(resolveMigrationSql('v2'), 'utf8')),
  };
}

export function loadDesktopV3Migration(): SqliteMigration {
  return {
    ...DESKTOP_V3_MIGRATION,
    statements: splitSqliteMigrationStatements(readFileSync(resolveMigrationSql('v3'), 'utf8')),
  };
}

export function loadDesktopMigrations(): SqliteMigration[] {
  return [loadDesktopV1Migration(), loadDesktopV2Migration(), loadDesktopV3Migration()];
}

export async function applySqliteFileMigrations(
  databaseUrl: string,
  migrations: SqliteMigration[] = loadDesktopMigrations(),
): Promise<void> {
  const libsql = createClient({ url: toLibsqlFileUrl(databaseUrl) });
  try {
    await applySqliteMigrations(
      {
        $queryRawUnsafe: async <T = unknown>(sql: string) => {
          const result = await libsql.execute(sql);
          return result.rows as T;
        },
        $executeRawUnsafe: async (sql: string) => {
          await libsql.execute(sql);
          return 0;
        },
      },
      migrations,
    );
  } finally {
    libsql.close();
  }
}

export async function applySqliteMigrations(
  client: SqliteMigrationClient,
  migrations: SqliteMigration[] = loadDesktopMigrations(),
): Promise<void> {
  await ensureHistoryTable(client);
  const applied = await readAppliedVersions(client);

  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue;
    }
    await applyMigration(client, migration);
    applied.add(migration.version);
  }
}

async function ensureHistoryTable(client: SqliteMigrationClient): Promise<void> {
  await client.$executeRawUnsafe(HISTORY_TABLE_SQL);
}

async function readAppliedVersions(client: SqliteMigrationClient): Promise<Set<string>> {
  const rows = await client.$queryRawUnsafe<{ version: string }[]>(
    'SELECT version FROM _schema_migrations',
  );
  return new Set(rows.map((row) => row.version));
}

async function applyMigration(
  client: SqliteMigrationClient,
  migration: SqliteMigration,
): Promise<void> {
  assertMigrationIdentity(migration);
  await client.$executeRawUnsafe('BEGIN IMMEDIATE');
  try {
    for (const statement of migration.statements) {
      await client.$executeRawUnsafe(statement);
    }
    await client.$executeRawUnsafe(
      `INSERT INTO _schema_migrations (version, name, appliedAt) VALUES ('${escapeSqlLiteral(migration.version)}', '${escapeSqlLiteral(migration.name)}', '${escapeSqlLiteral(new Date().toISOString())}')`,
    );
    await client.$executeRawUnsafe('COMMIT');
  } catch (error) {
    try {
      await client.$executeRawUnsafe('ROLLBACK');
    } catch {
      // The failed transaction already left the connection unusable until rollback.
    }
    throw error;
  }
}

function assertMigrationIdentity(migration: SqliteMigration): void {
  if (!/^[0-9]+$/.test(migration.version) || !/^[a-z0-9_]+$/.test(migration.name)) {
    throw new Error('Invalid migration identity');
  }
}

function escapeSqlLiteral(value: string): string {
  return value.replaceAll("'", "''");
}

function resolveMigrationSql(version: 'v1' | 'v2' | 'v3'): string {
  const files =
    version === 'v1'
      ? [
          path.join(
            __dirname,
            '../../../prisma/migrations/20260816090000_desktop_v1_sqlite/migration.sql',
          ),
          path.join(
            process.cwd(),
            'prisma/migrations/20260816090000_desktop_v1_sqlite/migration.sql',
          ),
          path.join(
            process.cwd(),
            'apps/backend/prisma/migrations/20260816090000_desktop_v1_sqlite/migration.sql',
          ),
          path.join(
            process.cwd(),
            'backend/prisma/migrations/20260816090000_desktop_v1_sqlite/migration.sql',
          ),
        ]
      : version === 'v2'
        ? [
            path.join(
              __dirname,
              '../../../prisma/migrations/20260818120000_desktop_v2_companion/migration.sql',
            ),
            path.join(
              process.cwd(),
              'prisma/migrations/20260818120000_desktop_v2_companion/migration.sql',
            ),
            path.join(
              process.cwd(),
              'apps/backend/prisma/migrations/20260818120000_desktop_v2_companion/migration.sql',
            ),
            path.join(
              process.cwd(),
              'backend/prisma/migrations/20260818120000_desktop_v2_companion/migration.sql',
            ),
          ]
        : [
            path.join(
              __dirname,
              '../../../prisma/migrations/20260818170000_desktop_v3_call_lifecycle/migration.sql',
            ),
            path.join(
              process.cwd(),
              'prisma/migrations/20260818170000_desktop_v3_call_lifecycle/migration.sql',
            ),
            path.join(
              process.cwd(),
              'apps/backend/prisma/migrations/20260818170000_desktop_v3_call_lifecycle/migration.sql',
            ),
            path.join(
              process.cwd(),
              'backend/prisma/migrations/20260818170000_desktop_v3_call_lifecycle/migration.sql',
            ),
          ];
  const found = files.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error('SQLite migration file was not found');
  }
  return found;
}
