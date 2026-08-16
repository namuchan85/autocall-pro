import { ConfigService } from '@nestjs/config';
import { MemoryLoginRateLimiter } from './memory-login-rate-limiter';

function createLimiter(): MemoryLoginRateLimiter {
  return new MemoryLoginRateLimiter(
    new ConfigService({
      LOGIN_RATE_LIMIT_MAX: 5,
      LOGIN_RATE_LIMIT_WINDOW_SECONDS: 60,
    }),
  );
}

describe('MemoryLoginRateLimiter', () => {
  it('allows attempts until the max count is exceeded', async () => {
    const limiter = createLimiter();

    for (let index = 0; index < 5; index += 1) {
      await expect(limiter.consume('127.0.0.1')).resolves.toEqual({
        allowed: true,
        retryAfterSeconds: 60,
      });
    }

    await expect(limiter.consume('127.0.0.1')).resolves.toMatchObject({
      allowed: false,
    });
  });
});
