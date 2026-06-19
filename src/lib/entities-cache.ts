// Simple in-memory cache for the entities list.
// Entities rarely change, so we cache the list for 5 minutes to avoid
// hitting Turso (which adds ~0.5s network round-trip per call) on every request.
//
// NOTE: This cache is per-serverless-instance. On Vercel, different instances
// may serve slightly stale data for up to TTL after an update. This is acceptable
// for entities (which change infrequently) and the trade-off is a 10x faster
// entity list load after login.

type EntityCacheEntry = {
  data: unknown[];
  expires: number;
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let cache: EntityCacheEntry | null = null;

export function getEntitiesCache(): unknown[] | null {
  if (cache && cache.expires > Date.now()) {
    return cache.data;
  }
  cache = null;
  return null;
}

export function setEntitiesCache(data: unknown[]): void {
  cache = { data, expires: Date.now() + CACHE_TTL };
}

export function invalidateEntitiesCache(): void {
  cache = null;
}
