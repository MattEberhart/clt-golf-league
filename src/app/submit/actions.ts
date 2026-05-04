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

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState | undefined,
  formData: FormData,
): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  if (!verifyPassword(password)) {
    return { error: "Wrong password." };
  }
  await createSession();
  redirect("/submit");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/submit");
}

const submitSchema = z.object({
  matchupId: z.coerce.number().int().positive(),
  winnerTeamId: z.coerce.number().int().positive(),
  mov: z.coerce.number().int().min(1).max(18),
  submittedByLabel: z.string().trim().min(1).max(60),
});

export type SubmitState = { error?: string; ok?: boolean };

export async function submitResultAction(
  _prev: SubmitState | undefined,
  formData: FormData,
): Promise<SubmitState> {
  if (!(await hasSession())) {
    return { error: "Session expired. Please re-enter the password." };
  }

  const parsed = submitSchema.safeParse({
    matchupId: formData.get("matchupId"),
    winnerTeamId: formData.get("winnerTeamId"),
    mov: formData.get("mov"),
    submittedByLabel: formData.get("submittedByLabel"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { matchupId, winnerTeamId, mov, submittedByLabel } = parsed.data;

  const matchup = (
    await db.select().from(schema.matchups).where(eq(schema.matchups.id, matchupId))
  )[0];
  if (!matchup) return { error: "Matchup not found." };

  if (winnerTeamId !== matchup.teamAId && winnerTeamId !== matchup.teamBId) {
    return { error: "Winner must be one of the two teams in this matchup." };
  }
  const loserTeamId = winnerTeamId === matchup.teamAId ? matchup.teamBId : matchup.teamAId;

  const existing = await db
    .select()
    .from(schema.results)
    .where(eq(schema.results.matchupId, matchupId));
  if (existing.length > 0) {
    return { error: "This matchup already has a result. Use /admin to edit." };
  }

  await db.insert(schema.results).values({
    matchupId,
    winnerTeamId,
    loserTeamId,
    mov,
    submittedAt: new Date().toISOString(),
    submittedByLabel,
  });

  await reseedChampIfNeeded();

  revalidatePath("/");
  revalidatePath("/standings");
  revalidatePath("/results");
  revalidatePath("/schedule");
  revalidatePath("/teams");

  return { ok: true };
}
