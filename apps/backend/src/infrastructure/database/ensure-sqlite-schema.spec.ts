import { existsSync } from 'node:fs';
import path from 'node:path';

describe('ensureSqliteSchema', () => {
  it('keeps the Desktop v1 SQLite migration next to the backend app', () => {
    const sqlPath = path.join(
      __dirname,
      '../../../prisma/migrations/20260816090000_desktop_v1_sqlite/migration.sql',
    );
    expect(existsSync(sqlPath)).toBe(true);
  });
});
