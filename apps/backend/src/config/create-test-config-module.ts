import { ConfigModule, type ConfigModuleOptions } from '@nestjs/config';
import { validateEnvironment } from './environment';
import { TEST_ENVIRONMENT } from './test-environment';

export function createTestConfigModule(
  overrides: Record<string, unknown> = {},
): ReturnType<typeof ConfigModule.forRoot> {
  const values = validateEnvironment({ ...TEST_ENVIRONMENT, ...overrides });
  const options: ConfigModuleOptions = {
    isGlobal: true,
    cache: false,
    ignoreEnvFile: true,
    ignoreEnvVars: true,
    skipProcessEnv: true,
    load: [() => values],
    validate: () => values,
  };
  return ConfigModule.forRoot(options);
}
