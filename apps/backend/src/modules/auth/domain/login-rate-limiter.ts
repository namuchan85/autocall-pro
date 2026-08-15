export const LOGIN_RATE_LIMITER = Symbol('LOGIN_RATE_LIMITER');

export interface LoginRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface LoginRateLimiter {
  consume(identity: string): Promise<LoginRateLimitResult>;
}
