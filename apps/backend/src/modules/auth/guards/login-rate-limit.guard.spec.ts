import { ConfigService } from '@nestjs/config';
import { ExecutionContext, HttpException } from '@nestjs/common';
import type { LoginRateLimiter } from '../domain/login-rate-limiter';
import { LoginRateLimitGuard } from './login-rate-limit.guard';

function createConfig(trustProxy = false): ConfigService {
  return new ConfigService({
    TRUST_PROXY: trustProxy,
    TRUST_PROXY_HOPS: 1,
  });
}

function createContext(
  ip = '127.0.0.1',
  forwardedFor?: string,
): {
  context: ExecutionContext;
  response: { setHeader: jest.Mock };
} {
  const response = { setHeader: jest.fn() };
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({
        ip,
        socket: { remoteAddress: ip },
        headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
      }),
      getResponse: () => response,
    }),
  } as ExecutionContext;
  return { context, response };
}

describe('LoginRateLimitGuard', () => {
  it('allows login attempts under the limit', async () => {
    const consume = jest.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 60 });
    const limiter: LoginRateLimiter = { consume };
    const { context } = createContext();

    await expect(
      new LoginRateLimitGuard(limiter, createConfig()).canActivate(context),
    ).resolves.toBe(true);
    expect(consume).toHaveBeenCalledWith('127.0.0.1');
  });

  it('ignores forwarded headers when trust proxy is disabled', async () => {
    const consume = jest.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 60 });
    const limiter: LoginRateLimiter = { consume };
    const { context } = createContext('10.0.0.8', '198.51.100.1');

    await new LoginRateLimitGuard(limiter, createConfig(false)).canActivate(context);

    expect(consume).toHaveBeenCalledWith('10.0.0.8');
  });

  it('uses the trusted forwarded client IP when trust proxy is enabled', async () => {
    const consume = jest.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 60 });
    const limiter: LoginRateLimiter = { consume };
    const { context } = createContext('10.0.0.8', '203.0.113.50');

    await new LoginRateLimitGuard(limiter, createConfig(true)).canActivate(context);

    expect(consume).toHaveBeenCalledWith('203.0.113.50');
  });

  it('rejects login attempts over the limit with Retry-After', async () => {
    const limiter: LoginRateLimiter = {
      consume: jest.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 42 }),
    };
    const { context, response } = createContext();
    const error = await new LoginRateLimitGuard(limiter, createConfig())
      .canActivate(context)
      .then(() => undefined)
      .catch((caught: unknown) => caught);
    if (!(error instanceof HttpException)) {
      throw new Error('expected HttpException');
    }
    expect(error.getStatus()).toBe(429);
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '42');
  });
});
