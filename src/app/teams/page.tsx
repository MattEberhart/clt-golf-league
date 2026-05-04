import Link from "next/link";
import { format, parseISO } from "date-fns";
import { getScheduleData } from "@/lib/queries";
import { computeStandings, formatRecord } from "@/lib/standings";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const { teams, results, matchups, rounds, courses } = await getScheduleData();
  const standingsById = new Map(
    computeStandings(teams, results).map((s) => [s.team.id, s]),
  );
  const matchupById = new Map(matchups.map((m) => [m.id, m]));
  const roundById = new Map(rounds.map((r) => [r.id, r]));
  const courseById = new Map(courses.map((c) => [c.id, c]));

  return (
    <div className="pt-10 sm:pt-14">
      <h1 className="text-3xl sm:text-4xl text-walnut mb-8">Teams</h1>

      <div className="space-y-10">
        {teams.map((team) => {
          const standing = standingsById.get(team.id);
          const teamResults = results
            .filter((r) => r.winnerTeamId === team.id || r.loserTeamId === team.id)
            .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

          return (
            <section key={team.id} id={`team-${team.number}`} className="scroll-mt-24">
              <div className="flex items-baseline justify-between border-b border-walnut pb-2">
                <h2 className="text-xl text-walnut">Team {team.number}</h2>
                <span className="text-sm text-walnut-soft">
                  {standing ? formatRecord(standing) : "0-0"} · MoV {standing?.totalMov ?? 0}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <PlayerRow
                  name={team.player1Name}
                  raw={team.player1RawHcp}
                  adj={team.player1AdjHcp}
                />
                <PlayerRow
                  name={team.player2Name}
                  raw={team.player2RawHcp}
                  adj={team.player2AdjHcp}
                />
              </div>

              <div className="mt-5">
                <h3 className="text-xs uppercase tracking-wider text-walnut-soft mb-2">
                  Results
                </h3>
                {teamResults.length === 0 ? (
                  <p className="text-sm text-walnut-soft italic">No matches played yet.</p>
                ) : (
                  <ul className="text-sm divide-y divide-walnut-faint/60">
                    {teamResults.map((r) => {
                      const won = r.winnerTeamId === team.id;
                      const opponentId = won ? r.loserTeamId : r.winnerTeamId;
                      const opponent = teams.find((t) => t.id === opponentId);
                      const matchup = matchupById.get(r.matchupId);
                      const round = matchup ? roundById.get(matchup.roundId) : undefined;
                      const course = round ? courseById.get(round.courseId ?? -1) : undefined;
                      return (
                        <li key={r.id} className="py-2 flex items-baseline gap-3">
                          <span
                            className={
                              won
                                ? "text-accent-deep font-medium w-8"
                                : "text-walnut-soft w-8"
                            }
                          >
                            {won ? "W" : "L"}
                          </span>
                          <span className="text-walnut">
                            vs Team {opponent?.number}
                          </span>
                          <span className="text-walnut-soft text-xs">
                            {round?.label}
                            {course ? ` · ${course.name}` : ""}
                          </span>
                          <span className="ml-auto text-walnut-soft text-xs">
                            {r.mov} UP · {format(parseISO(r.submittedAt), "MMM d")}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <p className="text-xs text-walnut-soft mt-10">
        Adjusted handicap (Adj) is what's used for net match play. <Link href="/standings">Standings →</Link>
      </p>
    </div>
  );
}

function PlayerRow({
  name,
  raw,
  adj,
}: {
  name: string;
  raw: string;
  adj: number;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-walnut-faint/60 pb-2">
      <span className="text-walnut">{name}</span>
      <span className="text-walnut-soft text-xs">
        Raw {raw} · Adj {adj}
      </span>
    </div>
  );
}
