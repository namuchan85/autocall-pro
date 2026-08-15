import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import type { RedisService } from '../../../infrastructure/cache/redis.service';
import { RedisLoginRateLimiter } from './redis-login-rate-limiter';

function createLimiter(
  redis: Pick<RedisService, 'incrementWithTtl' | 'getTtlSeconds'>,
): RedisLoginRateLimiter {
  return new RedisLoginRateLimiter(
    redis as RedisService,
    new ConfigService({
      LOGIN_RATE_LIMIT_MAX: 5,
      LOGIN_RATE_LIMIT_WINDOW_SECONDS: 60,
    }),
  );
}

describe('RedisLoginRateLimiter', () => {
  it('allows attempts until the max count is exceeded', async () => {
    const redis = {
      incrementWithTtl: jest.fn().mockResolvedValue(5),
      getTtlSeconds: jest.fn().mockResolvedValue(17),
    };

    await expect(createLimiter(redis).consume('127.0.0.1')).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 17,
    });

    redis.incrementWithTtl.mockResolvedValue(6);
    await expect(createLimiter(redis).consume('127.0.0.1')).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 17,
    });
    expect(redis.incrementWithTtl).toHaveBeenCalledWith('auth:login:127.0.0.1', 60);
  });

  it('fails closed when Redis is unavailable', async () => {
    const redis = {
      incrementWithTtl: jest.fn().mockRejectedValue(new Error('redis down')),
      getTtlSeconds: jest.fn(),
    };

    await expect(createLimiter(redis).consume('127.0.0.1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
