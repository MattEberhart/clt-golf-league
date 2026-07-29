import type { PlayerHandicap } from "@/db/schema";
import { roundSortKey } from "./schedule";

export type ResolvedHandicap = {
  /** Revision in effect at the requested round. */
  current: PlayerHandicap;
  /** Revision it replaced, if any. */
  prior: PlayerHandicap | null;
};

/**
 * Handicap in effect at `asOfRound` for every player in `rows`. The log is
 * sparse — a player with no revision for a round keeps the last one that
 * applies — so this resolves each player independently rather than assuming a
 * row exists per round.
 */
export function resolveHandicaps(
  rows: PlayerHandicap[],
  asOfRound: string,
): Map<number, ResolvedHandicap> {
  const cutoff = roundSortKey(asOfRound);
  const byPlayer = new Map<number, PlayerHandicap[]>();
  for (const row of rows) {
    if (roundSortKey(row.effectiveFromRound) > cutoff) continue;
    const arr = byPlayer.get(row.playerId) ?? [];
    arr.push(row);
    byPlayer.set(row.playerId, arr);
  }

  const resolved = new Map<number, ResolvedHandicap>();
  for (const [playerId, revisions] of byPlayer) {
    revisions.sort(
      (a, b) =>
        roundSortKey(a.effectiveFromRound) - roundSortKey(b.effectiveFromRound),
    );
    resolved.set(playerId, {
      current: revisions[revisions.length - 1],
      prior: revisions[revisions.length - 2] ?? null,
    });
  }
  return resolved;
}

/**
 * Human label for the stretch of rounds a revision covered, e.g. "Rounds 1–3"
 * or "Round 5". `toExclusive` is the round the next revision took effect at;
 * pass null for the revision still in force.
 */
export function roundRangeLabel(
  from: string,
  toExclusive: string | null,
  orderedRoundNumbers: string[],
): string {
  const start = roundSortKey(from);
  const end = toExclusive === null ? Infinity : roundSortKey(toExclusive);
  const covered = orderedRoundNumbers
    .filter((n) => roundSortKey(n) >= start && roundSortKey(n) < end)
    .sort((a, b) => roundSortKey(a) - roundSortKey(b));

  if (covered.length === 0) return "";
  if (covered.length === 1) return roundName(covered[0]);
  return `Rounds ${covered[0]}–${covered[covered.length - 1] === "champ" ? "Championship" : covered[covered.length - 1]}`;
}

function roundName(number: string): string {
  return number === "champ" ? "the Championship" : `Round ${number}`;
}
