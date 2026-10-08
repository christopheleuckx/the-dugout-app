import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from './auth';
import { logoUrl, supabase } from './supabase';

export type Team = 'blue' | 'red';

export type Player = {
  id: string;
  firstName: string;
  lastName: string;
  number: number | null;
  bestPosition: string;
  preferredFoot: string;
};

export type Score = { home: number; away: number; result: 'W' | 'D' | 'L' };

// A team's tournament day: every "quarter" of a tournament game is a match of its own.
export type TeamRecord = {
  team: Team;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  // Final ranking in the tournament as typed in the web app ("1st Place"), if any.
  place: string | null;
};

export type Quarter = { label: string; home: number | null; away: number | null; scorers: string[] };

export type Game = {
  id: string;
  date: string | null;
  time: string | null;
  opponent: string;
  competition: string;
  // Elite, IP3 or Other.
  type: string;
  homeAway: string;
  location: string;
  cancelStatus: string | null;
  hiddenFromCalendar: boolean;
  opponentLogoUrl: string | null;
  squadCount: number;
  // One scoreline per team that played: a 2-team game is two separate matches.
  scores: { team: Team; score: Score }[];
  // The teams playing this game, Blue first, each with its coaches' names.
  teams: { team: Team; coaches: string[] }[];
  // Number of matches planned in a tournament (the game's quarters).
  matches: number;
  // Per team, one entry per quarter: its name, the score in home-away order
  // (null while not filled in) and who scored for us.
  quarters: Partial<Record<Team, Quarter[]>>;
  // Per-team tally of those matches; only filled for tournaments.
  records: TeamRecord[];
};

// A U15 game involving our own club: a competition fixture, friendly or tournament.
export type U15Fixture = {
  id: string;
  date: string;
  time: string | null;
  opponent: string;
  opponentLogoUrl: string | null;
  homeAway: string;
  competition: string;
  cancelStatus: string | null;
};

export type Training = {
  id: string;
  date: string;
  label: string;
  startTime: string | null;
  endTime: string | null;
  location: string;
  cancelStatus: string | null;
  hiddenFromCalendar: boolean;
  absentCount: number;
  // Absences that count against attendance (not GK training etc.).
  unexcusedCount: number;
};

export type Profile = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
  preferredTeam: Team | null;
};

type Data = {
  players: Player[];
  games: Game[];
  trainings: Training[];
  u15Fixtures: U15Fixture[];
  me: Profile | null;
  clubLogoUrl: string | null;
};

