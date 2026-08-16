const REQUIRED_VARIABLES = [
  'DATABASE_URL',
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
  const loginRateLimitMax = optionalPositiveInteger(
    config.LOGIN_RATE_LIMIT_MAX,
    5,
    'LOGIN_RATE_LIMIT_MAX',
  );
  const loginRateLimitWindowSeconds = optionalPositiveInteger(
    config.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
    60,
    'LOGIN_RATE_LIMIT_WINDOW_SECONDS',
  );
  const trustProxyHops = optionalPositiveInteger(config.TRUST_PROXY_HOPS, 1, 'TRUST_PROXY_HOPS');

  return {
    ...config,
    COOKIE_SECURE: parseBoolean(config.COOKIE_SECURE ?? false, 'COOKIE_SECURE'),
    JWT_ACCESS_TTL_SECONDS: accessTtl,
    JWT_REFRESH_TTL_SECONDS: refreshTtl,
    LOGIN_RATE_LIMIT_MAX: loginRateLimitMax,
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: loginRateLimitWindowSeconds,
    NODE_ENV: config.NODE_ENV ?? 'development',
    PORT: port,
    TRUST_PROXY: parseBoolean(config.TRUST_PROXY ?? false, 'TRUST_PROXY'),
    TRUST_PROXY_HOPS: trustProxyHops,
    ADB_PATH: optionalString(config.ADB_PATH),
    ADB_DEVICE_ID: optionalAdbDeviceId(config.ADB_DEVICE_ID),
    SETTINGS_PATH: optionalString(config.SETTINGS_PATH, 'SETTINGS_PATH'),
  };
}

function optionalPositiveInteger(value: unknown, fallback: number, name: string): number {
  if (value === undefined || value === '') {
    return fallback;
  }
  return parsePositiveInteger(value, name);
}

function parsePositiveInteger(value: unknown, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer`);
  }
  return parsed;
}

function optionalString(value: unknown, name = 'ADB_PATH'): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value !== 'string') {
    throw new Error(`Environment variable ${name} must be a string`);
  }
  return value.trim();
}

function optionalAdbDeviceId(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  if (typeof value !== 'string') {
    throw new Error('Environment variable ADB_DEVICE_ID must be a string');
  }
  const deviceId = value.trim();
  if (deviceId.length === 0) {
    return '';
  }
  if (!/^[A-Za-z0-9._:-]+$/.test(deviceId)) {
    throw new Error('Environment variable ADB_DEVICE_ID contains invalid characters');
  }
  return deviceId;
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
