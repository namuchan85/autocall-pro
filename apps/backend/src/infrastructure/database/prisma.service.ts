import { PrismaLibSql } from '@prisma/adapter-libsql';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../../generated/prisma/client';
import { toLibsqlFileUrl } from './sqlite-url';
import { ensureSqliteSchema } from './ensure-sqlite-schema';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(configService: ConfigService) {
    super({
      adapter: new PrismaLibSql({
        url: toLibsqlFileUrl(configService.getOrThrow<string>('DATABASE_URL')),
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    await ensureSqliteSchema(this);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async isHealthy(): Promise<boolean> {
    await this.$queryRaw`SELECT 1`;
    return true;
  }
}
