import type { Game, Player, Team } from './data';

// Same lines as POSITION_GROUPS in the web app, plus the numbers it doesn't use yet.
export const POSITION_GROUPS = [
  { label: 'Goalies', positions: ['K', '1'] },
  { label: 'Defenders', positions: ['2', '3', '4', '5'] },
  { label: 'Midfielders', positions: ['6', '8', '10'] },
  { label: 'Wingers', positions: ['7', '11'] },
  { label: 'Attackers', positions: ['9'] },
];
export const NOT_SELECTED_REASONS = ['Rotation', 'Training missed', 'Injured', 'Sick', 'School', 'Suspended', 'Recovery', 'Game other team', 'Other'];

export type Choice = { team: Team | null; reason: string | null };
export type Draft = Record<string, Choice>;
export type GenerateParams = { playersPerTeam: number; numTeams: number; rotation: boolean; mixedTeams: boolean };

export function groupOf(position: string) {
  const i = POSITION_GROUPS.findIndex((g) => g.positions.includes(position.trim().toUpperCase()));
  return i === -1 ? POSITION_GROUPS.length : i;
}

function shuffle<T>(list: T[]) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Evens out team sizes after the per-line split.
function balance(teams: Player[][]) {
  for (let guard = 0; guard < 200; guard++) {
    const sizes = teams.map((t) => t.length);
    const max = sizes.indexOf(Math.max(...sizes));
    const min = sizes.indexOf(Math.min(...sizes));
    if (sizes[max] - sizes[min] <= 1) break;
    teams[min].push(teams[max].pop()!);
  }
}

// The web app's selection wizard (computeWizardSelection): pick the players,
// by rotation or at random, then split them over the teams line by line.
// Players in `excluded` (injured, sick…) keep their reason and are never picked.
export function generateSelection(players: Player[], games: Game[], gameId: string, params: GenerateParams, excluded: Draft): Draft {
  const pool = players.filter((p) => !excluded[p.id]);

  // Rotation: fewest past selections first, ties in random order.
  const selections = new Map<string, number>();
  for (const g of games) {
    if (g.id === gameId) continue;
    for (const [id, choice] of Object.entries(g.selection)) if (choice.team) selections.set(id, (selections.get(id) ?? 0) + 1);
  }
  const count = (p: Player) => selections.get(p.id) ?? 0;
  const ranked = params.rotation ? shuffle(pool).sort((a, b) => count(a) - count(b)) : shuffle(pool);

  const needed = params.playersPerTeam * params.numTeams;
  const picked = ranked.slice(0, needed);

  // Mixed teams: star rating and average game rating together, so quality is spread evenly.
  const strength = (p: Player) => {
    const scores = games.map((g) => g.ratings[p.id]?.score).filter((x): x is number => !!x);
    const average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    if (p.qualityRating == null && average == null) return 2.5;
    if (p.qualityRating == null) return average!;
    if (average == null) return p.qualityRating;
    return (p.qualityRating + average) / 2;
  };

  const teams: Player[][] = Array.from({ length: params.numTeams }, () => []);
  for (let line = 0; line <= POSITION_GROUPS.length; line++) {
    const inLine = picked.filter((p) => groupOf(p.bestPosition) === line);
    if (params.numTeams === 1) teams[0].push(...inLine);
    else if (params.mixedTeams) {
      // Snake draft by strength: 1, 2, 2, 1, 1, 2…
      let index = 0;
      let step = 1;
      for (const p of inLine.sort((a, b) => strength(b) - strength(a))) {
        teams[index].push(p);
        index += step;
        if (index === params.numTeams) { index = params.numTeams - 1; step = -1; }
        else if (index === -1) { index = 0; step = 1; }
      }
    } else shuffle(inLine).forEach((p, i) => teams[i % params.numTeams].push(p));
  }
  balance(teams);

  const draft: Draft = { ...excluded };
  for (const p of ranked.slice(needed)) draft[p.id] = { team: null, reason: 'Rotation' };
  teams.forEach((team, i) => team.forEach((p) => (draft[p.id] = { team: i === 0 ? 'blue' : 'red', reason: null })));
  return draft;
}
