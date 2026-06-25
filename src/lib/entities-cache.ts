// Simple in-memory cache for the entities list.
// Entities rarely change, so we cache the list to avoid hitting Turso on every
// request. Vercel reuses serverless instances, so the cache is per-instance.
//
// ★ TTL is 60 seconds (was 5 min — too stale). 60s is short enough that admin
//   edits (create/update/delete entity) propagate within a minute, but long
//   enough to dramatically speed up the entity-selection page when a user
//   navigates around.

type EntityCacheEntry = {
  data: unknown[];
  expires: number;
};

const CACHE_TTL = 60 * 1000; // 60 seconds (was 5 min)

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
