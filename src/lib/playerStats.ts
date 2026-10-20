import type { Game, Player, Training } from './data';
import { EXCUSED_TRAINING_ABSENCE_REASONS, todayIso } from './data';

export type Stat = 'games' | 'goals' | 'none' | 'rotation' | 'attendance';

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
    const forPlayer = held.filter((t) => !EXCUSED_TRAINING_ABSENCE_REASONS.includes(t.absences[player.id] ?? ''));
    return {
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

export const STAT_ORDER: Stat[] = ['games', 'goals', 'none', 'rotation', 'attendance'];

export const STAT_TITLE: Record<Stat, string> = {
  games: 'Games played',
  goals: 'Goals scored',
  none: 'No selection',
  rotation: 'Rotation',
  attendance: 'Training attendance',
};

export const STAT_ABOUT: Record<Stat, string> = {
  games: 'Selected for a team in a game',
  goals: 'Goals in the goal log',
  none: 'Not selected, any reason',
  rotation: 'Rested because of rotation',
  attendance: 'Share of trainings attended',
};

export const STAT_UNIT: Record<Stat, string> = { games: 'games', goals: 'goals', none: 'times', rotation: 'times', attendance: 'attended' };

// Attendance as a whole percentage; 0 when no training counts yet.
export const attendanceOf = (s: PlayerStat) => (s.trainings ? Math.round((s.attended / s.trainings) * 100) : 0);

export function valueOf(s: PlayerStat, stat: Stat): number {
  return stat === 'games' ? s.games : stat === 'goals' ? s.goals : stat === 'none' ? s.notSelected : stat === 'attendance' ? attendanceOf(s) : s.rotation;
}
