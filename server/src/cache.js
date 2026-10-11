const logger = require('./logger');

const memoryCache = new Map();
const CACHE_PREFIX = 'meridianed:';

function makeKey(key) {
  return `${CACHE_PREFIX}${key}`;
}

async function get(key) {
  const fullKey = makeKey(key);
  const entry = memoryCache.get(fullKey);
  if (entry && Date.now() < entry.expires) return entry.value;
  if (entry) memoryCache.delete(fullKey);
  return null;
}

async function set(key, value, ttlSeconds = 300) {
  const fullKey = makeKey(key);
  const serialized = JSON.stringify(value);
  memoryCache.set(fullKey, { value, expires: Date.now() + ttlSeconds * 1000 });
  if (memoryCache.size > 10000) {
    const keys = [...memoryCache.keys()];
    for (let i = 0; i < 5000; i++) memoryCache.delete(keys[i]);
  }
}

async function del(key) {
  const fullKey = makeKey(key);
  memoryCache.delete(fullKey);
}

async function invalidatePrefix(prefix) {
  const fullPrefix = makeKey(prefix);
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
  return false;
}

async function shutdown() {
  memoryCache.clear();
}

logger.info('Using in-memory cache (Redis removed)');

module.exports = { get, set, del, invalidatePrefix, getOrSet, isRedisEnabled, shutdown, CACHE_PREFIX };