export const TEST_ENVIRONMENT = {
  DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/autocall_test?schema=public',
  REDIS_URL: 'redis://127.0.0.1:6379',
  JWT_ACCESS_SECRET: 'test-jwt-access-secret-32bytes-min',
  JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-32bytes-mn',
  JWT_ACCESS_TTL_SECONDS: '900',
  JWT_REFRESH_TTL_SECONDS: '604800',
  COOKIE_SECURE: 'false',
  FRONTEND_URL: 'http://localhost:3000',
  LOGIN_RATE_LIMIT_MAX: '5',
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: '60',
  TRUST_PROXY: 'false',
  TRUST_PROXY_HOPS: '1',
  NODE_ENV: 'test',
  PORT: '3001',
} as const;

export function applyTestEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  for (const [key, value] of Object.entries(TEST_ENVIRONMENT)) {
    env[key] = value;
  }
}
