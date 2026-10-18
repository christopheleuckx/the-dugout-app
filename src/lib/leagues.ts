import { toIso } from './data';
import { supabase } from './supabase';

export type Team = { id: string; own: boolean; name: string; logoUrl: string | null };
export type Match = { id: string; home: string; away: string; date: string | null; time: string | null; homeGoals: number | null; awayGoals: number | null };
export type Matchday = { id: string; number: number; matches: Match[] };
// Without standings (as in U12) only the matches and the clubs are shown.
export type League = { id: string; name: string; showStandings: boolean; win: number; draw: number; loss: number; ranking: string[]; teams: Team[]; days: Matchday[] };
export type Row = { team: Team; played: number; wins: number; draws: number; losses: number; goals_for: number; goals_against: number; goal_difference: number; points: number };

// The table: every played match counts for both clubs, and the clubs are
// ordered by the competition's own rules, first line first.
export function standings(league: League): Row[] {
  const rows = new Map<string, Row>(
    league.teams.map((team) => [team.id, { team, played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, goal_difference: 0, points: 0 }]),
  );
  for (const day of league.days) {
    for (const m of day.matches) {
      if (m.homeGoals === null || m.awayGoals === null) continue;
      for (const [id, scored, conceded] of [
        [m.home, m.homeGoals, m.awayGoals],
        [m.away, m.awayGoals, m.homeGoals],
      ] as [string, number, number][]) {
        const row = rows.get(id);
        if (!row) continue;
        row.played += 1;
        row.goals_for += scored;
        row.goals_against += conceded;
        if (scored > conceded) row.wins += 1;
        else if (scored === conceded) row.draws += 1;
        else row.losses += 1;
      }
    }
  }
  for (const row of rows.values()) {
    row.goal_difference = row.goals_for - row.goals_against;
    row.points = row.wins * league.win + row.draws * league.draw + row.losses * league.loss;
  }
  // Higher is better for everything except goals conceded.
  const value = (row: Row, key: string) => (key === 'goals_against' ? -row.goals_against : ((row as unknown as Record<string, number>)[key] ?? 0));
  return [...rows.values()].sort((a, b) => {
    for (const key of league.ranking) {
      const diff = value(b, key) - value(a, key);
      if (diff) return diff;
    }
    return a.team.name.localeCompare(b.team.name);
  });
}

// The matchday on show changes on Wednesday: until then the weekend that was
// just played (its results), from Wednesday on the next one to be played.
export function lastWednesday() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 4) % 7));
  return toIso(d);
}


// The matchday of the moment: the first that ends on or after the last
// Wednesday; when the season is over, the last one. Matchdays without dates
// count as still to come.
export function currentMatchday(days: Matchday[]) {
  const since = lastWednesday();
  const lastDate = (d: Matchday) => d.matches.reduce((max, m) => (m.date && m.date > max ? m.date : max), '') || '9999';
  const i = days.findIndex((d) => lastDate(d) >= since);
  return i === -1 ? days.length - 1 : i;
}

type Club = { id: string; name: string; logoUrl: string | null };

// The competitions of an age group, with their teams, matchdays and matches.
// The database only returns those of the team the coach is working in.
export async function loadLeagues(groupId: string, competitors: Club[], clubName: string, clubLogoUrl: string | null, id?: string): Promise<League[] | null> {
  let query = supabase
    .from('leagues')
    .select(
      'id, name, show_standings, points_win, points_draw, points_loss, ranking, league_teams(id, competitor_id, is_own_team), league_matchdays(id, number, league_matches(id, home_team_id, away_team_id, match_date, kickoff, home_goals, away_goals, position))',
    )
    .eq('age_group_id', groupId)
    .order('name');
  if (id) query = query.eq('id', id);
  const { data, error } = await query;
  if (error) return null;
  return (data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    showStandings: l.show_standings ?? true,
    win: l.points_win,
    draw: l.points_draw,
    loss: l.points_loss,
    ranking: Array.isArray(l.ranking) ? (l.ranking as string[]) : ['points'],
    teams: (l.league_teams ?? []).map((t) => {
      const opponent = competitors.find((x) => x.id === t.competitor_id);
      return { id: t.id, own: t.is_own_team, name: t.is_own_team ? clubName : (opponent?.name ?? 'Unknown'), logoUrl: t.is_own_team ? clubLogoUrl : (opponent?.logoUrl ?? null) };
    }),
    days: (l.league_matchdays ?? [])
      .slice()
      .sort((a, b) => a.number - b.number)
      .map((d) => ({
        id: d.id,
        number: d.number,
        matches: (d.league_matches ?? [])
          .slice()
          .sort((a, b) => ((a.match_date ?? '') + (a.kickoff ?? '')).localeCompare((b.match_date ?? '') + (b.kickoff ?? '')) || a.position - b.position)
          .map((m) => ({
            id: m.id,
            home: m.home_team_id,
            away: m.away_team_id,
            date: m.match_date ?? null,
            time: m.kickoff ? String(m.kickoff).slice(0, 5) : null,
            homeGoals: m.home_goals ?? null,
            awayGoals: m.away_goals ?? null,
          })),
      })),
  }));
}
