import type { Game, Player } from './data';
import { todayIso } from './data';

export type Stat = 'games' | 'goals' | 'none' | 'rotation';

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
};

// The games that count: played (not in the future), not cancelled, with a selection made.
export function countedGames(games: Game[]): Game[] {
  const today = todayIso();
  return games
    .filter((g) => !!g.date && g.date <= today && !g.cancelStatus && Object.keys(g.selection).length > 0)
    .sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : 0));
}

export function playerStats(players: Player[], games: Game[], goals: { gameId: string; scorerId: string }[]): { stats: PlayerStat[]; gameCount: number } {
  const counted = countedGames(games);
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
    return {
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
  return { stats, gameCount: counted.length };
}

export const STAT_ORDER: Stat[] = ['games', 'goals', 'none', 'rotation'];

export const STAT_TITLE: Record<Stat, string> = {
  games: 'Games played',
  goals: 'Goals scored',
  none: 'No selection',
  rotation: 'Rotation',
};

export const STAT_ABOUT: Record<Stat, string> = {
  games: 'Selected for a team in a game',
  goals: 'Goals in the goal log',
  none: 'Not selected, any reason',
  rotation: 'Rested because of rotation',
};

export const STAT_UNIT: Record<Stat, string> = { games: 'games', goals: 'goals', none: 'times', rotation: 'times' };

export function valueOf(s: PlayerStat, stat: Stat): number {
  return stat === 'games' ? s.games : stat === 'goals' ? s.goals : stat === 'none' ? s.notSelected : s.rotation;
}
