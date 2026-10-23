import type { Game, Player, Team, Training } from './data';
import { EXCUSED_TRAINING_ABSENCE_REASONS, todayIso } from './data';

export type Stat = 'games' | 'rating' | 'goals' | 'none' | 'rotation' | 'attendance';

// Below this many rated games the score rests on too few games: it gets a warning.
export const MIN_RATED_GAMES = 5;

// A game rating (1 to 5) on the 10-point scale of the player's score. A 3 is
// the expected level (played at IP level) and counts as a solid 7.
export const TEN_POINT: Record<number, number> = { 1: 3, 2: 5, 3: 7, 4: 8.5, 5: 10 };

// A rated game: the player's rating (1 to 5) and the opponent strength of his
// team's game report (1 Development to 5 High Elite), if filled in.
export type RatedGame = { rating: number; strength: number | null };

// One game on the 10-point scale, corrected for the opponent strength. Against a
// stronger opponent the score moves part of the way up to 10 (Elite 20%, High
// Elite 50%), so it never goes past 10; against a weaker one it goes down by a
// share (Below IP3 10%, Development 20%). IP3, or no strength filled in: as is.
export function gameScore({ rating, strength }: RatedGame): number {
  const base = TEN_POINT[Math.round(rating)] ?? 0;
  if (strength === 5) return base + (10 - base) * 0.5;
  if (strength === 4) return base + (10 - base) * 0.2;
  if (strength === 2) return base * 0.9;
  if (strength === 1) return base * 0.8;
  return base;
}

// The player's score out of 10: the average of every rated game, each corrected for the opponent.
export function ratingScore(games: RatedGame[]): number | null {
  if (!games.length) return null;
  return Math.round((games.reduce((sum, g) => sum + gameScore(g), 0) / games.length) * 10) / 10;
}

// The opponent strength a team gave in its game report, if any.
export const strengthOf = (game: Game, team: Team | null) => (team ? (game.reports[team]?.opponentScore ?? null) : null);

// How a player stood in one game: selected, rested (Rotation), injured,
// or not selected for another reason.
export type Status = 'played' | 'rotation' | 'injured' | 'other';

export type PlayerStat = {
  player: Player;
  // One entry per counted game, oldest first; null when the player has no entry for that game.
  strip: (Status | null)[];
  games: number;
  goals: number;
  notSelected: number;
  rotation: number;
  injured: number;
  other: number;
  // Trainings that count for the player, and how many of them they attended.
  trainings: number;
  attended: number;
  // The score out of 10 from the game ratings (null when not rated yet), and how many games it rests on.
  score: number | null;
  rated: number;
};

// Trainings that count for attendance: held (not in the future) and not cancelled.
// Absences for GK training or training with another team don't count against a
// player, the same as in the web app; other absences (injured too) do.
export function countedTrainings(trainings: Training[]): Training[] {
  const today = todayIso();
  return trainings.filter((t) => t.date <= today && !t.cancelStatus);
}

// The games that count: played (not in the future), not cancelled, with a selection made.
export function countedGames(games: Game[]): Game[] {
  const today = todayIso();
  return games
    .filter((g) => !!g.date && g.date <= today && !g.cancelStatus && Object.keys(g.selection).length > 0)
    .sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : 0));
}

export function playerStats(
  players: Player[],
  games: Game[],
  goals: { gameId: string; scorerId: string }[],
  trainings: Training[] = [],
): { stats: PlayerStat[]; gameCount: number; trainingCount: number } {
  const counted = countedGames(games);
  const held = countedTrainings(trainings);
  const ids = new Set(counted.map((g) => g.id));
  const goalsBy = new Map<string, number>();
  for (const x of goals) if (ids.has(x.gameId)) goalsBy.set(x.scorerId, (goalsBy.get(x.scorerId) ?? 0) + 1);

  const stats = players.map((player) => {
    const strip: (Status | null)[] = counted.map((g) => {
      const s = g.selection[player.id];
      if (!s) return null;
      return s.team ? 'played' : s.reason === 'Rotation' ? 'rotation' : s.reason === 'Injured' ? 'injured' : 'other';
    });
    const n = (st: Status) => strip.filter((x) => x === st).length;
    const ratings: RatedGame[] = counted
      .filter((g) => g.selection[player.id]?.team && typeof g.ratings[player.id]?.score === 'number')
      .map((g) => ({ rating: g.ratings[player.id].score as number, strength: strengthOf(g, g.selection[player.id].team) }));
    const forPlayer = held.filter((t) => !EXCUSED_TRAINING_ABSENCE_REASONS.includes(t.absences[player.id] ?? ''));
    return {
      score: ratingScore(ratings),
      rated: ratings.length,
      trainings: forPlayer.length,
      attended: forPlayer.filter((t) => !(player.id in t.absences)).length,
      player,
      strip,
      games: n('played'),
      goals: goalsBy.get(player.id) ?? 0,
      notSelected: n('rotation') + n('injured') + n('other'),
      rotation: n('rotation'),
      injured: n('injured'),
      other: n('other'),
    };
  });
  return { stats, gameCount: counted.length, trainingCount: held.length };
}

export const STAT_ORDER: Stat[] = ['games', 'rating', 'goals', 'none', 'rotation', 'attendance'];

export const STAT_TITLE: Record<Stat, string> = {
  games: 'Games played',
  rating: 'Rating',
  goals: 'Goals scored',
  none: 'No selection',
  rotation: 'Rotation',
  attendance: 'Training attendance',
};

export const STAT_ABOUT: Record<Stat, string> = {
  games: 'Selected for a team in a game',
  rating: 'Score out of 10 from the game ratings',
  goals: 'Goals in the goal log',
  none: 'Not selected, any reason',
  rotation: 'Rested because of rotation',
  attendance: 'Share of trainings attended',
};

export const STAT_UNIT: Record<Stat, string> = { games: 'games', rating: '/ 10', goals: 'goals', none: 'times', rotation: 'times', attendance: 'attended' };

// Attendance as a whole percentage; 0 when no training counts yet.
export const attendanceOf = (s: PlayerStat) => (s.trainings ? Math.round((s.attended / s.trainings) * 100) : 0);

export function valueOf(s: PlayerStat, stat: Stat): number {
  if (stat === 'rating') return s.score ?? 0;
  return stat === 'games' ? s.games : stat === 'goals' ? s.goals : stat === 'none' ? s.notSelected : stat === 'attendance' ? attendanceOf(s) : s.rotation;
}
