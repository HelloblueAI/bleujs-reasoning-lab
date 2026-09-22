/**
 * Access checks for operator-only endpoints and per-client rate limiting.
 */

/** Minimal shape of the Workers Rate Limiting binding. */
export type RateLimiter = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

async function sha256(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return new Uint8Array(digest);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/**
 * True only when a token is configured and the request presents it as a
 * Bearer credential. An unset token denies everyone (fail closed).
 */
export async function hasBearerToken(
  request: Request,
  expected: string | undefined,
): Promise<boolean> {
  if (!expected) return false;
  const header = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;
  // Hash both sides so the comparison length never depends on the secret.
  const [given, wanted] = await Promise.all([
    sha256(match[1]!.trim()),
    sha256(expected),
  ]);
  return constantTimeEqual(given, wanted);
}

/**
 * Applies the optional rate limiter. Without a binding (local dev, forks)
 * every request is allowed.
 */
export async function isWithinRateLimit(
  request: Request,
  limiter: RateLimiter | undefined,
): Promise<boolean> {
  if (!limiter) return true;
  const key = request.headers.get("CF-Connecting-IP") ?? "unknown";
  try {
    const { success } = await limiter.limit({ key });
    return success;
  } catch {
    return true;
  }
}
