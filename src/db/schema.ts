import {
  sqliteTable,
  integer,
  text,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

export const seasons = sqliteTable(
  "seasons",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    year: integer("year").notNull(),
    name: text("name").notNull(),
    isCurrent: integer("is_current", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => [uniqueIndex("seasons_year_unique").on(t.year)],
);

/**
 * League-wide identity, deliberately not season-scoped: a player keeps the same
 * row (and therefore the same handicap history) across seasons and team changes.
 */
export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
});

export const teams = sqliteTable(
  "teams",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    seasonId: integer("season_id")
      .notNull()
      .references(() => seasons.id),
    number: integer("number").notNull(),
  },
  (t) => [uniqueIndex("teams_season_number_unique").on(t.seasonId, t.number)],
);

/** Roster for one season. Slot is display order only. */
export const teamPlayers = sqliteTable(
  "team_players",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    slot: integer("slot").notNull(),
  },
  (t) => [
    uniqueIndex("team_players_team_slot_unique").on(t.teamId, t.slot),
    uniqueIndex("team_players_team_player_unique").on(t.teamId, t.playerId),
  ],
);

/**
 * Append-only handicap log. One row per player per change — a player whose
 * handicap did not move has no row for that revision. The value in effect at
 * round R is the latest row with `effectiveFromRound` at or before R, so old
 * numbers are never overwritten.
 */
export const playerHandicaps = sqliteTable(
  "player_handicaps",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    seasonId: integer("season_id")
      .notNull()
      .references(() => seasons.id),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    rawHcp: text("raw_hcp"),
    adjHcp: integer("adj_hcp").notNull(),
    // rounds.number: "1".."5" or "champ"
    effectiveFromRound: text("effective_from_round").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("player_hcp_unique").on(
      t.seasonId,
      t.playerId,
      t.effectiveFromRound,
    ),
    index("player_hcp_season_idx").on(t.seasonId),
  ],
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
    seasonId: integer("season_id")
      .notNull()
      .references(() => seasons.id),
    // "1".."5" or "champ"
    number: text("number").notNull(),
    courseId: integer("course_id").references(() => courses.id),
    windowStart: text("window_start").notNull(), // ISO date YYYY-MM-DD
    windowEnd: text("window_end").notNull(), // ISO date YYYY-MM-DD
    label: text("label").notNull(),
  },
  (t) => [uniqueIndex("rounds_season_number_unique").on(t.seasonId, t.number)],
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

/**
 * Failed-login bookkeeping for the shared submit password. Keyed by client IP
 * (plus one aggregate row) so the throttle survives serverless instance churn.
 */
export const loginAttempts = sqliteTable("login_attempts", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  windowStartedAtMs: integer("window_started_at_ms").notNull(),
  lockedUntilMs: integer("locked_until_ms").notNull().default(0),
});

export type Season = typeof seasons.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type TeamPlayer = typeof teamPlayers.$inferSelect;
export type PlayerHandicap = typeof playerHandicaps.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Round = typeof rounds.$inferSelect;
export type Matchup = typeof matchups.$inferSelect;
export type Result = typeof results.$inferSelect;
export type LoginAttempt = typeof loginAttempts.$inferSelect;
