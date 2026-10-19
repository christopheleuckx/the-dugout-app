import type { Player } from './data';
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
