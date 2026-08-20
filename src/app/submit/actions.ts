"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import {
  createSession,
  destroySession,
  hasSession,
  verifyPassword,
} from "@/lib/auth";
import { reseedChampIfNeeded } from "@/lib/championship";
import {
  checkLoginRateLimit,
  clearLoginFailures,
  identifyClient,
  lockoutMessage,
  recordLoginFailure,
} from "@/lib/rate-limit";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState | undefined,
  formData: FormData,
): Promise<LoginState> {
  const client = await identifyClient();
  const gate = await checkLoginRateLimit(client);
  if (!gate.allowed) {
    return { error: lockoutMessage(gate.retryAfterSeconds) };
  }

  const password = String(formData.get("password") ?? "");
  if (!verifyPassword(password)) {
    const after = await recordLoginFailure(client);
    return {
      error: after.allowed
        ? "Wrong password."
        : lockoutMessage(after.retryAfterSeconds),
    };
  }

  await clearLoginFailures(client);
  await createSession();
  redirect("/submit");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/submit");
}

const submitSchema = z
  .object({
    matchupId: z.coerce.number().int().positive(),
    winnerTeamId: z.coerce.number().int().positive().optional(),
    mov: z.coerce.number().int().min(0).max(18).optional(),
    isTie: z.coerce.boolean(),
    submittedByLabel: z.string().trim().min(1).max(60),
  })
  .superRefine((data, ctx) => {
    if (!data.isTie) {
      if (data.winnerTeamId == null) {
        ctx.addIssue({
          code: "custom",
          path: ["winnerTeamId"],
          message: "Select a winner.",
        });
      }
      if ((data.mov ?? 0) < 1) {
        ctx.addIssue({
          code: "custom",
          path: ["mov"],
          message: "Margin must be at least 1 for a win.",
        });
      }
    }
  });

export type SubmitState = { error?: string; ok?: boolean };

/**
 * Seeding is idempotent, so every authenticated submission retries it and a
 * submission that failed to seed heals on the next one. A seeding failure must
 * never fail a submission whose result row is already committed.
 */
async function trySeedChamp(): Promise<void> {
  try {
    await reseedChampIfNeeded();
  } catch (err) {
    console.error("champ seeding failed", err);
  }
}

/**
 * Explicit recovery path: seeding normally happens as part of submitting the
 * final regular-season result, but if that attempt failed (or the results
 * predate automatic seeding) there is no submission left to piggyback on.
 */
export async function seedChampAction(): Promise<void> {
  if (!(await hasSession())) return;
  await reseedChampIfNeeded();
  revalidatePath("/");
  revalidatePath("/schedule");
  revalidatePath("/submit");
}

export async function submitResultAction(
  _prev: SubmitState | undefined,
  formData: FormData,
): Promise<SubmitState> {
  if (!(await hasSession())) {
    return { error: "Session expired. Please re-enter the password." };
  }

  await trySeedChamp();

  const parsed = submitSchema.safeParse({
    matchupId: formData.get("matchupId"),
    winnerTeamId: formData.get("winnerTeamId"),
    mov: formData.get("mov"),
    isTie: formData.get("isTie"),
    submittedByLabel: formData.get("submittedByLabel"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { matchupId, winnerTeamId, mov, isTie, submittedByLabel } = parsed.data;

  const matchup = (
    await db.select().from(schema.matchups).where(eq(schema.matchups.id, matchupId))
  )[0];
  if (!matchup) return { error: "Matchup not found." };

  let finalWinnerTeamId: number;
  let finalLoserTeamId: number;
  let finalMov: number;

  if (isTie) {
    finalWinnerTeamId = matchup.teamAId;
    finalLoserTeamId = matchup.teamBId;
    finalMov = 0;
  } else {
    if (winnerTeamId == null) {
      return { error: "Select a winner." };
    }
    if (winnerTeamId !== matchup.teamAId && winnerTeamId !== matchup.teamBId) {
      return { error: "Winner must be one of the two teams in this matchup." };
    }
    finalWinnerTeamId = winnerTeamId;
    finalLoserTeamId = winnerTeamId === matchup.teamAId ? matchup.teamBId : matchup.teamAId;
    finalMov = mov ?? 0;
  }

  const existing = await db
    .select()
    .from(schema.results)
    .where(eq(schema.results.matchupId, matchupId));
  if (existing.length > 0) {
    return { error: "This matchup already has a result. Use /admin to edit." };
  }

  await db.insert(schema.results).values({
    matchupId,
    winnerTeamId: finalWinnerTeamId,
    loserTeamId: finalLoserTeamId,
    mov: finalMov,
    isTie,
    submittedAt: new Date().toISOString(),
    submittedByLabel,
  });

  await trySeedChamp();

  revalidatePath("/");
  revalidatePath("/standings");
  revalidatePath("/results");
  revalidatePath("/schedule");
  revalidatePath("/teams");

  return { ok: true };
}
