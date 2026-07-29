import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { and, eq } from "drizzle-orm";
import * as schema from "./schema";

const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error("TURSO_DATABASE_URL is required");
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const db = drizzle(client, { schema });

const SEASON = { year: 2026, name: "2026 Season" };

// Team number → players in slot order.
const TEAMS: Array<{ number: number; players: [string, string] }> = [
  { number: 1, players: ["Thomas Anderson", "Calvin Troung"] },
  { number: 2, players: ["Will Francis", "Ben Berger"] },
  { number: 3, players: ["Matt Eberhart", "Tyler Young"] },
  { number: 4, players: [`"Slick" Nick Lloyd`, "Andrew Alix"] },
  { number: 5, players: ["Andrew Adam", "Jay Glenn"] },
  { number: 6, players: ["Joe Abrahamson", "David Henderson"] },
];

// Append-only handicap log: one entry per player per change. Players missing
// from a later revision keep the value from the previous one.
const HANDICAPS: Array<{
  effectiveFromRound: string;
  note: string | null;
  createdAt: string;
  values: Array<[name: string, raw: string | null, adj: number]>;
}> = [
  {
    effectiveFromRound: "1",
    note: null,
    createdAt: "2026-04-01T00:00:00.000Z",
    values: [
      ["Thomas Anderson", "23.5", 20],
      ["Calvin Troung", "25.4", 22],
      ["Will Francis", "12.5", 9],
      ["Ben Berger", "2.8", 0],
      ["Matt Eberhart", "20.3", 17],
      ["Tyler Young", "11.0", 8],
      [`"Slick" Nick Lloyd`, "11.2", 8],
      ["Andrew Alix", "25.8", 23],
      ["Andrew Adam", "16.3", 13],
      ["Jay Glenn", "19.8", 17],
      ["Joe Abrahamson", "25.2", 22],
      ["David Henderson", "26.0", 23],
    ],
  },
  {
    // Mid-season re-rate. Raw values pending from the commissioner — see
    // scripts/pending/midseason_raw_handicaps.sql.
    effectiveFromRound: "4",
    note: "Mid-season re-rate",
    createdAt: "2026-07-15T00:00:00.000Z",
    values: [
      ["Thomas Anderson", null, 21],
      ["Calvin Troung", null, 24],
      ["Will Francis", null, 8],
      ["Andrew Alix", null, 25],
      ["Jay Glenn", null, 15],
      ["Andrew Adam", null, 11],
      ["Tyler Young", null, 7],
      ["Matt Eberhart", null, 16],
      ["David Henderson", null, 23],
      ["Joe Abrahamson", null, 19],
      // Adjusted number unchanged, but the re-rate moved their raw handicap —
      // raw pending, so these carry a Round 4 row too.
      ["Ben Berger", null, 0],
      [`"Slick" Nick Lloyd`, null, 8],
    ],
  },
];

const COURSES = [
  { name: "Rocky River" },
  { name: "Tega Cay" },
  { name: "Tradition" },
  { name: "Red Bridge" },
  { name: "Springfield" },
];

const ROUNDS: Array<{
  number: string;
  label: string;
  courseName: string | null;
  windowStart: string;
  windowEnd: string;
  matchups: Array<[number, number]>; // team numbers, slot order
}> = [
  {
    number: "1",
    label: "Round 1",
    courseName: "Rocky River",
    windowStart: "2026-04-01",
    windowEnd: "2026-04-30",
    matchups: [
      [1, 6],
      [2, 5],
      [3, 4],
    ],
  },
  {
    number: "2",
    label: "Round 2",
    courseName: "Tega Cay",
    windowStart: "2026-05-01",
    windowEnd: "2026-05-31",
    matchups: [
      [1, 5],
      [2, 3],
      [4, 6],
    ],
  },
  {
    number: "3",
    label: "Round 3",
    courseName: "Tradition",
    windowStart: "2026-06-01",
    windowEnd: "2026-07-14",
    matchups: [
      [1, 4],
      [2, 6],
      [3, 5],
    ],
  },
  {
    number: "4",
    label: "Round 4",
    courseName: "Red Bridge",
    windowStart: "2026-07-15",
    windowEnd: "2026-08-30",
    matchups: [
      [1, 2],
      [3, 6],
      [4, 5],
    ],
  },
  {
    number: "5",
    label: "Round 5",
    courseName: "Springfield",
    windowStart: "2026-09-01",
    windowEnd: "2026-09-30",
    matchups: [
      [1, 3],
      [2, 4],
      [5, 6],
    ],
  },
  {
    number: "champ",
    label: "Championship",
    courseName: null,
    windowStart: "2026-10-01",
    windowEnd: "2026-10-31",
    matchups: [], // seeded after round 5
  },
];

