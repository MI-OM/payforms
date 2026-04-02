import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type MemoryCacheEntry = {
  value: string;
  expiresAt: number | null;
};

type RedisScanResponse = [string, string[]];

type RedisLikeClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', ttl: number): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  scan(cursor: string, ...args: Array<string | number>): Promise<RedisScanResponse>;
  quit(): Promise<string | void>;
  on?(event: string, listener: (...args: any[]) => void): void;
  connect?(): Promise<void>;
};

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly memoryCache = new Map<string, MemoryCacheEntry>();
  private readonly defaultTtlSeconds: number;
  private redisClient: RedisLikeClient | null = null;

  constructor(private readonly configService: ConfigService) {
    this.defaultTtlSeconds = this.parsePositiveNumber(
      this.configService.get<string>('CACHE_DEFAULT_TTL_SECONDS'),
      120,
    );
    void this.bootstrapRedisClient();
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redisClient) {
      try {
        const value = await this.redisClient.get(key);
        if (!value) {
          return null;
        }
        return JSON.parse(value) as T;
      } catch (error: any) {
        this.logger.warn(`Redis cache get failed for key '${key}': ${error?.message || String(error)}`);
      }
    }

    const entry = this.memoryCache.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }

    return JSON.parse(entry.value) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const effectiveTtl = this.parsePositiveNumber(ttlSeconds, this.defaultTtlSeconds);
    const payload = JSON.stringify(value);

    if (this.redisClient) {
      try {
        await this.redisClient.set(key, payload, 'EX', effectiveTtl);
        return;
      } catch (error: any) {
        this.logger.warn(`Redis cache set failed for key '${key}': ${error?.message || String(error)}`);
      }
    }

    this.memoryCache.set(key, {
      value: payload,
      expiresAt: Date.now() + effectiveTtl * 1000,
    });
  }

  async del(key: string): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.del(key);
      } catch (error: any) {
        this.logger.warn(`Redis cache delete failed for key '${key}': ${error?.message || String(error)}`);
      }
    }

    this.memoryCache.delete(key);
  }

  async delByPrefix(prefix: string): Promise<number> {
    let deleted = 0;

    if (this.redisClient) {
      try {
        let cursor = '0';
        const keysToDelete: string[] = [];

        do {
          const [nextCursor, batch] = await this.redisClient.scan(
            cursor,
            'MATCH',
            `${prefix}*`,
            'COUNT',
            250,
          );
          cursor = nextCursor;
          if (batch.length) {
            keysToDelete.push(...batch);
          }
        } while (cursor !== '0');

        if (keysToDelete.length) {
          deleted += await this.redisClient.del(...keysToDelete);
        }
      } catch (error: any) {
        this.logger.warn(`Redis cache prefix delete failed for prefix '${prefix}': ${error?.message || String(error)}`);
      }
    }

    for (const key of Array.from(this.memoryCache.keys())) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key);
        deleted += 1;
      }
    }

    return deleted;
  }

  async onModuleDestroy() {
    if (!this.redisClient) {
      return;
    }

    try {
      await this.redisClient.quit();
    } catch (error: any) {
      this.logger.warn(`Redis quit failed: ${error?.message || String(error)}`);
    }
  }

  private async bootstrapRedisClient() {
    const redisEnabled = this.parseBoolean(this.configService.get<string>('CACHE_REDIS_ENABLED'));
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (!redisEnabled || !redisUrl) {
      this.logger.log('Redis cache disabled; using in-memory cache fallback');
      return;
    }

    try {
      const Redis = require('ioredis');
      const redisClient = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        connectTimeout: this.parsePositiveNumber(
          this.configService.get<string>('REDIS_CONNECT_TIMEOUT_MS'),
          10000,
        ),
        enableReadyCheck: true,
        tls: this.parseBoolean(this.configService.get<string>('REDIS_TLS')) ? {} : undefined,
      }) as RedisLikeClient;

      redisClient.on?.('error', (error: any) => {
        this.logger.warn(`Redis connection error: ${error?.message || String(error)}`);
      });

      if (typeof redisClient.connect === 'function') {
        await redisClient.connect();
      }

      this.redisClient = redisClient;
      this.logger.log('Redis cache enabled');
    } catch (error: any) {
      this.redisClient = null;
      this.logger.warn(
        `Redis is not available; using in-memory cache fallback (${error?.message || String(error)})`,
      );
    }
  }

  private parsePositiveNumber(value: string | number | undefined, fallback: number) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return fallback;
  }

  private parseBoolean(value: string | boolean | undefined) {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
    }

    return false;
  }
}

