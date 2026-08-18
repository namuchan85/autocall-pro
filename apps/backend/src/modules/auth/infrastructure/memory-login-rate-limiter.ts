import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LoginRateLimiter, LoginRateLimitResult } from '../domain/login-rate-limiter';

interface WindowState {
  count: number;
  resetAt: number;
}

@Injectable()
export class MemoryLoginRateLimiter implements LoginRateLimiter {
  private readonly windows = new Map<string, WindowState>();

  constructor(private readonly config: ConfigService) {}

  consume(identity: string): Promise<LoginRateLimitResult> {
    const maxAttempts = this.config.getOrThrow<number>('LOGIN_RATE_LIMIT_MAX');
    const windowSeconds = this.config.getOrThrow<number>('LOGIN_RATE_LIMIT_WINDOW_SECONDS');
    const now = Date.now();
    const current = this.windows.get(identity);

    if (!current || current.resetAt <= now) {
      const resetAt = now + windowSeconds * 1000;
      this.windows.set(identity, { count: 1, resetAt });
      return Promise.resolve({
        allowed: true,
        retryAfterSeconds: windowSeconds,
      });
    }

    current.count += 1;
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return Promise.resolve({
      allowed: current.count <= maxAttempts,
      retryAfterSeconds,
    });
  }
}
