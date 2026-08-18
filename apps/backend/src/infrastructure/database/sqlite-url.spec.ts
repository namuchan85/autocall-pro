import { toLibsqlFileUrl, toSqliteFilePath } from './sqlite-url';

describe('sqlite-url', () => {
  it('resolves a file URL to an absolute path', () => {
    const filePath = toSqliteFilePath('file:./tmp/autocall.db');
    expect(filePath.endsWith('autocall.db')).toBe(true);
  });

  it('builds a libsql file URL without backslashes', () => {
    const url = toLibsqlFileUrl('file:./tmp/autocall.db');
    expect(url.startsWith('file:')).toBe(true);
    expect(url.includes('\\')).toBe(false);
  });
});
