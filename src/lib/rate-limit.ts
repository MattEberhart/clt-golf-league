import "server-only";
import { headers } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";

const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const PER_IP_FREE_ATTEMPTS = 5;
const GLOBAL_FREE_ATTEMPTS = 20;
const BASE_LOCKOUT_MS = 30 * 1000;
const MAX_LOCKOUT_MS = 60 * 60 * 1000;
const BASE_FAILURE_DELAY_MS = 750;
const MAX_FAILURE_DELAY_MS = 8 * 1000;

const GLOBAL_KEY = "global";
const IP_KEY_PREFIX = "ip:";

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * `identified` is false when no proxy header tells us who the caller is: every
 * such request shares one bucket, so it only ever earns extra delay, never a
 * lockout that would take the whole league down with it.
 */
export type LoginClient = { key: string; identified: boolean };

export async function identifyClient(): Promise<LoginClient> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || h.get("x-real-ip")?.trim();
  return { key: `${IP_KEY_PREFIX}${ip ?? "unknown"}`, identified: Boolean(ip) };
}

function lockoutFor(failures: number): number {
  const overage = failures - PER_IP_FREE_ATTEMPTS;
  if (overage < 1) return 0;
  return Math.min(BASE_LOCKOUT_MS * 2 ** (overage - 1), MAX_LOCKOUT_MS);
}

/**
 * Extra think-time once league-wide failures pile up. Deliberately a delay and
 * not a lockout: distributed guessing has to be slowed down without letting one
 * attacker bar members who know the password.
 */
function failureDelayFor(globalFailures: number): number {
  const overage = globalFailures - GLOBAL_FREE_ATTEMPTS;
  if (overage < 1) return BASE_FAILURE_DELAY_MS;
  return Math.min(BASE_FAILURE_DELAY_MS * 2 ** overage, MAX_FAILURE_DELAY_MS);
}

/** Lockout state of this client's own bucket. */
export async function checkLoginRateLimit(
  client: LoginClient,
): Promise<RateLimitDecision> {
  if (!client.identified) return { allowed: true };

  const now = Date.now();
  const row = (
    await db
      .select()
      .from(schema.loginAttempts)
      .where(eq(schema.loginAttempts.key, client.key))
  )[0];

  return decide(row?.lockedUntilMs ?? 0, now);
}

/**
 * Counts a failed guess against the client's bucket and the league-wide one,
 * then sleeps before answering so guessing stays slow even below the lockout
 * threshold. Only the client's own bucket can escalate into a lockout.
 */
export async function recordLoginFailure(
  client: LoginClient,
): Promise<RateLimitDecision> {
  const now = Date.now();
  const globalFailures = await countFailure(GLOBAL_KEY, now);
  const clientFailures = await countFailure(client.key, now);

  let lockedUntilMs = 0;
  if (client.identified) {
    const lockout = lockoutFor(clientFailures);
    if (lockout > 0) {
      lockedUntilMs = now + lockout;
      await db
        .update(schema.loginAttempts)
        .set({ lockedUntilMs: sql`max(${lockedUntilMs}, ${schema.loginAttempts.lockedUntilMs})` })
        .where(eq(schema.loginAttempts.key, client.key));
    }
  }

  await sleep(failureDelayFor(globalFailures));

  return decide(lockedUntilMs, now);
}

/**
 * Clears the client's own failures after a valid password. The league-wide row
 * is left alone so a member signing in cannot hand an attacker a fresh budget;
 * it ages out on its own via the failure window.
 */
export async function clearLoginFailures(client: LoginClient): Promise<void> {
  await db.delete(schema.loginAttempts).where(eq(schema.loginAttempts.key, client.key));
}

export function lockoutMessage(retryAfterSeconds: number): string {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  const wait =
    retryAfterSeconds < 60
      ? `${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"}`
      : `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `Too many failed attempts. Try again in ${wait}.`;
}

/** Increments a bucket inside its sliding window and returns the new count. */
async function countFailure(key: string, now: number): Promise<number> {
  const windowExpired = sql`${now} - ${schema.loginAttempts.windowStartedAtMs} > ${FAILURE_WINDOW_MS}`;
  const rows = await db
    .insert(schema.loginAttempts)
    .values({ key, failures: 1, windowStartedAtMs: now, lockedUntilMs: 0 })
    .onConflictDoUpdate({
      target: schema.loginAttempts.key,
      // Recomputed in SQL so concurrent requests cannot lose increments.
      set: {
        failures: sql`case when ${windowExpired} then 1 else ${schema.loginAttempts.failures} + 1 end`,
        windowStartedAtMs: sql`case when ${windowExpired} then ${now} else ${schema.loginAttempts.windowStartedAtMs} end`,
      },
    })
    .returning({ failures: schema.loginAttempts.failures });

  return rows[0]?.failures ?? 1;
}

function decide(lockedUntilMs: number, now: number): RateLimitDecision {
  if (lockedUntilMs > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((lockedUntilMs - now) / 1000) };
  }
  return { allowed: true };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
