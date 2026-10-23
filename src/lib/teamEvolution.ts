import { TEAM_CRITERIA, type Game, type Team } from './data';
import { correctFor, countedGames, gameScore, tenOf, TEN_POINT } from './playerStats';

// The team score out of 10 is made of four parts, each corrected for the
// opponent strength of the team's game report, the same way as a player score.
export type Part = 'team' | 'players' | 'criteria' | 'result';
export const PARTS: { key: Part; label: string; weight: number }[] = [
  { key: 'team', label: 'Team performance', weight: 0.4 },
  { key: 'players', label: 'Players', weight: 0.3 },
  { key: 'criteria', label: 'Game criteria', weight: 0.2 },
  { key: 'result', label: 'Results', weight: 0.1 },
];
// A result on the 10-point scale: a win counts as a 4, a draw as a 3, a loss as a 2.
const RESULT_TEN = { W: TEN_POINT[4], D: TEN_POINT[3], L: TEN_POINT[2] };

// One team's game: its four parts (null when not filled in) and its index.
export type TeamGame = {
  game: Game;
  team: Team;
  strength: number | null;
  teamRating: number | null;
  playersAverage: number | null;
  criteria: Record<string, number>;
  result: { home: number; away: number; result: 'W' | 'D' | 'L' } | null;
  parts: Record<Part, number | null>;
  index: number;
};

// Weighted average of the parts that are there; a missing part hands its
// weight to the others, so a game without criteria does not count as a 0.
function weighted(parts: Record<Part, number | null>): number | null {
  let sum = 0;
  let weights = 0;
  for (const p of PARTS) {
    const v = parts[p.key];
    if (v === null) continue;
    sum += v * p.weight;
    weights += p.weight;
  }
  return weights ? sum / weights : null;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// Every played game of the teams asked for (tournaments left out), oldest first,
// that has a team score or player ratings.
export function teamGames(games: Game[], teams: Team[]): TeamGame[] {
  const out: TeamGame[] = [];
  for (const game of countedGames(games)) {
    if (game.competition === 'Tournament') continue;
    for (const team of teams) {
      const picked = Object.entries(game.selection).filter(([, s]) => s.team === team);
      if (!picked.length) continue;
      const report = game.reports[team] ?? null;
      const strength = report?.opponentScore ?? null;
      const teamRating = report?.score ?? null;
      const ratings = picked.map(([id]) => game.ratings[id]?.score).filter((x): x is number => typeof x === 'number');
      const criteria = Object.fromEntries(
        Object.entries(report?.criteria ?? {}).filter((e): e is [string, number] => typeof e[1] === 'number'),
      );
      const criteriaAverage = avg(Object.values(criteria));
      const result = game.scores.find((s) => s.team === team)?.score ?? null;
      const parts: Record<Part, number | null> = {
        team: teamRating ? gameScore({ rating: teamRating, strength }) : null,
        players: ratings.length ? (avg(ratings.map((rating) => gameScore({ rating, strength }))) as number) : null,
        criteria: criteriaAverage !== null ? correctFor(tenOf(criteriaAverage), strength) : null,
        result: result ? correctFor(RESULT_TEN[result.result], strength) : null,
      };
      if (parts.team === null && parts.players === null) continue;
      out.push({
        game,
        team,
        strength,
        teamRating,
        playersAverage: avg(ratings),
        criteria,
        result,
        parts,
        index: weighted(parts) as number,
      });
    }
  }
  return out;
}

const monthOf = (g: TeamGame) => g.game.date!.slice(0, 7);

// The season overview: the team score (each part averaged over its games, then
// weighted), the form of the last three games, the change against the month
// before, wins and losses, the best game, and per criterion its first and last rating.
export function teamEvolution(list: TeamGame[]) {
  const partAverages = Object.fromEntries(
    PARTS.map((p) => [p.key, avg(list.map((g) => g.parts[p.key]).filter((x): x is number => x !== null))]),
  ) as Record<Part, number | null>;
  const partCounts = Object.fromEntries(PARTS.map((p) => [p.key, list.filter((g) => g.parts[p.key] !== null).length])) as Record<Part, number>;
  const months = [...new Set(list.map(monthOf))];
  const monthIndex = (m: string) => avg(list.filter((g) => monthOf(g) === m).map((g) => g.index));
  const last = months.at(-1);
  const before = months.at(-2);
  const rolling = list.map((_, i) => (i >= 2 ? (avg(list.slice(i - 2, i + 1).map((g) => g.index)) as number) : null));
  const best = list.reduce<TeamGame | null>((b, g) => (!b || g.index > b.index ? g : b), null);
  const criteria = TEAM_CRITERIA.map((c) => {
    const rated = list.filter((g) => typeof g.criteria[c.key] === 'number');
    return { ...c, first: rated[0]?.criteria[c.key] ?? null, last: rated.at(-1)?.criteria[c.key] ?? null, count: rated.length };
  });
  return {
    score: weighted(partAverages),
    partAverages,
    partCounts,
    form: list.length >= 3 ? rolling.at(-1)! : avg(list.map((g) => g.index)),
    rolling,
    change: last && before ? (monthIndex(last) as number) - (monthIndex(before) as number) : null,
    beforeMonth: before ?? null,
    won: list.filter((g) => g.result?.result === 'W').length,
    drawn: list.filter((g) => g.result?.result === 'D').length,
    lost: list.filter((g) => g.result?.result === 'L').length,
    best,
    criteria,
    criteriaGames: list.filter((g) => Object.keys(g.criteria).length).length,
  };
}
