import "server-only";
import { db, schema } from "@/db/client";
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
 * Idempotent — safe to call on every page load.
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

  for (const [a, b, slot] of seedPairs) {
    await db.insert(schema.matchups).values({
      roundId: champRound.id,
      teamAId: a,
      teamBId: b,
      slot,
    });
  }
}

export async function reseedChampIfNeeded(): Promise<void> {
  const [rounds, matchups, results, teams] = await Promise.all([
    db.select().from(schema.rounds),
    db.select().from(schema.matchups),
    db.select().from(schema.results),
    db.select().from(schema.teams),
  ]);
  await ensureChampMatchups({ rounds, matchups, results, teams });
}
