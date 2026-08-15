import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Redis;

  constructor(configService: ConfigService) {
    this.client = new Redis(configService.getOrThrow<string>('REDIS_URL'), {
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    await this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status === 'ready') {
      await this.client.quit();
      return;
    }

    this.client.disconnect();
  }

  async isHealthy(): Promise<boolean> {
    return (await this.client.ping()) === 'PONG';
  }

  async incrementWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const result = await this.client.eval(
      `local current = redis.call('INCR', KEYS[1])
       if current == 1 then
         redis.call('EXPIRE', KEYS[1], ARGV[1])
       end
       return current`,
      1,
      key,
      ttlSeconds,
    );
    if (typeof result !== 'number') {
      throw new Error('Unexpected Redis increment result');
    }
    return result;
  }

  async getTtlSeconds(key: string): Promise<number> {
    const ttl = await this.client.ttl(key);
    return ttl > 0 ? ttl : 0;
  }
}
