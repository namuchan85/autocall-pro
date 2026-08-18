import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '../../generated/prisma/client';
import { toLibsqlFileUrl } from './sqlite-url';

export function createSqlitePrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaLibSql({ url: toLibsqlFileUrl(databaseUrl) }),
  });
}
