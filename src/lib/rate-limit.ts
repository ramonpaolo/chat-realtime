export class SlidingWindow {
    private hits: number[] = []

    constructor(
        private readonly limit: number,
        private readonly windowMs: number,
    ) {}

    take(now = Date.now()): boolean {
        const cutoff = now - this.windowMs
        this.hits = this.hits.filter((timestamp) => timestamp > cutoff)

        if (this.hits.length >= this.limit) return false

        this.hits.push(now)
        return true
    }

    reset(): void {
        this.hits = []
    }
}

interface Bucket {
    hits: number[]
    lastSeen: number
}

export class IpRateLimiter {
    private readonly buckets = new Map<string, Bucket>()

    constructor(
        private readonly limit: number,
        private readonly windowMs: number,
        private readonly maxBuckets = 5_000,
    ) {}

    take(key: string, now = Date.now()): boolean {
        let bucket = this.buckets.get(key)

        if (!bucket) {
            if (this.buckets.size >= this.maxBuckets) this.evictOldest()
            bucket = { hits: [], lastSeen: now }
            this.buckets.set(key, bucket)
        }

        bucket.lastSeen = now
        const cutoff = now - this.windowMs
        bucket.hits = bucket.hits.filter((timestamp) => timestamp > cutoff)

        if (bucket.hits.length >= this.limit) return false

        bucket.hits.push(now)
        return true
    }

    private evictOldest(): void {
        let oldestKey: string | null = null
        let oldestSeen = Number.POSITIVE_INFINITY

        for (const [key, bucket] of this.buckets) {
            if (bucket.lastSeen < oldestSeen) {
                oldestSeen = bucket.lastSeen
                oldestKey = key
            }
        }

        if (oldestKey) this.buckets.delete(oldestKey)
    }
}
