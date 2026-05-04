import Link from "next/link";
import { format, parseISO } from "date-fns";
import { getScheduleData } from "@/lib/queries";
import { rankTeams, formatRecord, formatWinPct } from "@/lib/standings";
import { getCurrentRound } from "@/lib/schedule";
import { reseedChampIfNeeded } from "@/lib/championship";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await reseedChampIfNeeded();
  const { rounds, courses, teams, matchups, results } = await getScheduleData();
  const standings = rankTeams(teams, results);
  const current = getCurrentRound(rounds, results, matchups);
  const currentCourse = courses.find((c) => c.id === current.courseId);
  const recent = [...results]
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .slice(0, 3);

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const matchupById = new Map(matchups.map((m) => [m.id, m]));
  const roundById = new Map(rounds.map((r) => [r.id, r]));

  return (
    <div className="pt-10 sm:pt-14">
      <section className="mb-12">
        <p className="text-sm uppercase tracking-[0.18em] text-walnut-soft mb-3">
          Net match play · Charlotte
        </p>
        <h1 className="text-4xl sm:text-5xl text-walnut leading-tight mb-5">
          Six teams. One match a month. May the best net score win.
        </h1>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-walnut-soft">
          <span className="text-accent-deep font-medium">{current.label}</span>
          {currentCourse && <span>· {currentCourse.name}</span>}
          <span>· {formatWindow(current.windowStart, current.windowEnd)}</span>
        </div>
        <div className="mt-6">
          <Link
            href="/submit"
            className="inline-block bg-accent text-cream px-5 py-2.5 text-sm font-medium hover:bg-accent-deep no-underline rounded-[2px]"
          >
            Submit a result
          </Link>
        </div>
      </section>

      <section className="mb-12">
        <SectionHeading title="Standings" href="/standings" />
        <table className="w-full mt-3 text-sm">
          <thead>
            <tr className="text-left text-walnut-soft border-b border-walnut-faint">
              <th className="py-2 font-normal w-8">#</th>
              <th className="py-2 font-normal">Team</th>
              <th className="py-2 font-normal text-right w-16">W-L</th>
              <th className="py-2 font-normal text-right w-16">Win%</th>
              <th className="py-2 font-normal text-right w-16">MoV</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, idx) => (
              <tr key={s.team.id} className="border-b border-walnut-faint/60">
                <td className="py-2.5 text-walnut-soft">{idx + 1}</td>
                <td className="py-2.5">
                  <Link
                    href={`/teams#team-${s.team.number}`}
                    className="no-underline hover:underline"
                  >
                    Team {s.team.number}
                    <span className="text-walnut-soft ml-2 text-xs">
                      {lastName(s.team.player1Name)} / {lastName(s.team.player2Name)}
                    </span>
                  </Link>
                </td>
                <td className="py-2.5 text-right">{formatRecord(s)}</td>
                <td className="py-2.5 text-right">{formatWinPct(s)}</td>
                <td className="py-2.5 text-right">{s.totalMov}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-4">
        <SectionHeading title="Recent results" href="/results" />
        {recent.length === 0 ? (
          <p className="text-sm text-walnut-soft mt-3">No results yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {recent.map((r) => {
              const winner = teamById.get(r.winnerTeamId);
              const loser = teamById.get(r.loserTeamId);
              const matchup = matchupById.get(r.matchupId);
              const round = matchup ? roundById.get(matchup.roundId) : undefined;
              const course = round ? courses.find((c) => c.id === round.courseId) : undefined;
              return (
                <li key={r.id} className="border-b border-walnut-faint/60 pb-2">
                  <span className="text-walnut">
                    Team {winner?.number} def. Team {loser?.number}
                    <span className="text-walnut-soft"> · {formatMov(r.mov)}</span>
                  </span>
                  <span className="text-walnut-soft block text-xs mt-0.5">
                    {round?.label}
                    {course ? ` · ${course.name}` : ""} ·{" "}
                    {format(parseISO(r.submittedAt), "MMM d")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function SectionHeading({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-walnut pb-2">
      <h2 className="text-2xl text-walnut">{title}</h2>
      <Link href={href} className="text-xs uppercase tracking-wider text-accent-deep">
        See all
      </Link>
    </div>
  );
}

function formatWindow(start: string, end: string): string {
  const s = parseISO(start);
  const e = parseISO(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (sameMonth) {
    return `${format(s, "MMMM d")}–${format(e, "d, yyyy")}`;
  }
  return `${format(s, "MMM d")}–${format(e, "MMM d, yyyy")}`;
}

function formatMov(mov: number): string {
  return `${mov} UP`;
}

function lastName(full: string): string {
  return full.replace(/"/g, "").trim().split(/\s+/).slice(-1)[0];
}
