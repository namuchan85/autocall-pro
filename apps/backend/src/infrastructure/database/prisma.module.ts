import { Global, Module } from '@nestjs/common';
import { DATABASE_HEALTH_INDICATOR } from '../../common/health/health.tokens';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: DATABASE_HEALTH_INDICATOR,
      useExisting: PrismaService,
    },
  ],
  exports: [PrismaService, DATABASE_HEALTH_INDICATOR],
})
export class PrismaModule {}
