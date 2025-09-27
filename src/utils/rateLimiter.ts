/**
 * Creates a simple token bucket rate limiter. It allows up to `maxPerMin` logs
 * per minute. When the limit is reached, subsequent logs are dropped until the
 * next minute window.
 * @param maxPerMin - Maximum number of logs allowed per minute
 * @returns A function that returns true if the log should be allowed
 */
export function makeRateLimiter(maxPerMin: number): () => boolean {
  let count = 0;
  let windowStart = Date.now();
  return () => {
    const now = Date.now();
    // reset the window every minute
    if (now - windowStart >= 60_000) {
      windowStart = now;
      count = 0;
    }
    count += 1;
    return count <= maxPerMin;
  };
}