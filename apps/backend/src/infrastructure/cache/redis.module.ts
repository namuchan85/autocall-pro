import { Global, Module } from '@nestjs/common';
import { CACHE_HEALTH_INDICATOR } from '../../common/health/health.tokens';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    RedisService,
    {
      provide: CACHE_HEALTH_INDICATOR,
      useExisting: RedisService,
    },
  ],
  exports: [RedisService, CACHE_HEALTH_INDICATOR],
})
export class RedisModule {}
