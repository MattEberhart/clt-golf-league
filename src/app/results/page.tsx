import { format, parseISO } from "date-fns";
import { getScheduleData } from "@/lib/queries";
import { teamLabel } from "@/lib/teams";

export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  const { teams, results, matchups, rounds, courses } = await getScheduleData();
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const matchupById = new Map(matchups.map((m) => [m.id, m]));
  const courseById = new Map(courses.map((c) => [c.id, c]));

  // Group by round
  const byRound = new Map<number, typeof results>();
  for (const r of results) {
    const m = matchupById.get(r.matchupId);
    if (!m) continue;
    const arr = byRound.get(m.roundId) ?? [];
    arr.push(r);
    byRound.set(m.roundId, arr);
  }

  // Order rounds: most recent (highest round number) first; champ at top if it has results.
  const orderedRoundIds = [...byRound.keys()].sort((a, b) => {
    const ra = rounds.find((x) => x.id === a)!;
    const rb = rounds.find((x) => x.id === b)!;
    const ai = ra.number === "champ" ? 1000 : Number(ra.number);
    const bi = rb.number === "champ" ? 1000 : Number(rb.number);
    return bi - ai;
  });

  return (
    <div className="pt-10 sm:pt-14">
      <h1 className="text-3xl sm:text-4xl text-walnut mb-8">Results</h1>

      {orderedRoundIds.length === 0 && (
        <p className="text-sm text-walnut-soft">No results submitted yet.</p>
      )}

      <div className="space-y-10">
        {orderedRoundIds.map((roundId) => {
          const round = rounds.find((r) => r.id === roundId)!;
          const course = round.courseId ? courseById.get(round.courseId) : undefined;
          const list = (byRound.get(roundId) ?? []).sort((a, b) =>
            b.submittedAt.localeCompare(a.submittedAt),
          );
          return (
            <section key={roundId}>
              <header className="flex items-baseline justify-between border-b border-walnut pb-2">
                <h2 className="text-xl text-walnut">{round.label}</h2>
                <span className="text-sm text-walnut-soft">
                  {course?.name ?? "TBD"}
                </span>
              </header>
              <ul className="text-sm divide-y divide-walnut-faint/60">
                {list.map((r) => {
                  const winner = teamById.get(r.winnerTeamId);
                  const loser = teamById.get(r.loserTeamId);
                  return (
                    <li key={r.id} className="py-3 flex flex-wrap items-baseline gap-x-3">
                      <span className="text-walnut">
                        {teamLabel(winner)} def. {teamLabel(loser)}
                        <span className="text-walnut-soft"> · {r.mov} UP</span>
                      </span>
                      <span className="ml-auto text-xs text-walnut-soft">
                        {format(parseISO(r.submittedAt), "MMM d, yyyy")} · {r.submittedByLabel}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
