import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient as createLibsqlClient } from '@libsql/client';
import {
  applySqliteFileMigrations,
  applySqliteMigrations,
  splitSqliteMigrationStatements,
  type SqliteMigrationClient,
} from './sqlite-migrations';
import { toLibsqlFileUrl } from './sqlite-url';

function rowText(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('expected sqlite row text');
  }
  return value;
}

function cleanupTempDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows may keep a short lock on a closed libsql file handle.
  }
}

const MIGRATION_SQL = path.join(
  __dirname,
  '../../../prisma/migrations/20260816090000_desktop_v1_sqlite/migration.sql',
);

function createMockClient(): SqliteMigrationClient & {
  executed: string[];
  versions: Set<string>;
  failOn?: string;
} {
  const executed: string[] = [];
  const versions = new Set<string>();
  const client: SqliteMigrationClient & {
    executed: string[];
    versions: Set<string>;
    failOn?: string;
  } = {
    executed,
    versions,
    $queryRawUnsafe: (sql: string) => {
      if (sql.includes('FROM _schema_migrations')) {
        return Promise.resolve([...versions].map((version) => ({ version })));
      }
      return Promise.resolve([]);
    },
    $executeRawUnsafe: (sql: string) => {
      executed.push(sql);
      if (client.failOn && sql.includes(client.failOn)) {
        return Promise.reject(new Error('migration statement failed'));
      }
      if (sql.includes('INSERT INTO _schema_migrations')) {
        const matched = /VALUES \('([^']+)'/.exec(sql);
        if (matched?.[1]) {
          versions.add(matched[1]);
        }
      }
      return Promise.resolve(0);
    },
  };
  return client;
}

describe('applySqliteMigrations', () => {
  it('keeps CREATE TABLE statements that follow SQL comments', () => {
    const sql = readFileSync(MIGRATION_SQL, 'utf8');
    const statements = splitSqliteMigrationStatements(sql);
    expect(statements.some((item) => item.includes('CREATE TABLE IF NOT EXISTS "users"'))).toBe(
      true,
    );
    expect(statements.some((item) => item.includes('CREATE TABLE IF NOT EXISTS "customers"'))).toBe(
      true,
    );
    expect(statements.some((item) => item.includes('CREATE TABLE IF NOT EXISTS "calls"'))).toBe(
      true,
    );
    expect(statements.every((item) => !item.startsWith('--'))).toBe(true);
  });

  it('applies the initial schema and records version 1', async () => {
    const client = createMockClient();

    await applySqliteMigrations(client);

    expect(client.executed.some((item) => item.includes('_schema_migrations'))).toBe(true);
    expect(client.executed.some((item) => item.includes('BEGIN IMMEDIATE'))).toBe(true);
    expect(
      client.executed.some((item) => item.includes('CREATE TABLE IF NOT EXISTS "users"')),
    ).toBe(true);
    expect(
      client.executed.some((item) => item.includes('CREATE TABLE IF NOT EXISTS "calls"')),
    ).toBe(true);
    expect(client.executed.some((item) => item.includes('INSERT INTO _schema_migrations'))).toBe(
      true,
    );
    expect(client.executed.some((item) => item === 'COMMIT')).toBe(true);
    expect(client.versions.has('1')).toBe(true);
    expect(client.versions.has('2')).toBe(true);
    expect(client.executed.some((item) => item.includes('lastOutcome'))).toBe(true);
  });

  it('skips already applied migrations', async () => {
    const client = createMockClient();
    client.versions.add('1');
    client.versions.add('2');

    await applySqliteMigrations(client);

    expect(
      client.executed.some((item) => item.includes('CREATE TABLE IF NOT EXISTS "users"')),
    ).toBe(false);
    expect(client.executed.some((item) => item.includes('BEGIN IMMEDIATE'))).toBe(false);
  });

  it('rolls back a failed migration and does not record its version', async () => {
    const client = createMockClient();
    client.failOn = 'CREATE TABLE IF NOT EXISTS "calls"';

    await expect(applySqliteMigrations(client)).rejects.toThrow('migration statement failed');
    expect(client.executed.some((item) => item === 'ROLLBACK')).toBe(true);
    expect(client.executed.some((item) => item === 'COMMIT')).toBe(false);
    expect(client.versions.has('1')).toBe(false);
  });

  it('does not treat a users table as a completed schema without a version row', async () => {
    const client = createMockClient();
    client.$queryRawUnsafe = (sql: string) => {
      if (sql.includes('FROM _schema_migrations')) {
        return Promise.resolve([]);
      }
      if (sql.includes("name = 'users'")) {
        return Promise.resolve([{ name: 'users' }]);
      }
      return Promise.resolve([]);
    };

    await applySqliteMigrations(client);

    expect(
      client.executed.some((item) => item.includes('CREATE TABLE IF NOT EXISTS "customers"')),
    ).toBe(true);
    expect(client.versions.has('1')).toBe(true);
    expect(client.versions.has('2')).toBe(true);
  });

  it('applies later migrations after version 1 is recorded', async () => {
    const client = createMockClient();
    client.versions.add('1');

    await applySqliteMigrations(client);

    expect(
      client.executed.some((item) => item.includes('CREATE TABLE IF NOT EXISTS "users"')),
    ).toBe(false);
    expect(client.executed.some((item) => item.includes('lastOutcome'))).toBe(true);
    expect(client.versions.has('2')).toBe(true);
  });
});

