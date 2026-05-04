import {
  sqliteTable,
  integer,
  text,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

export const teams = sqliteTable(
  "teams",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    number: integer("number").notNull(),
    player1Name: text("player1_name").notNull(),
    player1RawHcp: text("player1_raw_hcp").notNull(),
    player1AdjHcp: integer("player1_adj_hcp").notNull(),
    player2Name: text("player2_name").notNull(),
    player2RawHcp: text("player2_raw_hcp").notNull(),
    player2AdjHcp: integer("player2_adj_hcp").notNull(),
  },
  (t) => [uniqueIndex("teams_number_unique").on(t.number)],
);

export const courses = sqliteTable("courses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  notes: text("notes"),
});

export const rounds = sqliteTable(
  "rounds",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // "1".."5" or "champ"
    number: text("number").notNull(),
    courseId: integer("course_id").references(() => courses.id),
    windowStart: text("window_start").notNull(), // ISO date YYYY-MM-DD
    windowEnd: text("window_end").notNull(), // ISO date YYYY-MM-DD
    label: text("label").notNull(),
  },
  (t) => [uniqueIndex("rounds_number_unique").on(t.number)],
);

export const matchups = sqliteTable(
  "matchups",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    roundId: integer("round_id")
      .notNull()
      .references(() => rounds.id),
    teamAId: integer("team_a_id")
      .notNull()
      .references(() => teams.id),
    teamBId: integer("team_b_id")
      .notNull()
      .references(() => teams.id),
    slot: integer("slot").notNull(),
  },
  (t) => [
    uniqueIndex("matchups_round_slot_unique").on(t.roundId, t.slot),
    index("matchups_round_idx").on(t.roundId),
  ],
);

export const results = sqliteTable(
  "results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    matchupId: integer("matchup_id")
      .notNull()
      .references(() => matchups.id),
    winnerTeamId: integer("winner_team_id")
      .notNull()
      .references(() => teams.id),
    loserTeamId: integer("loser_team_id")
      .notNull()
      .references(() => teams.id),
    mov: integer("mov").notNull(),
    submittedAt: text("submitted_at").notNull(),
    submittedByLabel: text("submitted_by_label").notNull(),
  },
  (t) => [uniqueIndex("results_matchup_unique").on(t.matchupId)],
);

export type Team = typeof teams.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Round = typeof rounds.$inferSelect;
export type Matchup = typeof matchups.$inferSelect;
export type Result = typeof results.$inferSelect;
