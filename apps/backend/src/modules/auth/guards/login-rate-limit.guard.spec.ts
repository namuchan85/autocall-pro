import { ExecutionContext, HttpException } from '@nestjs/common';
import type { LoginRateLimiter } from '../domain/login-rate-limiter';
import { LoginRateLimitGuard } from './login-rate-limit.guard';

function createContext(ip = '127.0.0.1'): {
  context: ExecutionContext;
  response: { setHeader: jest.Mock };
} {
  const response = { setHeader: jest.fn() };
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ ip, socket: { remoteAddress: ip } }),
      getResponse: () => response,
    }),
  } as ExecutionContext;
  return { context, response };
}

describe('LoginRateLimitGuard', () => {
  it('allows login attempts under the limit', async () => {
    const limiter: LoginRateLimiter = {
      consume: jest.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 60 }),
    };
    const { context } = createContext();

    await expect(new LoginRateLimitGuard(limiter).canActivate(context)).resolves.toBe(true);
  });

  it('rejects login attempts over the limit with Retry-After', async () => {
    const limiter: LoginRateLimiter = {
      consume: jest.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 42 }),
    };
    const { context, response } = createContext();
    const error = await new LoginRateLimitGuard(limiter)
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
