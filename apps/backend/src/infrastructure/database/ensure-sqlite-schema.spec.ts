import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ensureSqliteSchema, splitSqliteMigrationStatements } from './ensure-sqlite-schema';

const MIGRATION_SQL = path.join(
  __dirname,
  '../../../prisma/migrations/20260816090000_desktop_v1_sqlite/migration.sql',
);

describe('ensureSqliteSchema', () => {
  it('keeps CREATE TABLE statements that follow SQL comments', () => {
    const sql = readFileSync(MIGRATION_SQL, 'utf8');
    const statements = splitSqliteMigrationStatements(sql);
    expect(statements.some((item) => item.includes('CREATE TABLE "users"'))).toBe(true);
    expect(statements.some((item) => item.includes('CREATE TABLE "customers"'))).toBe(true);
    expect(statements.some((item) => item.includes('CREATE TABLE "calls"'))).toBe(true);
    expect(statements.every((item) => !item.startsWith('--'))).toBe(true);
  });

  it('applies CREATE TABLE statements when the users table is missing', async () => {
    const executed: string[] = [];
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      $executeRawUnsafe: jest.fn((sql: string) => {
        executed.push(sql);
        return Promise.resolve(0);
      }),
    };

    await ensureSqliteSchema(prisma as never);

    expect(executed.some((item) => item.includes('CREATE TABLE "users"'))).toBe(true);
    expect(executed.some((item) => item.includes('CREATE TABLE "calls"'))).toBe(true);
  });
});
