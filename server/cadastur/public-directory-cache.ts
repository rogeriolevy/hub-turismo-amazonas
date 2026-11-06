type CacheEntry = {
  expiresAt: number;
  hasValue: boolean;
  value?: unknown;
  pending?: Promise<unknown>;
};

const cacheTtlMs = 60_000;
const caches = new WeakMap<object, Map<string, CacheEntry>>();

function cacheFor(db: object) {
  let cache = caches.get(db);
  if (!cache) {
    cache = new Map();
    caches.set(db, cache);
  }
  return cache;
}

export async function cachedPublicDirectory<T>(
  db: object,
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  const cache = cacheFor(db);
  const current = cache.get(key);
  if (current && (current.pending || current.expiresAt > Date.now())) {
    const value = current.pending ? await current.pending : current.value;
    if (caches.get(db) !== cache || cache.get(key) !== current)
      return cachedPublicDirectory(db, key, load);
    if (current.hasValue || current.pending) return value as T;
  }

  const entry: CacheEntry = { expiresAt: Date.now() + cacheTtlMs, hasValue: false };
  cache.set(key, entry);
  entry.pending = load()
    .then((value) => {
      if (caches.get(db) === cache && cache.get(key) === entry) {
        entry.value = value;
        entry.hasValue = true;
        entry.expiresAt = Date.now() + cacheTtlMs;
        delete entry.pending;
      }
      return value;
    })
    .catch((error: unknown) => {
      if (caches.get(db) === cache && cache.get(key) === entry) cache.delete(key);
      throw error;
    });

  const value = await entry.pending;
  if (caches.get(db) !== cache || cache.get(key) !== entry)
    return cachedPublicDirectory(db, key, load);
  return value as T;
}

export function invalidatePublicDirectoryCache(db: object) {
  caches.delete(db);
}