async function main() {
  console.log("Seeding…");

  // Idempotent guard on teams rather than seasons: migration 0002 inserts the
  // 2026 season row, so a freshly migrated database already has one.
  const existingTeams = await db.select().from(schema.teams);
  if (existingTeams.length > 0) {
    console.log("League already seeded — exiting.");
    return;
  }

  const existingSeason = await db
    .select()
    .from(schema.seasons)
    .where(eq(schema.seasons.year, SEASON.year));
  const [season] =
    existingSeason.length > 0
      ? existingSeason
      : await db
          .insert(schema.seasons)
          .values({ year: SEASON.year, name: SEASON.name, isCurrent: true })
          .returning({ id: schema.seasons.id });

  // Players, then season rosters.
  const playerIdByName = new Map<string, number>();
  for (const t of TEAMS) {
    const [team] = await db
      .insert(schema.teams)
      .values({ seasonId: season.id, number: t.number })
      .returning({ id: schema.teams.id });

    let slot = 1;
    for (const name of t.players) {
      const [player] = await db
        .insert(schema.players)
        .values({ name })
        .returning({ id: schema.players.id });
      playerIdByName.set(name, player.id);
      await db.insert(schema.teamPlayers).values({
        teamId: team.id,
        playerId: player.id,
        slot,
      });
      slot++;
    }
  }

  for (const revision of HANDICAPS) {
    for (const [name, raw, adj] of revision.values) {
      const playerId = playerIdByName.get(name);
      if (!playerId) throw new Error(`Unknown player in HANDICAPS: ${name}`);
      await db.insert(schema.playerHandicaps).values({
        seasonId: season.id,
        playerId,
        rawHcp: raw,
        adjHcp: adj,
        effectiveFromRound: revision.effectiveFromRound,
        note: revision.note,
        createdAt: revision.createdAt,
      });
    }
  }

  // Courses
  for (const c of COURSES) {
    await db.insert(schema.courses).values({ name: c.name });
  }

  // Rounds + matchups
  for (const r of ROUNDS) {
    let courseId: number | null = null;
    if (r.courseName) {
      const found = await db.select().from(schema.courses).where(eq(schema.courses.name, r.courseName));
      courseId = found[0]?.id ?? null;
    }
    const inserted = await db
      .insert(schema.rounds)
      .values({
        seasonId: season.id,
        number: r.number,
        courseId,
        windowStart: r.windowStart,
        windowEnd: r.windowEnd,
        label: r.label,
      })
      .returning({ id: schema.rounds.id });
    const roundId = inserted[0].id;

    let slot = 1;
    for (const [aNum, bNum] of r.matchups) {
      const teamA = await team(season.id, aNum);
      const teamB = await team(season.id, bNum);
      await db.insert(schema.matchups).values({
        roundId,
        teamAId: teamA.id,
        teamBId: teamB.id,
        slot,
      });
      slot++;
    }
  }

  // Seed two existing Round 1 results: T3 def. T4 (3 UP), T2 def. T5 (3 UP)
  const round1 = (
    await db
      .select()
      .from(schema.rounds)
      .where(
        and(
          eq(schema.rounds.seasonId, season.id),
          eq(schema.rounds.number, "1"),
        ),
      )
  )[0];
  const round1Matchups = await db
    .select()
    .from(schema.matchups)
    .where(eq(schema.matchups.roundId, round1.id));

  const t2 = await team(season.id, 2);
  const t3 = await team(season.id, 3);
  const t4 = await team(season.id, 4);
  const t5 = await team(season.id, 5);

  const m34 = round1Matchups.find(
    (m) => (m.teamAId === t3.id && m.teamBId === t4.id) || (m.teamAId === t4.id && m.teamBId === t3.id),
  )!;
  const m25 = round1Matchups.find(
    (m) => (m.teamAId === t2.id && m.teamBId === t5.id) || (m.teamAId === t5.id && m.teamBId === t2.id),
  )!;

  const submittedAt = "2026-04-15T19:00:00.000Z";
  await db.insert(schema.results).values([
    {
      matchupId: m34.id,
      winnerTeamId: t3.id,
      loserTeamId: t4.id,
      mov: 3,
      submittedAt,
      submittedByLabel: "seed",
    },
    {
      matchupId: m25.id,
      winnerTeamId: t2.id,
      loserTeamId: t5.id,
      mov: 3,
      submittedAt,
      submittedByLabel: "seed",
    },
  ]);

  console.log("Seed complete.");
}

async function team(seasonId: number, number: number) {
  const rows = await db
    .select()
    .from(schema.teams)
    .where(
      and(eq(schema.teams.seasonId, seasonId), eq(schema.teams.number, number)),
    );
  return rows[0];
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => client.close());
