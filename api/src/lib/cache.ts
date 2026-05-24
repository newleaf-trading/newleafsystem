/**
 * Simple in-memory cache with TTL for API responses.
 * Used to avoid redundant LLM calls and expensive computations.
 *
 * Cache entries are keyed by a string and auto-expire after TTL.
 * Max entries limit prevents unbounded memory growth.
 */

interface CacheEntry<T> {
  data: T;
  ts: number;
  hits: number;
}

export class MemCache<T = any> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private totalHits = 0;
  private totalMisses = 0;

  constructor(ttlSeconds: number, maxEntries = 100) {
    this.ttlMs = ttlSeconds * 1000;
    this.maxEntries = maxEntries;
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) { this.totalMisses++; return null; }
    if (Date.now() - entry.ts > this.ttlMs) {
      this.store.delete(key);
      this.totalMisses++;
      return null;
    }
    entry.hits++;
    this.totalHits++;
    return entry.data;
  }

  set(key: string, data: T): void {
    // Prune if over limit
    if (this.store.size >= this.maxEntries) {
      const oldest = [...this.store.entries()].sort((a, b) => a[1].ts - b[1].ts);
      for (let i = 0; i < Math.ceil(this.maxEntries * 0.2); i++) {
        this.store.delete(oldest[i][0]);
      }
    }
    this.store.set(key, { data, ts: Date.now(), hits: 0 });
  }

  stats() {
    return {
      entries: this.store.size,
      maxEntries: this.maxEntries,
      ttlSeconds: this.ttlMs / 1000,
      totalHits: this.totalHits,
      totalMisses: this.totalMisses,
      hitRate: this.totalHits + this.totalMisses > 0
        ? +((this.totalHits / (this.totalHits + this.totalMisses)) * 100).toFixed(1)
        : 0,
    };
  }

  clear(): void {
    this.store.clear();
  }
}

// ── Pre-configured caches ───────────────────────────────────────────────────

/** Indicators: 5 min TTL. Bars are daily — recomputing every request is wasteful. */
export const indicatorsCache = new MemCache<any>(300, 50);

/** AI Read: 5 min TTL. Same ticker gets same market synthesis. */
export const aiReadCache = new MemCache<any>(300, 50);

/** Recommend: 10 min TTL. Same ticker+expiry gets same strategies. */
export const recommendCache = new MemCache<any>(600, 30);

/** Sentiment: 30 min TTL. News doesn't change in 30 min. Saves $0.01-0.03/call. */
export const sentimentCache = new MemCache<any>(1800, 30);

/** Verify: 30 min TTL. Same legs = same verdict. Saves $0.05 + 24s. */
export const verifyCache = new MemCache<any>(1800, 20);

/** Gamma analysis: 60 min TTL. OI updates daily. */
export const gammaCache = new MemCache<any>(3600, 50);

/** Get stats for all caches */
export function getAllCacheStats() {
  return {
    indicators: indicatorsCache.stats(),
    aiRead: aiReadCache.stats(),
    recommend: recommendCache.stats(),
    sentiment: sentimentCache.stats(),
    verify: verifyCache.stats(),
    gamma: gammaCache.stats(),
  };
}
