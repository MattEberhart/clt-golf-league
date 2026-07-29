import "server-only";
import { db, schema } from "@/db/client";
import { asc, desc, eq } from "drizzle-orm";
import { getCurrentRound, roundSortKey } from "./schedule";
import { resolveHandicaps } from "./handicaps";

export async function getCurrentSeason(): Promise<schema.Season> {
  const rows = await db
    .select()
    .from(schema.seasons)
    .where(eq(schema.seasons.isCurrent, true));
  const season = rows[0];
  if (!season) throw new Error("No current season — check the seasons table.");
  return season;
}

export async function getTeamsForSeason(seasonId: number) {
  return db
    .select()
    .from(schema.teams)
    .where(eq(schema.teams.seasonId, seasonId))
    .orderBy(asc(schema.teams.number));
}

export async function getRoundsForSeason(seasonId: number) {
  const rows = await db
    .select()
    .from(schema.rounds)
    .where(eq(schema.rounds.seasonId, seasonId));
  return rows.sort(
    (a, b) => roundSortKey(a.number) - roundSortKey(b.number),
  );
}

export async function getAllCourses() {
  return db.select().from(schema.courses);
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

export type PlayerOnTeam = {
  playerId: number;
  slot: number;
  name: string;
  /** Adjusted handicap in effect at the round being viewed. */
  adjHcp: number;
  /**
   * Raw handicap of the revision in effect. Null when a revision restated only
   * the adjusted number — an earlier raw is not carried forward, since it no
   * longer corresponds to the adjusted figure shown next to it.
   */
  rawHcp: string | null;
  /** Adjusted handicap this one replaced, null if never revised. */
  priorAdjHcp: number | null;
  effectiveFromRound: string;
  priorEffectiveFromRound: string | null;
};

export type TeamWithPlayers = schema.Team & {
  players: PlayerOnTeam[];
  player1Name: string;
  player2Name: string;
};

export type ScheduleData = {
  season: schema.Season;
  rounds: schema.Round[];
  courses: schema.Course[];
  teams: TeamWithPlayers[];
  matchups: schema.Matchup[];
  results: schema.Result[];
};

export async function getScheduleData(): Promise<ScheduleData> {
  const season = await getCurrentSeason();
  const [rounds, courses, teams, allMatchups, allResults, rosters, handicaps] =
    await Promise.all([
      getRoundsForSeason(season.id),
      getAllCourses(),
      getTeamsForSeason(season.id),
      getAllMatchups(),
      getAllResults(),
      db
        .select({
          teamId: schema.teamPlayers.teamId,
          slot: schema.teamPlayers.slot,
          playerId: schema.players.id,
          name: schema.players.name,
        })
        .from(schema.teamPlayers)
        .innerJoin(
          schema.players,
          eq(schema.players.id, schema.teamPlayers.playerId),
        )
        .orderBy(asc(schema.teamPlayers.slot)),
      db
        .select()
        .from(schema.playerHandicaps)
        .where(eq(schema.playerHandicaps.seasonId, season.id)),
    ]);

  const roundIds = new Set(rounds.map((r) => r.id));
  const matchups = allMatchups.filter((m) => roundIds.has(m.roundId));
  const matchupIds = new Set(matchups.map((m) => m.id));
  const results = allResults.filter((r) => matchupIds.has(r.matchupId));

  const currentRound = getCurrentRound(rounds, results, matchups);
  const resolved = resolveHandicaps(handicaps, currentRound.number);
  const teamIds = new Set(teams.map((t) => t.id));

  const playersByTeam = new Map<number, PlayerOnTeam[]>();
  for (const row of rosters) {
    if (!teamIds.has(row.teamId)) continue;
    const hcp = resolved.get(row.playerId);
    if (!hcp) continue;
    const arr = playersByTeam.get(row.teamId) ?? [];
    arr.push({
      playerId: row.playerId,
      slot: row.slot,
      name: row.name,
      adjHcp: hcp.current.adjHcp,
      rawHcp: hcp.current.rawHcp,
      priorAdjHcp: hcp.prior?.adjHcp ?? null,
      effectiveFromRound: hcp.current.effectiveFromRound,
      priorEffectiveFromRound: hcp.prior?.effectiveFromRound ?? null,
    });
    playersByTeam.set(row.teamId, arr);
  }

  return {
    season,
    rounds,
    courses,
    matchups,
    results,
    teams: teams.map((team) => {
      const players = (playersByTeam.get(team.id) ?? []).sort(
        (a, b) => a.slot - b.slot,
      );
      return {
        ...team,
        players,
        player1Name: players[0]?.name ?? "",
        player2Name: players[1]?.name ?? "",
      };
    }),
  };
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
