const REQUIRED_VARIABLES = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'FRONTEND_URL',
] as const;

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  for (const variable of REQUIRED_VARIABLES) {
    if (typeof config[variable] !== 'string' || config[variable].length === 0) {
      throw new Error(`Environment variable ${variable} is required`);
    }
  }

  const port = Number(config.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('Environment variable PORT must be a valid port number');
  }

  for (const secret of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    if ((config[secret] as string).length < 32) {
      throw new Error(`Environment variable ${secret} must be at least 32 characters`);
    }
  }

  const accessTtl = parsePositiveInteger(
    config.JWT_ACCESS_TTL_SECONDS ?? 900,
    'JWT_ACCESS_TTL_SECONDS',
  );
  const refreshTtl = parsePositiveInteger(
    config.JWT_REFRESH_TTL_SECONDS ?? 604_800,
    'JWT_REFRESH_TTL_SECONDS',
  );

  return {
    ...config,
    COOKIE_SECURE: parseBoolean(config.COOKIE_SECURE ?? false, 'COOKIE_SECURE'),
    JWT_ACCESS_TTL_SECONDS: accessTtl,
    JWT_REFRESH_TTL_SECONDS: refreshTtl,
    NODE_ENV: config.NODE_ENV ?? 'development',
    PORT: port,
  };
}

function parsePositiveInteger(value: unknown, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer`);
  }
  return parsed;
}

function parseBoolean(value: unknown, name: string): boolean {
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  throw new Error(`Environment variable ${name} must be true or false`);
}
