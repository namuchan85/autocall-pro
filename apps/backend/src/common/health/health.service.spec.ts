import { HealthService } from './health.service';
import type { HealthIndicator } from './health.tokens';

describe('HealthService', () => {
  it('returns ok when PostgreSQL and Redis are reachable', async () => {
    const databaseCheck = jest.fn().mockResolvedValue(true);
    const cacheCheck = jest.fn().mockResolvedValue(true);
    const database: HealthIndicator = { isHealthy: databaseCheck };
    const cache: HealthIndicator = { isHealthy: cacheCheck };
    const service = new HealthService(database, cache);

    await expect(service.check()).resolves.toEqual({ status: 'ok' });
    expect(databaseCheck).toHaveBeenCalledTimes(1);
    expect(cacheCheck).toHaveBeenCalledTimes(1);
  });
});
