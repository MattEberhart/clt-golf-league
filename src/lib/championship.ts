import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { getCurrentSeason } from "./queries";
import { rankTeams } from "./standings";
import type { Matchup, Result, Round, Team } from "@/db/schema";
import { isRoundComplete } from "./schedule";

/**
 * Slot 1 = championship (#1 vs #2)
 * Slot 2 = 3rd-place match (#3 vs #4)
 * Slot 3 = consolation (#5 vs #6)
 */
const CHAMP_SLOT_LABEL: Record<number, string> = {
  1: "Championship",
  2: "3rd-place",
  3: "Consolation",
};

export function champSlotLabel(slot: number): string {
  return CHAMP_SLOT_LABEL[slot] ?? `Slot ${slot}`;
}

/**
 * If all 5 regular rounds are complete and no champ matchups exist yet,
 * compute seeds via rankTeams and insert the three champ matchups.
 *
 * Write path only — never call this from a page render. The eligibility check
 * and the inserts run in one transaction and the inserts ignore conflicts on
 * `matchups_round_slot_unique`, so concurrent callers cannot double-seed or
 * fail on the unique index.
 */
export async function ensureChampMatchups(input: {
  rounds: Round[];
  matchups: Matchup[];
  results: Result[];
  teams: Team[];
}): Promise<void> {
  const { rounds, matchups, results, teams } = input;

  const champRound = rounds.find((r) => r.number === "champ");
  if (!champRound) return;

  const existing = matchups.filter((m) => m.roundId === champRound.id);
  if (existing.length > 0) return;

  const numbered = rounds
    .filter((r) => r.number !== "champ")
    .sort((a, b) => Number(a.number) - Number(b.number));
  const allDone = numbered.every((r) => isRoundComplete(r, matchups, results));
  if (!allDone) return;

  const ranked = rankTeams(teams, results);
  if (ranked.length < 6) return;

  const seedPairs: Array<[number, number, number]> = [
    [ranked[0].team.id, ranked[1].team.id, 1], // championship
    [ranked[2].team.id, ranked[3].team.id, 2], // 3rd
    [ranked[4].team.id, ranked[5].team.id, 3], // consolation
  ];

  await db.transaction(async (tx) => {
    const alreadySeeded = await tx
      .select({ id: schema.matchups.id })
      .from(schema.matchups)
      .where(eq(schema.matchups.roundId, champRound.id));
    if (alreadySeeded.length > 0) return;

    await tx
      .insert(schema.matchups)
      .values(
        seedPairs.map(([a, b, slot]) => ({
          roundId: champRound.id,
          teamAId: a,
          teamBId: b,
          slot,
        })),
      )
      .onConflictDoNothing({
        target: [schema.matchups.roundId, schema.matchups.slot],
      });
  });
}

/**
 * Seed the champ round if it is due. Call only from authenticated write paths
 * (e.g. after a result is submitted), not from GET renders.
 */
export async function reseedChampIfNeeded(): Promise<void> {
  const season = await getCurrentSeason();
  const [rounds, matchups, results, teams] = await Promise.all([
    db
      .select()
      .from(schema.rounds)
      .where(eq(schema.rounds.seasonId, season.id)),
    db.select().from(schema.matchups),
    db.select().from(schema.results),
    db.select().from(schema.teams).where(eq(schema.teams.seasonId, season.id)),
  ]);
  await ensureChampMatchups({ rounds, matchups, results, teams });
}
