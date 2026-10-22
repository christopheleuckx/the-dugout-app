import type { Game, Player } from './data';
import { groupOf, POSITION_GROUPS } from './selection';

function shuffle<T>(list: T[]) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Divides the players over a number of groups the way the web app does:
// every next player goes to the smallest group, so sizes differ by one at
// most, and each line (defenders, midfielders, ...) is spread over all
// groups. Goalkeepers are spread too, or all go to the first group.
export function makeGroups(players: Player[], numGroups: number, splitGoalies: boolean): string[][] {
  const groups: string[][] = Array.from({ length: numGroups }, () => []);
  const smallest = () => groups.reduce((best, g, i) => (g.length < groups[best].length ? i : best), 0);
  const deal = (list: Player[]) => shuffle(list).forEach((p) => groups[smallest()].push(p.id));

  const keepers = players.filter((p) => groupOf(p.bestPosition) === 0);
  if (splitGoalies) deal(keepers);
  else shuffle(keepers).forEach((p) => groups[0].push(p.id));

  // Lines after the goalies, then players without a known position.
  for (let line = 1; line <= POSITION_GROUPS.length; line++) deal(players.filter((p) => groupOf(p.bestPosition) === line));
  return groups;
}

// The first game on or after a training's day that is not cancelled: the one
// whose selection the training can prepare for.
export function nextGame(games: Game[], fromDate: string): Game | null {
  return (
    games
      .filter((g) => g.date && g.date >= fromDate && !g.cancelStatus)
      .sort((a, b) => (a.date! + (a.time ?? '')).localeCompare(b.date! + (b.time ?? '')))[0] ?? null
  );
}

// Two groups from a game's selection, made of the players present at training.
// Blue and Red: each team is a group, and the present players who are not
// selected are added to the smaller group one by one. One team only: the
// selected players are one group and every other present player the other.
// Null when the game has no selection yet.
export function groupsFromSelection(game: Game, present: Player[]): { groupIds: string[][]; labels: string[] } | null {
  const picks = Object.values(game.selection);
  const used = (['blue', 'red'] as const).filter((t) => picks.some((s) => s.team === t));
  if (!used.length) return null;
  const teamOf = (p: Player) => game.selection[p.id]?.team ?? null;
  if (used.length === 1) {
    const team = used[0];
    return {
      groupIds: [present.filter((p) => teamOf(p) === team).map((p) => p.id), present.filter((p) => teamOf(p) !== team).map((p) => p.id)],
      labels: ['Selected', 'Not selected'],
    };
  }
  const groups = [present.filter((p) => teamOf(p) === 'blue').map((p) => p.id), present.filter((p) => teamOf(p) === 'red').map((p) => p.id)];
  // The others line by line (goalkeepers first), each to the smaller group.
  const rest = present.filter((p) => !teamOf(p));
  for (let line = 0; line <= POSITION_GROUPS.length; line++) {
    for (const p of shuffle(rest.filter((x) => groupOf(x.bestPosition) === line))) groups[groups[0].length <= groups[1].length ? 0 : 1].push(p.id);
  }
  return { groupIds: groups, labels: ['Team Blue', 'Team Red'] };
}
