import "server-only";
import { headers } from "next/headers";
import { eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";

const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const PER_IP_FREE_ATTEMPTS = 5;
const GLOBAL_FREE_ATTEMPTS = 20;
const BASE_LOCKOUT_MS = 30 * 1000;
const MAX_LOCKOUT_MS = 60 * 60 * 1000;
const FAILURE_DELAY_MS = 750;

const GLOBAL_KEY = "global";
const IP_KEY_PREFIX = "ip:";

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Best-effort client identity. Behind a proxy the leftmost x-forwarded-for hop
 * is the client; without any proxy header we fall back to a shared bucket so
 * requests are still counted (against the global budget at minimum).
 */
export async function clientKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || h.get("x-real-ip")?.trim() || "unknown";
  return `${IP_KEY_PREFIX}${ip}`;
}

function lockoutFor(failures: number, freeAttempts: number): number {
  const overage = failures - freeAttempts;
  if (overage < 1) return 0;
  return Math.min(BASE_LOCKOUT_MS * 2 ** (overage - 1), MAX_LOCKOUT_MS);
}

/** Returns the current lockout state for this client and the league as a whole. */
export async function checkLoginRateLimit(key: string): Promise<RateLimitDecision> {
  const now = Date.now();
  const rows = await db
    .select()
    .from(schema.loginAttempts)
    .where(inArray(schema.loginAttempts.key, [key, GLOBAL_KEY]));

  const lockedUntil = rows.reduce((max, row) => Math.max(max, row.lockedUntilMs), 0);
  if (lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((lockedUntil - now) / 1000),
    };
  }
  return { allowed: true };
}

/**
 * Counts a failed guess against both the per-IP and the league-wide budget,
 * extending the lockout exponentially once the free attempts are used up.
 * Always waits a fixed delay so guessing is slow even before lockout starts.
 */
export async function recordLoginFailure(key: string): Promise<RateLimitDecision> {
  const now = Date.now();
  const buckets: { key: string; freeAttempts: number }[] = [
    { key, freeAttempts: PER_IP_FREE_ATTEMPTS },
    { key: GLOBAL_KEY, freeAttempts: GLOBAL_FREE_ATTEMPTS },
  ];

  let lockedUntil = 0;
  for (const bucket of buckets) {
    const existing = (
      await db
        .select()
        .from(schema.loginAttempts)
        .where(eq(schema.loginAttempts.key, bucket.key))
    )[0];

    const windowExpired =
      !existing || now - existing.windowStartedAtMs > FAILURE_WINDOW_MS;
    const failures = windowExpired ? 1 : existing.failures + 1;
    const windowStartedAtMs = windowExpired ? now : existing.windowStartedAtMs;
    const lockout = lockoutFor(failures, bucket.freeAttempts);
    const lockedUntilMs = lockout > 0 ? now + lockout : (existing?.lockedUntilMs ?? 0);

    await db
      .insert(schema.loginAttempts)
      .values({ key: bucket.key, failures, windowStartedAtMs, lockedUntilMs })
      .onConflictDoUpdate({
        target: schema.loginAttempts.key,
        set: {
          // Recompute in SQL so concurrent requests cannot lose increments.
          failures: sql`case when ${now} - ${schema.loginAttempts.windowStartedAtMs} > ${FAILURE_WINDOW_MS} then 1 else ${schema.loginAttempts.failures} + 1 end`,
          windowStartedAtMs: sql`case when ${now} - ${schema.loginAttempts.windowStartedAtMs} > ${FAILURE_WINDOW_MS} then ${now} else ${schema.loginAttempts.windowStartedAtMs} end`,
          lockedUntilMs: sql`max(${lockedUntilMs}, ${schema.loginAttempts.lockedUntilMs})`,
        },
      });

    lockedUntil = Math.max(lockedUntil, lockedUntilMs);
  }

  await sleep(FAILURE_DELAY_MS);

  if (lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((lockedUntil - now) / 1000),
    };
  }
  return { allowed: true };
}

/** Clears the client's failures (and the league budget) after a valid password. */
export async function clearLoginFailures(key: string): Promise<void> {
  await db
    .delete(schema.loginAttempts)
    .where(inArray(schema.loginAttempts.key, [key, GLOBAL_KEY]));
}

export function lockoutMessage(retryAfterSeconds: number): string {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  const wait =
    retryAfterSeconds < 60
      ? `${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"}`
      : `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `Too many failed attempts. Try again in ${wait}.`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
