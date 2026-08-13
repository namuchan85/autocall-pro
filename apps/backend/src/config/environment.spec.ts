import { validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  it('normalizes a valid foundation environment', () => {
    expect(
      validateEnvironment({
        DATABASE_URL: 'postgresql://localhost:5432/autocall',
        REDIS_URL: 'redis://localhost:6379',
        PORT: '3001',
      }),
    ).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3001,
    });
  });

  it('rejects missing infrastructure URLs', () => {
    expect(() => validateEnvironment({})).toThrow('DATABASE_URL');
  });
});
