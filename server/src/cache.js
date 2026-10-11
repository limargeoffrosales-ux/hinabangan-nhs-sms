const logger = require('./logger');

let redis = null;
let useRedis = false;
const memoryCache = new Map();
const CACHE_PREFIX = 'meridianed:';

function initRedis() {
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST
    ? `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
    : null;

  if (!redisUrl) {
    logger.info('No REDIS_URL/REDIS_HOST set — using in-memory cache fallback');
    return false;
  }

  try {
    const Redis = require('ioredis');
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 100, 3000)),
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      logger.error({ err: err.message }, 'Redis connection error — falling back to memory cache');
      useRedis = false;
    });

    redis.on('connect', () => {
      logger.info('Redis connected');
      useRedis = true;
    });

    redis.connect().catch(() => {});
    return true;
  } catch (e) {
    logger.warn({ err: e.message }, 'ioredis not available — using in-memory cache');
    return false;
  }
}

function makeKey(key) {
  return `${CACHE_PREFIX}${key}`;
}

async function get(key) {
  const fullKey = makeKey(key);
  if (useRedis && redis) {
    try {
      const val = await redis.get(fullKey);
      return val ? JSON.parse(val) : null;
    } catch (e) {
      logger.warn({ err: e.message, key }, 'Redis GET failed — falling back to memory');
    }
  }
  const entry = memoryCache.get(fullKey);
  if (entry && Date.now() < entry.expires) return entry.value;
  if (entry) memoryCache.delete(fullKey);
  return null;
}

async function set(key, value, ttlSeconds = 300) {
  const fullKey = makeKey(key);
  const serialized = JSON.stringify(value);
  if (useRedis && redis) {
    try {
      await redis.setex(fullKey, ttlSeconds, serialized);
      return;
    } catch (e) {
      logger.warn({ err: e.message, key }, 'Redis SET failed — falling back to memory');
    }
  }
  memoryCache.set(fullKey, { value, expires: Date.now() + ttlSeconds * 1000 });
  if (memoryCache.size > 10000) {
    const keys = [...memoryCache.keys()];
    for (let i = 0; i < 5000; i++) memoryCache.delete(keys[i]);
  }
}

async function del(key) {
  const fullKey = makeKey(key);
  if (useRedis && redis) {
    try { await redis.del(fullKey); } catch (e) { logger.warn({ err: e.message, key }, 'Redis DEL failed'); }
  }
  memoryCache.delete(fullKey);
}

async function invalidatePrefix(prefix) {
  const fullPrefix = makeKey(prefix);
  if (useRedis && redis) {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${fullPrefix}*`, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length) await redis.del(...keys);
      } while (cursor !== '0');
      return;
    } catch (e) {
      logger.warn({ err: e.message, prefix }, 'Redis SCAN failed — falling back to memory');
    }
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(fullPrefix)) memoryCache.delete(key);
  }
}

async function getOrSet(key, fetcher, ttlSeconds = 300) {
  const cached = await get(key);
  if (cached !== null) return cached;
  const fresh = await fetcher();
  await set(key, fresh, ttlSeconds);
  return fresh;
}

function isRedisEnabled() {
  return useRedis;
}

async function shutdown() {
  if (redis) {
    await redis.quit().catch(() => {});
    redis = null;
    useRedis = false;
  }
}

initRedis();

module.exports = { get, set, del, invalidatePrefix, getOrSet, isRedisEnabled, shutdown, CACHE_PREFIX };