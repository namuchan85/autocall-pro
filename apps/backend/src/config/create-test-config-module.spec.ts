import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createTestConfigModule } from './create-test-config-module';
import { TEST_ENVIRONMENT } from './test-environment';

describe('createTestConfigModule', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it('injects test variables without reading the host environment', async () => {
    process.env.DATABASE_URL = '';

    const moduleRef = await Test.createTestingModule({
      imports: [createTestConfigModule()],
    }).compile();
    const config = moduleRef.get(ConfigService);

    expect(config.get('DATABASE_URL')).toBe(TEST_ENVIRONMENT.DATABASE_URL);
    expect(config.get('JWT_ACCESS_SECRET')).toBe(TEST_ENVIRONMENT.JWT_ACCESS_SECRET);
    expect(config.get('TRUST_PROXY')).toBe(false);
    await moduleRef.close();
  });
});
