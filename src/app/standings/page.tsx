import Link from "next/link";
import { getScheduleData } from "@/lib/queries";
import {
  rankTeams,
  formatRecord,
  formatWinPct,
  type TeamStanding,
} from "@/lib/standings";
import { teamLabel } from "@/lib/teams";

export const dynamic = "force-dynamic";

const SORTS = ["default", "mov", "wins", "winpct", "team"] as const;
type SortKey = (typeof SORTS)[number];

type PageProps = {
  searchParams: Promise<{ sort?: string }>;
};

export default async function StandingsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const sort = (SORTS as readonly string[]).includes(sp.sort ?? "")
    ? (sp.sort as SortKey)
    : "default";

  const { teams, results } = await getScheduleData();
  const ranked = rankTeams(teams, results);
  const sorted = applySort(ranked, sort);

  return (
    <div className="pt-10 sm:pt-14">
      <h1 className="text-3xl sm:text-4xl text-walnut mb-2">Standings</h1>
      <p className="text-walnut-soft text-sm mb-6">
        Default order applies league tiebreakers. Use the column headers to re-sort.
      </p>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-walnut-soft border-b border-walnut">
            <th className="py-2 font-normal w-8">#</th>
            <SortableHeader label="Team" sortKey="team" current={sort} className="font-normal" />
            <SortableHeader label="W" sortKey="wins" current={sort} className="text-right w-12 font-normal" />
            <th className="py-2 font-normal text-right w-12">L</th>
            <SortableHeader label="Win%" sortKey="winpct" current={sort} className="text-right w-16 font-normal" />
            <SortableHeader label="MoV" sortKey="mov" current={sort} className="text-right w-16 font-normal" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, idx) => (
            <tr key={s.team.id} className="border-b border-walnut-faint/60">
              <td className="py-3 text-walnut-soft">{idx + 1}</td>
              <td className="py-3">
                <Link href={`/teams#team-${s.team.number}`} className="no-underline hover:underline">
                  {teamLabel(s.team)}
                </Link>
              </td>
              <td className="py-3 text-right">{s.wins}</td>
              <td className="py-3 text-right text-walnut-soft">{s.losses}</td>
              <td className="py-3 text-right">{formatWinPct(s)}</td>
              <td className="py-3 text-right">{s.totalMov}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-xs text-walnut-soft mt-6 leading-relaxed">
        <strong className="text-walnut font-medium">Tiebreakers (default sort):</strong>{" "}
        wins → head-to-head record between tied teams (mini-table when 3+ tied) →
        cumulative margin of victory → team number. The last step is a deterministic
        placeholder; a real tie would require a playoff.
      </p>

      {sort !== "default" && (
        <p className="text-xs text-walnut-soft mt-2">
          <Link href="/standings" className="no-underline hover:underline">
            Reset to default sort
          </Link>
        </p>
      )}
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  current,
  className,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  className?: string;
}) {
  const active = current === sortKey;
  return (
    <th className={`py-2 ${className ?? ""}`}>
      <Link
        href={sortKey === "default" ? "/standings" : `/standings?sort=${sortKey}`}
        className={`no-underline ${active ? "text-walnut underline" : "text-walnut-soft hover:text-walnut"}`}
      >
        {label}
      </Link>
    </th>
  );
}

function applySort(rows: TeamStanding[], sort: SortKey): TeamStanding[] {
  if (sort === "default") return rows;
  const copy = [...rows];
  switch (sort) {
    case "mov":
      return copy.sort((a, b) => b.totalMov - a.totalMov || a.team.number - b.team.number);
    case "wins":
      return copy.sort((a, b) => b.wins - a.wins || a.team.number - b.team.number);
    case "winpct":
      return copy.sort((a, b) => (b.winPct ?? -1) - (a.winPct ?? -1) || a.team.number - b.team.number);
    case "team":
      return copy.sort((a, b) => a.team.number - b.team.number);
  }
}
