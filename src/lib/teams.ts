export function lastName(full: string): string {
  return full.replace(/"/g, "").trim().split(/\s+/).slice(-1)[0];
}

type TeamNames = { player1Name: string; player2Name: string };

export function teamLabel(team: TeamNames | undefined): string {
  if (!team) return "—";
  return `${lastName(team.player1Name)} / ${lastName(team.player2Name)}`;
}
