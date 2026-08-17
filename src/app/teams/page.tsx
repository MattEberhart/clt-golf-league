import Link from "next/link";
import { format, parseISO } from "date-fns";
import { getScheduleData, type PlayerOnTeam } from "@/lib/queries";
import { roundRangeLabel } from "@/lib/handicaps";
import { computeStandings, formatRecord } from "@/lib/standings";
import { teamLabel } from "@/lib/teams";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const { teams, results, matchups, rounds, courses } = await getScheduleData();
  const standingsById = new Map(
    computeStandings(teams, results).map((s) => [s.team.id, s]),
  );
  const matchupById = new Map(matchups.map((m) => [m.id, m]));
  const roundById = new Map(rounds.map((r) => [r.id, r]));
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const roundNumbers = rounds.map((r) => r.number);
  const reRated = teams.some((t) =>
    t.players.some((p) => p.priorAdjHcp !== null && p.priorAdjHcp !== p.adjHcp),
  );

  return (
    <div className="pt-10 sm:pt-14">
      <h1 className={`text-3xl sm:text-4xl text-walnut ${reRated ? "mb-2" : "mb-8"}`}>
        Teams
      </h1>
      {reRated && (
        <p className="text-walnut-soft text-sm mb-8">
          Handicaps were re-rated at the season&rsquo;s midpoint. Earlier rounds
          were played on the opening numbers.
        </p>
      )}

      <div className="space-y-10">
        {teams.map((team) => {
          const standing = standingsById.get(team.id);
          const teamResults = results
            .filter((r) => r.winnerTeamId === team.id || r.loserTeamId === team.id)
            .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

          return (
            <section key={team.id} id={`team-${team.number}`} className="scroll-mt-24">
              <div className="flex items-baseline justify-between border-b border-walnut pb-2">
                <h2 className="text-xl text-walnut">{teamLabel(team)}</h2>
                <span className="text-sm text-walnut-soft">
                  {standing ? formatRecord(standing) : "0-0"} · MoV {standing?.totalMov ?? 0}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                {team.players.map((player) => (
                  <PlayerRow
                    key={player.playerId}
                    player={player}
                    roundNumbers={roundNumbers}
                  />
                ))}
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
                      const won = !r.isTie && r.winnerTeamId === team.id;
                      const tied = r.isTie;
                      const opponentId = r.winnerTeamId === team.id ? r.loserTeamId : r.winnerTeamId;
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
                            {tied ? "T" : won ? "W" : "L"}
                          </span>
                          <span className="text-walnut">
                            vs {teamLabel(opponent)}
                          </span>
                          <span className="text-walnut-soft text-xs">
                            {round?.label}
                            {course ? ` · ${course.name}` : ""}
                          </span>
                          <span className="ml-auto text-walnut-soft text-xs">
                            {tied ? "all square" : `${r.mov} UP`} · {format(parseISO(r.submittedAt), "MMM d")}
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
        Adjusted handicap (Adj) is what&rsquo;s used for net match play. <Link href="/standings">Standings →</Link>
      </p>
    </div>
  );
}

function PlayerRow({
  player,
  roundNumbers,
}: {
  player: PlayerOnTeam;
  roundNumbers: string[];
}) {
  const changed =
    player.priorAdjHcp !== null && player.priorAdjHcp !== player.adjHcp;
  const priorWindow =
    changed && player.priorEffectiveFromRound
      ? roundRangeLabel(
          player.priorEffectiveFromRound,
          player.effectiveFromRound,
          roundNumbers,
        )
      : "";

  return (
    <div className="border-b border-walnut-faint/60 pb-2">
      <div className="flex items-baseline justify-between">
        <span className="text-walnut">{player.name}</span>
        <span className="text-walnut-soft text-xs">
          {player.rawHcp ? `Raw ${player.rawHcp} · ` : ""}Adj {player.adjHcp}
        </span>
      </div>
      {changed && (
        <p className="text-[11px] text-walnut-soft/80 text-right mt-0.5">
          was {player.priorAdjHcp}
          {priorWindow ? ` for ${priorWindow}` : ""}
        </p>
      )}
    </div>
  );
}
