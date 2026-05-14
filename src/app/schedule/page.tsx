import { format, parseISO } from "date-fns";
import { getScheduleData } from "@/lib/queries";
import { annotateRoundStatus } from "@/lib/schedule";
import { reseedChampIfNeeded, champSlotLabel } from "@/lib/championship";
import { teamLabel } from "@/lib/teams";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  await reseedChampIfNeeded();
  const { rounds, courses, teams, matchups, results } = await getScheduleData();
  const annotated = annotateRoundStatus(rounds, matchups, results);

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const resultByMatchup = new Map(results.map((r) => [r.matchupId, r]));

  const champRound = annotated.find((r) => r.number === "champ");
  const champMatchups = champRound
    ? matchups.filter((m) => m.roundId === champRound.id).sort((a, b) => a.slot - b.slot)
    : [];

  return (
    <div className="pt-10 sm:pt-14">
      <h1 className="text-3xl sm:text-4xl text-walnut mb-2">Schedule</h1>
      <p className="text-walnut-soft text-sm mb-8">
        Round-robin: every team plays every other team across five rounds, then a championship round in October.
      </p>

      <div className="space-y-10">
        {annotated.map((round) => {
          const course = round.courseId ? courseById.get(round.courseId) : undefined;
          const isChamp = round.number === "champ";
          const roundMatchups = matchups
            .filter((m) => m.roundId === round.id)
            .sort((a, b) => a.slot - b.slot);

          return (
            <section key={round.id}>
              <header className="flex flex-wrap items-baseline gap-x-3 border-b border-walnut pb-2">
                <h2 className="text-xl text-walnut">
                  {round.label}
                  {round.status === "current" && (
                    <span className="ml-3 text-xs uppercase tracking-wider text-accent-deep">
                      Current
                    </span>
                  )}
                  {round.status === "complete" && (
                    <span className="ml-3 text-xs uppercase tracking-wider text-walnut-soft">
                      Complete
                    </span>
                  )}
                </h2>
                <div className="ml-auto text-sm text-walnut-soft">
                  {course ? course.name : isChamp ? "TBD" : ""}
                  {course?.notes ? ` (${course.notes})` : ""}
                  {" · "}
                  {formatWindow(round.windowStart, round.windowEnd)}
                </div>
              </header>

              {isChamp && roundMatchups.length === 0 ? (
                <p className="mt-3 text-sm text-walnut-soft italic">
                  TBD — seeded after Round 5.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-walnut-faint/60">
                  {roundMatchups.map((m) => {
                    const a = teamById.get(m.teamAId)!;
                    const b = teamById.get(m.teamBId)!;
                    const result = resultByMatchup.get(m.id);
                    const winner = result ? teamById.get(result.winnerTeamId) : undefined;
                    return (
                      <li key={m.id} className="py-3 flex items-center text-sm gap-3">
                        <span className="text-walnut-soft text-xs w-20 shrink-0">
                          {isChamp ? champSlotLabel(m.slot) : `Match ${m.slot}`}
                        </span>
                        <TeamLabel team={a} highlighted={winner?.id === a.id} />
                        <span className="text-walnut-soft">vs</span>
                        <TeamLabel team={b} highlighted={winner?.id === b.id} />
                        <span className="ml-auto text-walnut-soft text-xs">
                          {result ? `${teamLabel(winner)} won, ${result.mov} UP` : "—"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TeamLabel({
  team,
  highlighted,
}: {
  team: { number: number; player1Name: string; player2Name: string };
  highlighted: boolean;
}) {
  return (
    <span
      className={
        highlighted
          ? "text-accent-deep font-medium"
          : "text-walnut"
      }
    >
      {teamLabel(team)}
    </span>
  );
}

function formatWindow(start: string, end: string): string {
  const s = parseISO(start);
  const e = parseISO(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (sameMonth) return `${format(s, "MMM d")}–${format(e, "d")}`;
  return `${format(s, "MMM d")}–${format(e, "MMM d")}`;
}
