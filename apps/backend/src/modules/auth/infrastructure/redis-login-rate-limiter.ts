import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import type { LoginRateLimiter, LoginRateLimitResult } from '../domain/login-rate-limiter';

@Injectable()
export class RedisLoginRateLimiter implements LoginRateLimiter {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async consume(identity: string): Promise<LoginRateLimitResult> {
    const maxAttempts = this.config.getOrThrow<number>('LOGIN_RATE_LIMIT_MAX');
    const windowSeconds = this.config.getOrThrow<number>('LOGIN_RATE_LIMIT_WINDOW_SECONDS');
    const key = `auth:login:${identity}`;

    try {
      const count = await this.redis.incrementWithTtl(key, windowSeconds);
      const retryAfterSeconds = (await this.redis.getTtlSeconds(key)) || windowSeconds;
      return {
        allowed: count <= maxAttempts,
        retryAfterSeconds,
      };
    } catch {
      throw new ServiceUnavailableException('Login is temporarily unavailable');
    }
  }
}
