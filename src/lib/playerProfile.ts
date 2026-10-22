import type { Game, Player, Team, Training } from './data';
import { EXCUSED_TRAINING_ABSENCE_REASONS } from './data';
import { countedGames, countedTrainings } from './playerStats';

// The line a position belongs to: K, the backs, the midfield, the wings, the striker.
export function positionGroup(code: string): string | null {
  if (!code) return null;
  if (code === 'K') return 'Goalkeeper';
  if (['2', '3', '4', '5'].includes(code)) return 'Defender';
  if (['6', '8', '10'].includes(code)) return 'Midfielder';
  if (['7', '11'].includes(code)) return 'Winger';
  if (code === '9') return 'Attacker';
  return null;
}

// "3 · Defender", or "–" when not filled in.
export const positionText = (code: string) => (code ? `${code === 'K' ? 'K' : code} · ${positionGroup(code) ?? ''}` : '–');

// "Aaron V": first name and the first letter of the last name.
export const shortName = (p: Player) => `${p.firstName.trim()} ${p.lastName.trim()[0] ?? ''}`.trim();

export const ATTITUDES: { key: string; label: string }[] = [
  { key: 'coachability', label: 'Coachability' },
  { key: 'respect', label: 'Respect' },
  { key: 'growthMindset', label: 'Growth mindset' },
  { key: 'neverGivesUp', label: 'Never gives up' },
  { key: 'takesResponsibility', label: 'Takes responsibility' },
  { key: 'focus', label: 'Focus' },
  { key: 'winnersMentality', label: "Winner's mentality" },
];
// Level 1 to 6, with its colour from red to dark green.
export const LEVELS = ['Bad', 'Not good', 'Average', 'Good', 'Very good', 'Excellent'];
export const LEVEL_COLORS = ['#B5473F', '#D9822E', '#D9A12E', '#2E6FB0', '#7CC576', '#1F5C2E'];

// A game rating (1 to 5) on the 10-point scale of the player's score. A 3 is
// the expected level (played at IP level) and counts as a solid 7.
export const TEN_POINT: Record<number, number> = { 1: 3, 2: 5, 3: 7, 4: 8.5, 5: 10 };

// One row of the player's games overview, newest first.
export type GameRow = {
  game: Game;
  team: Team | null;
  reason: string | null;
  rating: number | null;
};

// The player's counted games (played, with a selection made), his ratings and Blue/Red.
export function playerGames(player: Player, games: Game[]) {
  const rows: GameRow[] = countedGames(games)
    .filter((g) => g.selection[player.id])
    .map((g) => ({
      game: g,
      team: g.selection[player.id].team,
      reason: g.selection[player.id].team ? null : g.selection[player.id].reason || 'Not selected',
      rating: g.selection[player.id].team ? (g.ratings[player.id]?.score ?? null) : null,
    }))
    .reverse();
  const rated = rows.map((r) => r.rating).filter((x): x is number => x !== null);
  const distribution = [1, 2, 3, 4, 5].map((n) => rated.filter((x) => Math.round(x) === n).length);
  return {
    rows,
    counted: countedGames(games).length,
    played: rows.filter((r) => r.team).length,
    notSelected: rows.filter((r) => !r.team).length,
    blue: rows.filter((r) => r.team === 'blue').length,
    red: rows.filter((r) => r.team === 'red').length,
    rated: rated.length,
    // The player's score out of 10: every rated game counts, each on the 10-point scale.
    average: rated.length ? Math.round((rated.reduce((sum, x) => sum + (TEN_POINT[Math.round(x)] ?? 0), 0) / rated.length) * 10) / 10 : null,
    distribution,
  };
}

// The player's trainings: attended, missed (newest first), and the reasons he was absent.
export function playerTrainings(player: Player, trainings: Training[]) {
  const held = countedTrainings(trainings);
  const missed = held.filter((t) => player.id in t.absences).sort((a, b) => b.date.localeCompare(a.date));
  const counting = held.filter((t) => !EXCUSED_TRAINING_ABSENCE_REASONS.includes(t.absences[player.id] ?? ''));
  const attended = counting.filter((t) => !(player.id in t.absences)).length;
  const reasons = new Map<string, number>();
  for (const t of missed) {
    const r = t.absences[player.id] || 'No reason';
    reasons.set(r, (reasons.get(r) ?? 0) + 1);
  }
  return {
    held: held.length,
    counting: counting.length,
    attended,
    percent: counting.length ? Math.round((attended / counting.length) * 100) : 0,
    missed,
    reasons: [...reasons.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({ reason, count, excused: EXCUSED_TRAINING_ABSENCE_REASONS.includes(reason) })),
  };
}
