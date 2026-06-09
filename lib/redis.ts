import { Redis } from '@upstash/redis'

// Redis client — reads from env vars automatically
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Cache key for a search query
// We normalise the query (lowercase + trim) so
// "Remote React Job" and "remote react job" hit the same cache
export function searchCacheKey(query: string): string {
  return `search:${query.toLowerCase().trim()}`
}

// Cache TTL — how long to keep results
// 1 hour = results feel fresh but repeated searches are fast
export const CACHE_TTL_SECONDS = 60 * 60