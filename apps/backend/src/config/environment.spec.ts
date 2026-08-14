import { validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  it('normalizes a valid foundation environment', () => {
    expect(
      validateEnvironment({
        DATABASE_URL: 'postgresql://localhost:5432/autocall',
        FRONTEND_URL: 'http://localhost:3000',
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        REDIS_URL: 'redis://localhost:6379',
        PORT: '3001',
      }),
    ).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3001,
      COOKIE_SECURE: false,
      JWT_ACCESS_TTL_SECONDS: 900,
      JWT_REFRESH_TTL_SECONDS: 604_800,
      LOGIN_RATE_LIMIT_MAX: 5,
      LOGIN_RATE_LIMIT_WINDOW_SECONDS: 60,
      TRUST_PROXY: false,
      TRUST_PROXY_HOPS: 1,
    });
  });

  it('rejects missing infrastructure URLs', () => {
    expect(() => validateEnvironment({})).toThrow('DATABASE_URL');
  });
});
