export const DATABASE_HEALTH_INDICATOR = Symbol('DATABASE_HEALTH_INDICATOR');
export const CACHE_HEALTH_INDICATOR = Symbol('CACHE_HEALTH_INDICATOR');

export interface HealthIndicator {
  isHealthy(): Promise<boolean>;
}
