import "server-only";
import { db, schema } from "@/db/client";
import { asc, desc, eq } from "drizzle-orm";

export async function getAllTeams() {
  return db.select().from(schema.teams).orderBy(asc(schema.teams.number));
}

export async function getAllCourses() {
  return db.select().from(schema.courses);
}

export async function getAllRounds() {
  // Sort: numbered rounds first by number ascending, then "champ" last.
  const rows = await db.select().from(schema.rounds);
  return rows.sort((a, b) => {
    const ai = a.number === "champ" ? 999 : Number(a.number);
    const bi = b.number === "champ" ? 999 : Number(b.number);
    return ai - bi;
  });
}

export async function getAllMatchups() {
  return db.select().from(schema.matchups);
}

export async function getAllResults() {
  return db
    .select()
    .from(schema.results)
    .orderBy(desc(schema.results.submittedAt));
}

export type ScheduleData = {
  rounds: schema.Round[];
  courses: schema.Course[];
  teams: schema.Team[];
  matchups: schema.Matchup[];
  results: schema.Result[];
};

export async function getScheduleData(): Promise<ScheduleData> {
  const [rounds, courses, teams, matchups, results] = await Promise.all([
    getAllRounds(),
    getAllCourses(),
    getAllTeams(),
    getAllMatchups(),
    getAllResults(),
  ]);
  return { rounds, courses, teams, matchups, results };
}

export async function getMatchupsForRound(roundId: number) {
  return db
    .select()
    .from(schema.matchups)
    .where(eq(schema.matchups.roundId, roundId))
    .orderBy(asc(schema.matchups.slot));
}

export async function getResultByMatchupId(matchupId: number) {
  const rows = await db
    .select()
    .from(schema.results)
    .where(eq(schema.results.matchupId, matchupId));
  return rows[0] ?? null;
}

export async function insertResult(input: {
  matchupId: number;
  winnerTeamId: number;
  loserTeamId: number;
  mov: number;
  submittedByLabel: string;
}) {
  await db.insert(schema.results).values({
    ...input,
    submittedAt: new Date().toISOString(),
  });
}
