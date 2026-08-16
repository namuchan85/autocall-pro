import { PrismaLibSql } from '@prisma/adapter-libsql';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../../generated/prisma/client';
import { applySqliteFileMigrations } from './sqlite-migrations';
import { toLibsqlFileUrl } from './sqlite-url';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly databaseUrl: string;

  constructor(configService: ConfigService) {
    const databaseUrl = configService.getOrThrow<string>('DATABASE_URL');
    super({
      adapter: new PrismaLibSql({
        url: toLibsqlFileUrl(databaseUrl),
      }),
    });
    this.databaseUrl = databaseUrl;
  }

  async onModuleInit(): Promise<void> {
    await applySqliteFileMigrations(this.databaseUrl);
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async isHealthy(): Promise<boolean> {
    await this.$queryRaw`SELECT 1`;
    return true;
  }
}
