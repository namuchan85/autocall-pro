import { Inject, Injectable } from '@nestjs/common';
import { CACHE_HEALTH_INDICATOR, DATABASE_HEALTH_INDICATOR } from './health.tokens';
import type { HealthIndicator } from './health.tokens';

export interface HealthResponse {
  status: 'ok';
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(DATABASE_HEALTH_INDICATOR)
    private readonly database: HealthIndicator,
    @Inject(CACHE_HEALTH_INDICATOR)
    private readonly cache: HealthIndicator,
  ) {}

  async check(): Promise<HealthResponse> {
    await Promise.all([this.database.isHealthy(), this.cache.isHealthy()]);
    return { status: 'ok' };
  }
}
