import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_HEALTH_INDICATOR } from './health.tokens';
import type { HealthIndicator } from './health.tokens';

export interface HealthResponse {
  status: 'ok';
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(DATABASE_HEALTH_INDICATOR)
    private readonly database: HealthIndicator,
  ) {}

  async check(): Promise<HealthResponse> {
    await this.database.isHealthy();
    return { status: 'ok' };
  }
}
