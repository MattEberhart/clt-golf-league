import { hasSession } from "@/lib/auth";
import { getScheduleData } from "@/lib/queries";
import { getCurrentRound } from "@/lib/schedule";
import { LoginForm } from "./login-form";
import { SubmitForm } from "./submit-form";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SubmitPage() {
  const authed = await hasSession();

  return (
    <div className="pt-10 sm:pt-14 max-w-md">
      <h1 className="text-3xl sm:text-4xl text-walnut mb-2">Submit a result</h1>
      <p className="text-walnut-soft text-sm mb-8">
        After your match, drop the score in here. One entry per matchup.
      </p>

      {authed ? <SubmitGate /> : <LoginForm />}
    </div>
  );
}

async function SubmitGate() {
  const { rounds, matchups, teams, results } = await getScheduleData();

  // Filter out matchups that already have a result.
  const completedIds = new Set(results.map((r) => r.matchupId));
  const openMatchups = matchups.filter((m) => !completedIds.has(m.id));

  // Only show rounds that have at least one open matchup.
  const openRoundIds = new Set(openMatchups.map((m) => m.roundId));
  const openRounds = rounds.filter((r) => openRoundIds.has(r.id));

  if (openRounds.length === 0) {
    return (
      <div className="border border-walnut-faint bg-cream-soft p-5 rounded-[2px]">
        <p className="text-walnut">All matchups have results. Nice work.</p>
      </div>
    );
  }

  // Default to current round if it has open matchups, else first open round.
  const current = getCurrentRound(rounds, results, matchups);
  const defaultRoundId = openRoundIds.has(current.id) ? current.id : openRounds[0].id;

  return (
    <>
      <SubmitForm
        rounds={openRounds}
        matchups={openMatchups}
        teams={teams}
        defaultRoundId={defaultRoundId}
      />
      <form action={logoutAction} className="mt-8">
        <button
          type="submit"
          className="text-xs text-walnut-soft hover:text-walnut underline"
        >
          Sign out of submission
        </button>
      </form>
    </>
  );
}
