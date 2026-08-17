import type { Matchup, Result, Team } from "@/db/schema";

export type TeamStanding<T extends Team = Team> = {
  team: T;
  wins: number;
  losses: number;
  ties: number;
  played: number;
  winPct: number | null; // null when 0 games played
  points: number; // wins + 0.5 per tie; used for ranking
  totalMov: number; // net MoV: + on wins, - on losses, 0 on ties; sums to 0 league-wide
};

/**
 * Per-team W/L/T, points, and net MoV. A tie gives each team 0.5 point and
 * counts as one game played with zero MoV change. A win adds the MoV to the
 * winner and subtracts it from the loser, so the column still sums to 0.
 */
export function computeStandings<T extends Team>(
  teams: T[],
  results: Result[],
): TeamStanding<T>[] {
  const byId = new Map<number, TeamStanding<T>>();
  for (const t of teams) {
    byId.set(t.id, {
      team: t,
      wins: 0,
      losses: 0,
      ties: 0,
      played: 0,
      winPct: null,
      points: 0,
      totalMov: 0,
    });
  }
  for (const r of results) {
    if (r.isTie) {
      const a = byId.get(r.winnerTeamId);
      const b = byId.get(r.loserTeamId);
      if (a) {
        a.ties += 1;
        a.played += 1;
      }
      if (b) {
        b.ties += 1;
        b.played += 1;
      }
      continue;
    }
    const w = byId.get(r.winnerTeamId);
    const l = byId.get(r.loserTeamId);
    if (w) {
      w.wins += 1;
      w.played += 1;
      w.totalMov += r.mov;
    }
    if (l) {
      l.losses += 1;
      l.played += 1;
      l.totalMov -= r.mov;
    }
  }
  for (const s of byId.values()) {
    s.points = s.wins + s.ties * 0.5;
    s.winPct = s.played === 0 ? null : s.points / s.played;
  }
  return [...byId.values()];
}

/**
 * Rank teams using the league's tiebreaker order:
 *   1. Points (wins + 0.5 per tie, descending)
 *   2. Head-to-head record between the tied teams
 *      (if exactly two teams tied, whoever won the direct match;
 *       if more than two, mini-table of points among only those teams)
 *   3. Net Margin of Victory (MoV summed on wins, subtracted on losses, desc)
 *   4. Team # ascending — deterministic placeholder; a real tiebreaker
 *      would require a playoff (noted in README).
 */
export function rankTeams<T extends Team>(
  teams: T[],
  results: Result[],
): TeamStanding<T>[] {
  const standings = computeStandings(teams, results);

  // Group by points, sort each group, concatenate from most points down.
  const groups = new Map<number, TeamStanding<T>[]>();
  for (const s of standings) {
    const arr = groups.get(s.points) ?? [];
    arr.push(s);
    groups.set(s.points, arr);
  }

  const sortedPointCounts = [...groups.keys()].sort((a, b) => b - a);
  const ordered: TeamStanding<T>[] = [];

  for (const p of sortedPointCounts) {
    const group = groups.get(p)!;
    if (group.length === 1) {
      ordered.push(group[0]);
      continue;
    }
    const breakable = breakTie(group, results);
    ordered.push(...breakable);
  }
  return ordered;
}

/**
 * Break ties among a group of standings that all share the same point total.
 * Recursively re-applies the tiebreaker chain to any sub-groups still tied
 * after the head-to-head step.
 */
function breakTie<T extends Team>(
  group: TeamStanding<T>[],
  allResults: Result[],
): TeamStanding<T>[] {
  if (group.length <= 1) return group;

  // 2. Head-to-head
  // Two-team case: direct winner advances. A direct tie falls through to MoV.
  if (group.length === 2) {
    const [x, y] = group;
    const direct = allResults.find(
      (r) =>
        (r.winnerTeamId === x.team.id && r.loserTeamId === y.team.id) ||
        (r.winnerTeamId === y.team.id && r.loserTeamId === x.team.id),
    );
    if (direct && !direct.isTie) {
      return direct.winnerTeamId === x.team.id ? [x, y] : [y, x];
    }
    // No head-to-head played, or it was a tie — fall through to MoV.
    return tieByMov(group);
  }

  // Three+ tied: mini-table of points among only this group.
  const ids = new Set(group.map((g) => g.team.id));
  const h2hPoints = new Map<number, number>();
  for (const g of group) h2hPoints.set(g.team.id, 0);
  for (const r of allResults) {
    if (ids.has(r.winnerTeamId) && ids.has(r.loserTeamId)) {
      if (r.isTie) {
        h2hPoints.set(r.winnerTeamId, (h2hPoints.get(r.winnerTeamId) ?? 0) + 0.5);
        h2hPoints.set(r.loserTeamId, (h2hPoints.get(r.loserTeamId) ?? 0) + 0.5);
      } else {
        h2hPoints.set(r.winnerTeamId, (h2hPoints.get(r.winnerTeamId) ?? 0) + 1);
      }
    }
  }

  // Sub-group by mini-table points.
  const subGroups = new Map<number, TeamStanding<T>[]>();
  for (const g of group) {
    const p = h2hPoints.get(g.team.id) ?? 0;
    const arr = subGroups.get(p) ?? [];
    arr.push(g);
    subGroups.set(p, arr);
  }

  const subPointCounts = [...subGroups.keys()].sort((a, b) => b - a);
  const out: TeamStanding<T>[] = [];
  for (const p of subPointCounts) {
    const sub = subGroups.get(p)!;
    if (sub.length === 1) {
      out.push(sub[0]);
      continue;
    }
    // Still tied after head-to-head. Try MoV next, then team number.
    out.push(...tieByMov(sub));
  }
  return out;
}

function tieByMov<T extends Team>(group: TeamStanding<T>[]): TeamStanding<T>[] {
  return [...group].sort((a, b) => {
    if (b.totalMov !== a.totalMov) return b.totalMov - a.totalMov;
    return a.team.number - b.team.number;
  });
}

export function formatRecord(s: TeamStanding): string {
  if (s.ties > 0) {
    return `${s.wins}-${s.losses}-${s.ties}`;
  }
  return `${s.wins}-${s.losses}`;
}

export function formatWinPct(s: TeamStanding): string {
  if (s.winPct === null) return "–";
  return `${Math.round(s.winPct * 1000) / 10}%`;
}
