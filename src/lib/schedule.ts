import { toZonedTime } from "date-fns-tz";
import { LEAGUE_TZ } from "./constants";
import type { Matchup, Result, Round } from "@/db/schema";

export type RoundWithStatus = Round & {
  status: "upcoming" | "current" | "complete";
};

/**
 * Today's date in the league's timezone, as a YYYY-MM-DD string.
 * Pure function — pass `now` to override.
 */
export function todayInLeagueTz(now: Date = new Date()): string {
  const zoned = toZonedTime(now, LEAGUE_TZ);
  const y = zoned.getFullYear();
  const m = String(zoned.getMonth() + 1).padStart(2, "0");
  const d = String(zoned.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns the round whose date window contains today, or the next upcoming round
 * if no round is currently active. Falls back to the last round if the season is over.
 */
export function getCurrentRound(
  rounds: Round[],
  results: Result[],
  matchups: Matchup[],
  today: string = todayInLeagueTz(),
): Round {
  const numbered = rounds
    .filter((r) => r.number !== "champ")
    .sort((a, b) => Number(a.number) - Number(b.number));

  const champ = rounds.find((r) => r.number === "champ");

  // Active by date window
  const active = numbered.find((r) => today >= r.windowStart && today <= r.windowEnd);
  if (active) return active;

  // Next upcoming
  const next = numbered.find((r) => today < r.windowStart);
  if (next) return next;

  // After Round 5 — return champ if present, else last numbered.
  if (champ && isRoundComplete(numbered[numbered.length - 1], matchups, results)) {
    return champ;
  }
  return numbered[numbered.length - 1];
}

export function isRoundComplete(
  round: Round,
  matchups: Matchup[],
  results: Result[],
): boolean {
  const roundMatchups = matchups.filter((m) => m.roundId === round.id);
  if (roundMatchups.length === 0) return false;
  const matchupIds = new Set(roundMatchups.map((m) => m.id));
  const completed = results.filter((r) => matchupIds.has(r.matchupId)).length;
  return completed === roundMatchups.length;
}

export function annotateRoundStatus(
  rounds: Round[],
  matchups: Matchup[],
  results: Result[],
  today: string = todayInLeagueTz(),
): RoundWithStatus[] {
  const currentRound = getCurrentRound(rounds, results, matchups, today);
  return rounds.map((r) => {
    if (isRoundComplete(r, matchups, results)) return { ...r, status: "complete" };
    if (r.id === currentRound.id) return { ...r, status: "current" };
    if (today < r.windowStart) return { ...r, status: "upcoming" };
    // Past window but not complete — still call it "current" so it stays visible
    return { ...r, status: "current" };
  });
}
