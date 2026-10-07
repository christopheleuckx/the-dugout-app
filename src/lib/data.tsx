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

export type Game = {
  id: string;
  date: string | null;
  time: string | null;
  opponent: string;
  competition: string;
  homeAway: string;
  location: string;
  cancelStatus: string | null;
  hiddenFromCalendar: boolean;
  opponentLogoUrl: string | null;
  squadCount: number;
  // One scoreline per team that played: a 2-team game is two separate matches.
  scores: { team: Team; score: Score }[];
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
  me: Profile | null;
  clubLogoUrl: string | null;
};

type DataValue = Data & {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const empty: Data = { players: [], games: [], trainings: [], me: null, clubLogoUrl: null };

const DataContext = createContext<DataValue | null>(null);

// Same list as the web app: these absences don't count against attendance.
const EXCUSED_TRAINING_ABSENCE_REASONS = ['GK Training', 'Training with another team'];

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

// Same "us / them" sum as totalScore() in the web app, shown in home-away order.
function teamScore(game: any, team: Team): Score | null {
  const quarters = game.lineups?.[team]?.quarterScores;
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

async function load(userId: string): Promise<Data> {
  const [players, games, squad, competitors, trainings, absences, profile, club] = await Promise.all([
    supabase.from('players').select('id, first_name, last_name, number, best_position, preferred_foot'),
    supabase.from('games').select('id, date, time, opponent, competition, home_away, location, cancel_status, hidden_from_calendar, lineups, competitor_id'),
    supabase.from('game_squad').select('game_id, team'),
    supabase.from('competitors').select('id, logo_path'),
    supabase.from('trainings').select('id, date, label, start_time, end_time, location, cancel_status, hidden_from_calendar'),
    supabase.from('training_absences').select('training_id, reason'),
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('club_settings').select('logo_path').maybeSingle(),
  ]);

  const failed = [players, games, squad, competitors, trainings, absences, profile, club].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  const logoByCompetitor = new Map((competitors.data ?? []).map((c) => [c.id, logoUrl(c.logo_path)]));
  const squadByGame = new Map<string, number>();
  for (const r of squad.data ?? []) {
    if (r.team) squadByGame.set(r.game_id, (squadByGame.get(r.game_id) ?? 0) + 1);
  }
  const absentByTraining = new Map<string, number>();
  const unexcusedByTraining = new Map<string, number>();
  for (const r of absences.data ?? []) {
    absentByTraining.set(r.training_id, (absentByTraining.get(r.training_id) ?? 0) + 1);
    if (!EXCUSED_TRAINING_ABSENCE_REASONS.includes(r.reason)) {
      unexcusedByTraining.set(r.training_id, (unexcusedByTraining.get(r.training_id) ?? 0) + 1);
    }
  }

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
      homeAway: g.home_away,
      location: g.location,
      cancelStatus: g.cancel_status,
      hiddenFromCalendar: g.hidden_from_calendar,
      opponentLogoUrl: (g.competitor_id && logoByCompetitor.get(g.competitor_id)) || null,
      squadCount: squadByGame.get(g.id) ?? 0,
      scores: (['blue', 'red'] as Team[])
        .map((team) => ({ team, score: teamScore(g, team) }))
        .filter((s): s is { team: Team; score: Score } => s.score !== null),
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

// Monday to Sunday of the current week, as ISO dates.
export function currentWeek() {
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
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
