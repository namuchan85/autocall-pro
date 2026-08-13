const REQUIRED_VARIABLES = ['DATABASE_URL', 'REDIS_URL'] as const;

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

  return {
    ...config,
    NODE_ENV: config.NODE_ENV ?? 'development',
    PORT: port,
  };
}
