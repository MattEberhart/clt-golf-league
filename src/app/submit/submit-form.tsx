"use client";

import { useActionState, useMemo, useState } from "react";
import { submitResultAction, type SubmitState } from "./actions";
import { teamLabel } from "@/lib/teams";

type Team = { id: number; number: number; player1Name: string; player2Name: string };
type Round = { id: number; number: string; label: string };
type Matchup = { id: number; roundId: number; teamAId: number; teamBId: number; slot: number };

type Props = {
  rounds: Round[];
  matchups: Matchup[];
  teams: Team[];
  defaultRoundId: number;
};

export function SubmitForm({ rounds, matchups, teams, defaultRoundId }: Props) {
  const [state, formAction, pending] = useActionState<SubmitState | undefined, FormData>(
    submitResultAction,
    undefined,
  );

  const [roundId, setRoundId] = useState<number>(defaultRoundId);
  const [matchupId, setMatchupId] = useState<number | "">("");

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const availableMatchups = useMemo(
    () => matchups.filter((m) => m.roundId === roundId).sort((a, b) => a.slot - b.slot),
    [matchups, roundId],
  );

  const selectedMatchup = matchups.find((m) => m.id === Number(matchupId));
  const teamA = selectedMatchup ? teamById.get(selectedMatchup.teamAId) : undefined;
  const teamB = selectedMatchup ? teamById.get(selectedMatchup.teamBId) : undefined;

  if (state?.ok) {
    return (
      <div className="border border-walnut-faint bg-cream-soft p-5 rounded-[2px]">
        <p className="text-walnut">Result submitted. Thanks!</p>
        <a
          href="/submit"
          className="inline-block mt-3 text-sm text-accent-deep no-underline hover:underline"
        >
          Submit another →
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <label className="block">
        <span className="block text-sm text-walnut-soft mb-1">Round</span>
        <select
          name="roundId"
          value={roundId}
          onChange={(e) => {
            setRoundId(Number(e.target.value));
            setMatchupId("");
          }}
          className="w-full border border-walnut-faint bg-cream-soft px-3 py-2 text-walnut focus:outline-none focus:border-accent rounded-[2px]"
        >
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="block text-sm text-walnut-soft mb-1">Matchup</span>
        <select
          name="matchupId"
          value={matchupId}
          onChange={(e) => setMatchupId(e.target.value === "" ? "" : Number(e.target.value))}
          required
          className="w-full border border-walnut-faint bg-cream-soft px-3 py-2 text-walnut focus:outline-none focus:border-accent rounded-[2px]"
        >
          <option value="">
            {availableMatchups.length === 0
              ? "No matchups left in this round"
              : "Select a matchup…"}
          </option>
          {availableMatchups.map((m) => {
            const a = teamById.get(m.teamAId);
            const b = teamById.get(m.teamBId);
            return (
              <option key={m.id} value={m.id}>
                Match {m.slot}: {teamLabel(a)} vs {teamLabel(b)}
              </option>
            );
          })}
        </select>
      </label>

      {selectedMatchup && teamA && teamB && (
        <fieldset className="block">
          <legend className="block text-sm text-walnut-soft mb-1">Winner</legend>
          <div className="space-y-2">
            <RadioOption value={teamA.id} team={teamA} />
            <RadioOption value={teamB.id} team={teamB} />
          </div>
        </fieldset>
      )}

      <label className="block">
        <span className="block text-sm text-walnut-soft mb-1">
          Margin (holes up at the end)
        </span>
        <input
          type="number"
          name="mov"
          min={1}
          max={18}
          required
          inputMode="numeric"
          className="w-full sm:w-32 border border-walnut-faint bg-cream-soft px-3 py-2 text-walnut focus:outline-none focus:border-accent rounded-[2px]"
        />
      </label>

      <label className="block">
        <span className="block text-sm text-walnut-soft mb-1">Your name</span>
        <input
          type="text"
          name="submittedByLabel"
          required
          maxLength={60}
          placeholder="e.g. Matt E."
          className="w-full border border-walnut-faint bg-cream-soft px-3 py-2 text-walnut focus:outline-none focus:border-accent rounded-[2px]"
        />
      </label>

      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="bg-accent text-cream px-5 py-2.5 text-sm font-medium hover:bg-accent-deep disabled:opacity-50 rounded-[2px]"
      >
        {pending ? "Submitting…" : "Submit result"}
      </button>
    </form>
  );
}

function RadioOption({ value, team }: { value: number; team: Team }) {
  return (
    <label className="flex items-baseline gap-3 border border-walnut-faint bg-cream-soft px-3 py-2 cursor-pointer rounded-[2px] hover:border-accent">
      <input type="radio" name="winnerTeamId" value={value} required className="accent-accent" />
      <span className="text-walnut">{teamLabel(team)}</span>
    </label>
  );
}