describe('applySqliteFileMigrations', () => {
  it('applies the full schema, records version 1, and skips on rerun', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'autocall-migrate-'));
    const databaseUrl = `file:${path.join(dir, 'autocall.db')}`;
    try {
      await applySqliteFileMigrations(databaseUrl);
      const libsql = createLibsqlClient({ url: toLibsqlFileUrl(databaseUrl) });
      try {
        const tables = await libsql.execute(
          "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
        );
        const names = tables.rows.map((row) => {
          const name = row.name;
          if (typeof name !== 'string') {
            throw new Error('expected table name string');
          }
          return name;
        });
        expect(names).toEqual(
          expect.arrayContaining(['_schema_migrations', 'users', 'customers', 'calls']),
        );
        const versions = await libsql.execute('SELECT version, name FROM _schema_migrations');
        expect(versions.rows.map((row) => rowText(row.version))).toEqual(['1', '2']);
      } finally {
        libsql.close();
      }

      await applySqliteFileMigrations(databaseUrl);
      const again = createLibsqlClient({ url: toLibsqlFileUrl(databaseUrl) });
      try {
        const versions = await again.execute('SELECT version FROM _schema_migrations');
        expect(versions.rows).toHaveLength(2);
      } finally {
        again.close();
      }
    } finally {
      cleanupTempDir(dir);
    }
  });

  it('rolls back a failed migration so partial tables are not left behind', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'autocall-migrate-fail-'));
    const databaseUrl = `file:${path.join(dir, 'autocall.db')}`;
    try {
      await applySqliteFileMigrations(databaseUrl);
      await expect(
        applySqliteFileMigrations(databaseUrl, [
          {
            version: '99',
            name: 'failing_migration',
            statements: [
              'CREATE TABLE "migration_probe" ("id" TEXT NOT NULL PRIMARY KEY)',
              'THIS IS NOT VALID SQL',
            ],
          },
        ]),
      ).rejects.toThrow();

      const libsql = createLibsqlClient({ url: toLibsqlFileUrl(databaseUrl) });
      try {
        const tables = await libsql.execute(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'migration_probe'",
        );
        expect(tables.rows).toHaveLength(0);
        const versions = await libsql.execute('SELECT version FROM _schema_migrations');
        expect(versions.rows.map((row) => rowText(row.version))).toEqual(['1', '2']);
      } finally {
        libsql.close();
      }
    } finally {
      cleanupTempDir(dir);
    }
  });
});
