import type { Matchup, Result, Team } from "@/db/schema";

export type TeamStanding = {
  team: Team;
  wins: number;
  losses: number;
  played: number;
  winPct: number | null; // null when 0 games played
  totalMov: number; // sum of MoV across wins
};

/**
 * Per-team W/L and total MoV (margin of victory summed across wins).
 * MoV is only added on wins, mirroring the spec's tiebreaker definition.
 */
export function computeStandings(
  teams: Team[],
  results: Result[],
): TeamStanding[] {
  const byId = new Map<number, TeamStanding>();
  for (const t of teams) {
    byId.set(t.id, {
      team: t,
      wins: 0,
      losses: 0,
      played: 0,
      winPct: null,
      totalMov: 0,
    });
  }
  for (const r of results) {
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
    }
  }
  for (const s of byId.values()) {
    s.winPct = s.played === 0 ? null : s.wins / s.played;
  }
  return [...byId.values()];
}

/**
 * Rank teams using the league's tiebreaker order:
 *   1. Wins (desc)
 *   2. Head-to-head record between the tied teams
 *      (if exactly two teams tied, whoever won the direct match;
 *       if more than two, mini-table of W-L among only those teams)
 *   3. Cumulative Margin of Victory (sum of MoV across all wins, desc)
 *   4. Team # ascending — deterministic placeholder; a real tiebreaker
 *      would require a playoff (noted in README).
 */
export function rankTeams(teams: Team[], results: Result[]): TeamStanding[] {
  const standings = computeStandings(teams, results);

  // Group by win count, sort each group, concatenate from most wins down.
  const groups = new Map<number, TeamStanding[]>();
  for (const s of standings) {
    const arr = groups.get(s.wins) ?? [];
    arr.push(s);
    groups.set(s.wins, arr);
  }

  const sortedWinCounts = [...groups.keys()].sort((a, b) => b - a);
  const ordered: TeamStanding[] = [];

  for (const w of sortedWinCounts) {
    const group = groups.get(w)!;
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
 * Break ties among a group of standings that all share the same win count.
 * Recursively re-applies the tiebreaker chain to any sub-groups still tied
 * after the head-to-head step.
 */
function breakTie(group: TeamStanding[], allResults: Result[]): TeamStanding[] {
  if (group.length <= 1) return group;

  // 2. Head-to-head
  // Two-team case: direct winner advances.
  if (group.length === 2) {
    const [x, y] = group;
    const direct = allResults.find(
      (r) =>
        (r.winnerTeamId === x.team.id && r.loserTeamId === y.team.id) ||
        (r.winnerTeamId === y.team.id && r.loserTeamId === x.team.id),
    );
    if (direct) {
      return direct.winnerTeamId === x.team.id ? [x, y] : [y, x];
    }
    // No head-to-head played — fall through to MoV.
    return tieByMov(group);
  }

  // Three+ tied: mini-table of W-L among only this group.
  const ids = new Set(group.map((g) => g.team.id));
  const h2hWins = new Map<number, number>();
  for (const g of group) h2hWins.set(g.team.id, 0);
  for (const r of allResults) {
    if (ids.has(r.winnerTeamId) && ids.has(r.loserTeamId)) {
      h2hWins.set(r.winnerTeamId, (h2hWins.get(r.winnerTeamId) ?? 0) + 1);
    }
  }

  // Sub-group by mini-table wins.
  const subGroups = new Map<number, TeamStanding[]>();
  for (const g of group) {
    const w = h2hWins.get(g.team.id) ?? 0;
    const arr = subGroups.get(w) ?? [];
    arr.push(g);
    subGroups.set(w, arr);
  }

  const subWinCounts = [...subGroups.keys()].sort((a, b) => b - a);
  const out: TeamStanding[] = [];
  for (const w of subWinCounts) {
    const sub = subGroups.get(w)!;
    if (sub.length === 1) {
      out.push(sub[0]);
      continue;
    }
    // Still tied after head-to-head. Try MoV next, then team number.
    out.push(...tieByMov(sub));
  }
  return out;
}

function tieByMov(group: TeamStanding[]): TeamStanding[] {
  return [...group].sort((a, b) => {
    if (b.totalMov !== a.totalMov) return b.totalMov - a.totalMov;
    return a.team.number - b.team.number;
  });
}

export function formatRecord(s: TeamStanding): string {
  return `${s.wins}-${s.losses}`;
}

export function formatWinPct(s: TeamStanding): string {
  if (s.winPct === null) return "–";
  return `${Math.round(s.winPct * 1000) / 10}%`;
}
