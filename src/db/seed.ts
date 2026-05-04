import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error("TURSO_DATABASE_URL is required");
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const db = drizzle(client, { schema });

const TEAMS = [
  { number: 1, p1: ["Thomas Anderson", "23.5", 20], p2: ["Calvin Troung", "25.4", 22] },
  { number: 2, p1: ["Will Francis", "12.5", 9], p2: ["Ben Berger", "2.8", 0] },
  { number: 3, p1: ["Matt Eberhart", "20.3", 17], p2: ["Tyler Young", "11.0", 8] },
  { number: 4, p1: [`"Slick" Nick Lloyd`, "11.2", 8], p2: ["Andrew Alix", "25.8", 23] },
  { number: 5, p1: ["Andrew Adam", "16.3", 13], p2: ["Jay Glenn", "19.8", 17] },
  { number: 6, p1: ["Joe Abrahamson", "25.2", 22], p2: ["David Henderson", "26.0", 23] },
] as const;

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

  // Idempotent guard: if a team #1 row already exists, assume seeded.
  const existing = await db.select().from(schema.teams).where(eq(schema.teams.number, 1));
  if (existing.length > 0) {
    console.log("Teams already seeded — exiting.");
    return;
  }

  // Teams
  for (const t of TEAMS) {
    await db.insert(schema.teams).values({
      number: t.number,
      player1Name: t.p1[0],
      player1RawHcp: t.p1[1],
      player1AdjHcp: t.p1[2],
      player2Name: t.p2[0],
      player2RawHcp: t.p2[1],
      player2AdjHcp: t.p2[2],
    });
  }

  // Courses
  for (const c of COURSES) {
    await db.insert(schema.courses).values({ name: c.name, notes: "notes" in c ? c.notes : null });
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
      const teamA = await db.select().from(schema.teams).where(eq(schema.teams.number, aNum));
      const teamB = await db.select().from(schema.teams).where(eq(schema.teams.number, bNum));
      await db.insert(schema.matchups).values({
        roundId,
        teamAId: teamA[0].id,
        teamBId: teamB[0].id,
        slot,
      });
      slot++;
    }
  }

  // Seed two existing Round 1 results: T3 def. T4 (3 UP), T2 def. T5 (3 UP)
  const round1 = (await db.select().from(schema.rounds).where(eq(schema.rounds.number, "1")))[0];
  const round1Matchups = await db
    .select()
    .from(schema.matchups)
    .where(eq(schema.matchups.roundId, round1.id));

  const t = async (n: number) => (await db.select().from(schema.teams).where(eq(schema.teams.number, n)))[0];
  const t2 = await t(2);
  const t3 = await t(3);
  const t4 = await t(4);
  const t5 = await t(5);

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

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => client.close());
