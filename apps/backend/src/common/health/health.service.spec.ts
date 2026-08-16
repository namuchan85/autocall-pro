import { HealthService } from './health.service';
import type { HealthIndicator } from './health.tokens';

describe('HealthService', () => {
  it('returns ok when the local database is reachable', async () => {
    const databaseCheck = jest.fn().mockResolvedValue(true);
    const database: HealthIndicator = { isHealthy: databaseCheck };
    const service = new HealthService(database);

    await expect(service.check()).resolves.toEqual({ status: 'ok' });
    expect(databaseCheck).toHaveBeenCalledTimes(1);
  });
});