type DataValue = Data & {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const empty: Data = { players: [], games: [], trainings: [], u15Fixtures: [], me: null, clubLogoUrl: null };

const DataContext = createContext<DataValue | null>(null);

// Same list as the web app: these absences don't count against attendance.
const EXCUSED_TRAINING_ABSENCE_REASONS = ['GK Training', 'Training with another team'];

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

// Same "us / them" sum as totalScore() in the web app, shown in home-away order.
// Scores are kept per team. Older games still have them in the shared,
// game-level quarter_scores field, which the web app falls back to as well.
function quarterScores(game: any, team: Team) {
  return game.lineups?.[team]?.quarterScores ?? game.quarter_scores;
}

function teamScore(game: any, team: Team): Score | null {
  const quarters = quarterScores(game, team);
  if (!Array.isArray(quarters)) return null;
  let f = 0;
  let a = 0;
  let any = false;
  for (const q of quarters) {
    if (q?.for != null) { f += q.for; any = true; }
    if (q?.against != null) { a += q.against; any = true; }
  }
  if (!any) return null;
  const result = f > a ? 'W' : f < a ? 'L' : 'D';
  return game.home_away === 'Away' ? { home: a, away: f, result } : { home: f, away: a, result };
}

function teamRecord(game: any, team: Team): TeamRecord | null {
  const quarters = quarterScores(game, team);
  if (!Array.isArray(quarters)) return null;
  const place = game.lineups?.[team]?.place ? String(game.lineups[team].place) : null;
  const r: TeamRecord = { team, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, place };
  for (const q of quarters) {
    if (q?.for == null || q?.against == null) continue;
    r.goalsFor += q.for;
    r.goalsAgainst += q.against;
    if (q.for > q.against) r.won++;
    else if (q.for < q.against) r.lost++;
    else r.drawn++;
  }
  return r.won + r.drawn + r.lost ? r : null;
}

async function load(userId: string): Promise<Data> {
  const [players, games, squad, competitors, trainings, absences, profile, club, u15Comps, u15Teams, u15Days, u15Games, u15Extra, coaches, gameCoaches, goals] = await Promise.all([
    supabase.from('players').select('id, first_name, last_name, number, best_position, preferred_foot'),
    supabase.from('games').select('id, date, time, opponent, type, competition, home_away, location, cancel_status, hidden_from_calendar, quarters, num_teams, quarter_scores, quarter_labels, lineups, competitor_id'),
    supabase.from('game_squad').select('game_id, player_id, team'),
    supabase.from('competitors').select('id, name, logo_path'),
    supabase.from('trainings').select('id, date, label, start_time, end_time, location, cancel_status, hidden_from_calendar'),
    supabase.from('training_absences').select('training_id, reason'),
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('club_settings').select('logo_path').maybeSingle(),
    supabase.from('u15_competitions').select('id, name'),
    supabase.from('u15_competition_teams').select('id, competitor_id, is_own_team'),
    supabase.from('u15_matchdays').select('id, competition_id, date'),
    supabase.from('u15_matchday_games').select('id, matchday_id, team_a_id, team_b_id, kickoff_date, kickoff_time'),
    supabase.from('u15_extra_games').select('id, kind, title, date, kickoff_time, cancel_status, home_away'),
    supabase.from('coaches').select('id, first_name, last_name'),
    supabase.from('game_coaches').select('game_id, coach_id, team'),
    supabase.from('goals').select('game_id, quarter, scorer_id, created_at').order('created_at'),
  ]);

  const failed = [players, games, squad, competitors, trainings, absences, profile, club, u15Comps, u15Teams, u15Days, u15Games, u15Extra, coaches, gameCoaches, goals].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  const logoByCompetitor = new Map((competitors.data ?? []).map((c) => [c.id, logoUrl(c.logo_path)]));
  const squadByGame = new Map<string, number>();
  const teamsByGame = new Map<string, Set<Team>>();
  const teamOfPlayer = new Map<string, Team>();
  for (const r of squad.data ?? []) {
    if (r.team !== 'blue' && r.team !== 'red') continue;
    squadByGame.set(r.game_id, (squadByGame.get(r.game_id) ?? 0) + 1);
    teamsByGame.set(r.game_id, (teamsByGame.get(r.game_id) ?? new Set<Team>()).add(r.team));
    teamOfPlayer.set(`${r.game_id}|${r.player_id}`, r.team);
  }
  const absentByTraining = new Map<string, number>();
  const unexcusedByTraining = new Map<string, number>();
  for (const r of absences.data ?? []) {
    absentByTraining.set(r.training_id, (absentByTraining.get(r.training_id) ?? 0) + 1);
    if (!EXCUSED_TRAINING_ABSENCE_REASONS.includes(r.reason)) {
      unexcusedByTraining.set(r.training_id, (unexcusedByTraining.get(r.training_id) ?? 0) + 1);
    }
  }

  // U15 fixtures involving our own club (never the other clubs' games in the
  // same competition), dated by their own kickoff date if set, else the matchday's.
  const competitorById = new Map((competitors.data ?? []).map((c) => [c.id, c]));
  const logoByName = new Map((competitors.data ?? []).map((c) => [c.name, logoUrl(c.logo_path)]));
  const teamById = new Map((u15Teams.data ?? []).map((t) => [t.id, t]));
  const dayById = new Map((u15Days.data ?? []).map((d) => [d.id, d]));
  const compName = new Map((u15Comps.data ?? []).map((c) => [c.id, c.name]));
  const u15Fixtures: U15Fixture[] = [];
  for (const g of u15Games.data ?? []) {
    const a = teamById.get(g.team_a_id);
    const b = g.team_b_id ? teamById.get(g.team_b_id) : null;
    const matchday = dayById.get(g.matchday_id);
    if (!a || !b || !matchday || (!a.is_own_team && !b.is_own_team)) continue;
    const them = competitorById.get((a.is_own_team ? b : a).competitor_id);
    u15Fixtures.push({
      id: g.id,
      date: g.kickoff_date ?? matchday.date,
      time: hhmm(g.kickoff_time),
      opponent: them?.name ?? 'Unknown',
      opponentLogoUrl: logoUrl(them?.logo_path),
      homeAway: a.is_own_team ? 'Home' : 'Away',
      competition: compName.get(matchday.competition_id) ?? '',
      cancelStatus: null,
    });
  }
  for (const x of u15Extra.data ?? []) {
    u15Fixtures.push({
      id: x.id,
      date: x.date,
      time: hhmm(x.kickoff_time),
      opponent: x.title,
      opponentLogoUrl: (x.kind === 'friendly' && logoByName.get(x.title)) || null,
      homeAway: x.home_away,
      competition: x.kind === 'tournament' ? 'Tournament' : 'Friendly',
      cancelStatus: x.cancel_status,
    });
  }

  // Only teams with players in the squad have a result; a game without a
  // squad yet counts as Team Blue's, like in the web app.
  const playingTeams = (gameId: string): Team[] => {
    const teams = (['blue', 'red'] as Team[]).filter((t) => teamsByGame.get(gameId)?.has(t));
    return teams.length ? teams : ['blue'];
  };

  // A goal belongs to the team its scorer was selected in for that game.
  const playerName = new Map((players.data ?? []).map((pl) => [pl.id, `${pl.first_name} ${pl.last_name}`.trim()]));
  const teamQuarters = (g: any, team: Team): Quarter[] =>
    Array.from({ length: g.quarters }, (_, i) => {
      const q = quarterScores(g, team)?.[i];
      const us = q?.for ?? null;
      const opp = q?.against ?? null;
      return {
        label: g.quarter_labels?.[i] || `Q${i + 1}`,
        home: g.home_away === 'Away' ? opp : us,
        away: g.home_away === 'Away' ? us : opp,
        scorers: (goals.data ?? [])
          .filter((x) => x.game_id === g.id && x.quarter === i + 1 && teamOfPlayer.get(`${g.id}|${x.scorer_id}`) === team)
          .map((x) => playerName.get(x.scorer_id) ?? 'Unknown'),
      };
    });

  // The teams a game is opened with: those with a squad, or, before a
  // selection exists, as many as the game was set up for.
  const coachName = new Map((coaches.data ?? []).map((c) => [c.id, `${c.first_name} ${c.last_name}`.trim()]));
  const gameTeams = (g: { id: string; num_teams: number }) => {
    const withSquad = (['blue', 'red'] as Team[]).filter((t) => teamsByGame.get(g.id)?.has(t));
    const teams: Team[] = withSquad.length ? withSquad : g.num_teams === 1 ? ['blue'] : ['blue', 'red'];
    return teams.map((team) => ({
      team,
      coaches: (gameCoaches.data ?? [])
        .filter((gc) => gc.game_id === g.id && gc.team === team)
        .map((gc) => coachName.get(gc.coach_id))
        .filter((name): name is string => !!name),
    }));
  };

  const p = profile.data;
  return {
    players: (players.data ?? [])
      .map((r) => ({
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        number: r.number,
        bestPosition: r.best_position,
        preferredFoot: r.preferred_foot,
      }))
      .sort((a, b) => a.firstName.localeCompare(b.firstName)),
    games: (games.data ?? []).map((g) => ({
      id: g.id,
      date: g.date,
      time: hhmm(g.time),
      opponent: g.opponent,
      competition: g.competition,
      type: g.type,
      homeAway: g.home_away,
      location: g.location,
      cancelStatus: g.cancel_status,
      hiddenFromCalendar: g.hidden_from_calendar,
      opponentLogoUrl: (g.competitor_id && logoByCompetitor.get(g.competitor_id)) || null,
      squadCount: squadByGame.get(g.id) ?? 0,
      scores: playingTeams(g.id)
        .map((team) => ({ team, score: teamScore(g, team) }))
        .filter((s): s is { team: Team; score: Score } => s.score !== null),
      teams: gameTeams(g),
      matches: g.quarters,
      quarters: Object.fromEntries(playingTeams(g.id).map((team) => [team, teamQuarters(g, team)])),
      records:
        g.competition === 'Tournament'
          ? playingTeams(g.id).map((team) => teamRecord(g, team)).filter((r) => r !== null)
          : [],
    })),
    trainings: (trainings.data ?? []).map((t) => ({
      id: t.id,
      date: t.date,
      label: t.label,
      startTime: hhmm(t.start_time),
      endTime: hhmm(t.end_time),
      location: t.location,
      cancelStatus: t.cancel_status,
      hiddenFromCalendar: t.hidden_from_calendar,
      absentCount: absentByTraining.get(t.id) ?? 0,
      unexcusedCount: unexcusedByTraining.get(t.id) ?? 0,
    })),
    u15Fixtures,
    me: p
      ? {
          id: p.id,
          username: p.username,
          firstName: p.first_name,
          lastName: p.last_name,
          isAdmin: p.is_admin,
          preferredTeam: p.preferred_team ?? null,
        }
      : null,
    clubLogoUrl: logoUrl(club.data?.logo_path),
  };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [data, setData] = useState<Data>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      setData(await load(userId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load data.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      setLoading(true);
      refresh();
    } else {
      setData(empty);
    }
  }, [userId, refresh]);

  return <DataContext.Provider value={{ ...data, loading, error, refresh }}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}

export function toIso(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayIso() {
  return toIso(new Date());
}

// Monday to Sunday as ISO dates: the current week, or `offset` weeks from it.
export function currentWeek(offset = 0) {
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toIso(d);
  });
}

export function fmtDate(iso: string | null) {
  if (!iso) return 'No date';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}
