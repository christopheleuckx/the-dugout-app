import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from './auth';
import { asFormat, type Format } from './formats';
import { logoUrl, supabase } from './supabase';

export type Team = 'blue' | 'red';

export type Player = {
  id: string;
  firstName: string;
  lastName: string;
  number: number | null;
  bestPosition: string;
  preferredFoot: string;
  // A second position the player is being developed in, if any.
  developingPosition: string;
  // The coach's 1 to 5 star rating, if set.
  qualityRating: number | null;
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

// A player's evaluation for one game, as filled in on the web app's Ratings page.
export type Rating = { score: number | null; comment: string };

// Where a player lined up in one quarter: at kick-off and after the 10-minute change.
export type Stint = { label: string; starting: string; after10: string };

// Same scale as TEAM_RATING_SCALE in the web app.
export const TEAM_RATING_LABELS = ['Poor Team Performance', 'Below Expectations', 'Solid Team Performance', 'Dominant Team Performance', 'Exceptional Team Performance'];
// What each team rating means, shown under it when choosing.
export const TEAM_RATING_GUIDES = [
  'Failed to meet IP3 expectations. Significant difficulties in organisation, execution of playing principles and collective decision-making.',
  'Struggled to consistently apply our playing principles. Limited collective impact, insufficient control and too many individual or tactical mistakes.',
  'Performed at the expected IP3 level. Applied our playing principles effectively, with some areas for improvement.',
  'Had a significant impact on the game as a team. Controlled large parts of the match, dominated the opposition collectively and consistently applied our playing principles.',
  'Outstanding collective performance. Executed our playing principles consistently, controlled the game and performed at a level above IP3 expectations, even against stronger opposition.',
];

// The topics the team performance is rated on in detail, each from 1 to 5.
export const TEAM_CRITERIA = [
  { key: 'buildUp', title: 'Build-up and Possession', about: 'Creating passing options, finding the free player and maintaining possession.' },
  { key: 'pressing', title: 'Pressing and Defending', about: 'Collective pressure, compactness, covering and defensive organisation.' },
  { key: 'transitions', title: 'Transitions', about: 'Reactions after winning or losing possession.' },
  { key: 'positioning', title: 'Positioning and Team Structure', about: 'Width, depth, distances between players and creating numerical advantages.' },
  { key: 'decisions', title: 'Decision-Making and Execution', about: 'Recognising situations, playing tempo and making effective choices.' },
];
export const CRITERION_LABELS = ['Poor', 'Below Expectations', 'At Expected Level', 'Strong', 'Exceptional'];
export const CRITERION_GUIDES = [
  'Rarely executed our principles successfully, with significant collective difficulties.',
  'Showed some positive moments but struggled to execute our principles consistently.',
  'Applied our principles adequately, with occasional mistakes or inconsistencies.',
  'Consistently executed our principles effectively, with only minor shortcomings.',
  'Outstanding execution throughout the game, even under significant opposition pressure.',
];

// How strong the opponent was.
export const OPPONENT_LABELS = ['Development Level', 'Below IP3 Level', 'IP3 Level', 'Elite Level', 'High Elite Level'];
export const OPPONENT_GUIDES = [
  'Opponent significantly below IP3 standards, still developing fundamental technical and tactical skills.',
  'Opponent struggling to consistently meet IP3 standards in technical execution, decision-making or tactical organisation.',
  'Competitive opponent performing at the expected IP3 standard.',
  'Strong opponent demonstrating advanced technical abilities, tactical organisation and high playing intensity.',
  'Exceptional opponent with outstanding technical, tactical and physical qualities. Performs at the highest youth competition standards.',
];

// A team's post-match report, as filled in on the web app's Team report page.
export type Report = {
  score: number | null;
  // Score per team performance criterion (see TEAM_CRITERIA), when rated.
  criteria: Record<string, number | null>;
  // How strong the opponent was, 1 to 5, and the notes about them.
  opponentScore: number | null;
  opponent: string;
  // The general summary of the match, above the notes per quarter.
  summary: string;
  quarterNotes: { label: string; note: string }[];
  wentWell: string;
  toImprove: string;
};

// One quarter's line-up for a team: where each player starts and where they
// are after the 10-minute change (a field position, or a bench slot S1..S5).
export type QuarterLineup = { index: number; label: string; players: { id: string; starting: string; after10: string }[] };

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
  // How many teams the game was set up for (1, or 2 for Blue and Red).
  numTeams: number;
  // 8v8, 9v9 or 11v11: the game's own choice, else the age group's usual one.
  format: Format;
  // The league match this game was made from, if any.
  leagueMatchId: string | null;
  // Per player id: the team they are selected in, or why they are not selected.
  selection: Record<string, { team: Team | null; reason: string | null }>;
  // The teams playing this game, Blue first, each with its coaches' names
  // and the players selected for it.
  teams: { team: Team; coaches: string[]; players: Player[] }[];
  // Per team: the quarters that have a line-up filled in.
  lineups: Partial<Record<Team, QuarterLineup[]>>;
  // Per team: its report, when at least one field has been filled in.
  reports: Partial<Record<Team, Report>>;
  // Per player id: their rating, and where they played in each confirmed quarter.
  ratings: Record<string, Rating>;
  stints: Record<string, Stint[]>;
  // Number of matches planned in a tournament (the game's quarters).
  matches: number;
  // Minutes per quarter, and per quarter whether a change after 10 minutes is allowed.
  quarterLength: number;
  subsAllowed: boolean[];
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

export type Theme = { id: string; name: string; category: string };

// A video on a game (per team) or a training: a file in the club's private
// video storage (storageKey) or a link to another site such as YouTube (url).
export type Video = {
  id: string;
  gameId: string | null;
  team: Team | null;
  trainingId: string | null;
  title: string;
  storageKey: string | null;
  url: string | null;
  sizeBytes: number | null;
  // How often it was opened in the app.
  views: number;
  createdAt: string;
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
  // The training's themes: ids of a team tactic (major, minor) and a basic.
  majorTacticId: string | null;
  minorTacticId: string | null;
  basicId: string | null;
  // Per absent player id: the reason.
  absences: Record<string, string>;
  // Absences that count against attendance (not GK training etc.).
  unexcusedCount: number;
};

// An age group a coach works with: U12 of FCV Dender, with its teams.
export type AgeGroup = {
  id: string;
  name: string;
  // The format a new game starts with: 8v8, 9v9 or 11v11.
  format: string;
  clubId: string;
  clubName: string;
  clubLogoUrl: string | null;
  teams: { key: Team; name: string; color: string }[];
  // May this age group watch and upload videos? Set per club in Club management.
  video: boolean;
};

export type Profile = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
  // The lead admin is the one who may change what coaches are allowed to do.
  isLeadAdmin: boolean;
  preferredTeam: Team | null;
  // The coach's own age group (U12, U15), if chosen.
  ageGroup: string | null;
  // Where the profile picture is stored, and its public address; null means initials.
  avatarPath: string | null;
  avatarUrl: string | null;
  // Whether this coach may save videos to their own phone (admins always may).
  canSaveVideos: boolean;
  // The highest version of the walkthrough this coach has seen (0 = never).
  tourSeen: number;
  // The age groups this coach is linked to, and the one the app is showing:
  // the database only returns that age group's players, games and trainings.
  ageGroups: AgeGroup[];
  activeAgeGroup: AgeGroup | null;
};

type Data = {
  players: Player[];
  games: Game[];
  trainings: Training[];
  u15Fixtures: U15Fixture[];
  me: Profile | null;
  clubLogoUrl: string | null;
  // The club of the age group on show, as our side of a game is named.
  clubName: string;
  // Whether the age group on show has the video feature.
  videoEnabled: boolean;
  // The lists a training's themes are chosen from, in the web app's order.
  teamTactics: Theme[];
  basics: Theme[];
  // Known opponent clubs, by name.
  competitors: { id: string; name: string; logoPath: string | null; logoUrl: string | null }[];
  videos: Video[];
};

type DataValue = Data & {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const empty: Data = { players: [], games: [], trainings: [], u15Fixtures: [], me: null, clubLogoUrl: null, clubName: '', videoEnabled: false, competitors: [], teamTactics: [], basics: [], videos: [] };

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

function teamReport(game: any, team: Team): Report | null {
  const e = game.lineups?.[team]?.eval;
  if (!e) return null;
  const report: Report = {
    score: e.score ?? null,
    criteria: e.criteria ?? {},
    opponentScore: e.opponentScore ?? null,
    opponent: e.opponent ?? '',
    summary: e.summary ?? '',
    // One entry per quarter, in order; an empty note means nothing written yet.
    quarterNotes: (e.quarterNotes ?? []).map((note: string, i: number) => ({ label: game.quarter_labels?.[i] || `Q${i + 1}`, note: note ?? '' })),
    wentWell: e.wentWell ?? '',
    toImprove: e.toImprove ?? '',
  };
  const filled = report.score || report.opponentScore || report.summary || Object.values(report.criteria).some(Boolean) || report.opponent || report.quarterNotes.some((q) => q.note) || report.wentWell || report.toImprove;
  return filled ? report : null;
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
  const [players, games, squad, competitors, trainings, absences, profile, club, u15Comps, u15Teams, u15Days, u15Games, u15Extra, coaches, gameCoaches, goals, ratings, tactics, basics, videos] = await Promise.all([
    supabase.from('players').select('id, first_name, last_name, number, best_position, developing_position, preferred_foot, quality_rating'),
    supabase.from('games').select('id, date, time, opponent, type, competition, home_away, location, cancel_status, hidden_from_calendar, quarters, quarter_length, team_eval, num_teams, quarter_scores, quarter_labels, lineups, competitor_id, format, league_match_id'),
    supabase.from('game_squad').select('game_id, player_id, team, not_selected_reason'),
    supabase.from('competitors').select('id, name, logo_path'),
    supabase.from('trainings').select('id, date, label, start_time, end_time, location, cancel_status, hidden_from_calendar, major_tactic_id, minor_tactic_id, basic_id'),
    supabase.from('training_absences').select('training_id, player_id, reason'),
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
    supabase.from('player_ratings').select('game_id, player_id, score, comment'),
    supabase.from('team_tactics').select('id, name, category').order('created_at'),
    supabase.from('basics').select('id, name, category').order('created_at'),
    supabase.from('videos').select('id, game_id, team, training_id, title, storage_key, url, size_bytes, views, created_at').order('created_at'),
  ]);

  // The age groups the coach is linked to, with their club and teams.
  const linked = await supabase
    .from('age_group_members')
    .select('age_groups(id, name, default_format, video_enabled, clubs(id, name, logo_path, video_enabled, video_all_age_groups), teams(key, name, color))')
    .eq('user_id', userId);
  const ageGroups: AgeGroup[] = ((linked.data ?? []) as any[])
    .map((row) => row.age_groups)
    .filter(Boolean)
    .map((a) => ({
      id: a.id,
      name: a.name,
      format: a.default_format,
      clubId: a.clubs?.id ?? '',
      clubName: a.clubs?.name ?? '',
      clubLogoUrl: logoUrl(a.clubs?.logo_path),
      video: !!a.clubs?.video_enabled && (!!a.clubs?.video_all_age_groups || !!a.video_enabled),
      teams: (a.teams ?? []).sort((x: { key: string }, y: { key: string }) => x.key.localeCompare(y.key)),
    }))
    .sort((x, y) => x.clubName.localeCompare(y.clubName) || x.name.localeCompare(y.name));
  const activeAgeGroup = ageGroups.find((a) => a.id === profile.data?.active_age_group_id) ?? null;

  const failed = [players, games, squad, competitors, trainings, absences, profile, club, u15Comps, u15Teams, u15Days, u15Games, u15Extra, coaches, gameCoaches, goals, ratings, tactics, basics, videos].find((r) => r.error);
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

  const usualFormat = activeAgeGroup?.format;
  const playerList: Player[] = (players.data ?? [])
    .map((r) => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      number: r.number,
      bestPosition: r.best_position,
      preferredFoot: r.preferred_foot,
      developingPosition: r.developing_position ?? '',
      qualityRating: r.quality_rating,
    }))
    .sort((a, b) => a.firstName.localeCompare(b.firstName));

  // Line-ups are stored per team and quarter as { playerId: { starting, after10 } };
  // like the web app, only quarters whose line-up was confirmed count.
  const gameStints = (g: any) => {
    const out: Record<string, Stint[]> = {};
    for (const team of ['blue', 'red'] as Team[]) {
      const lineup = g.lineups?.[team];
      (lineup?.quarters ?? []).forEach((quarter: any, i: number) => {
        if (!lineup.confirmed?.[i]) return;
        for (const [playerId, entry] of Object.entries<any>(quarter ?? {})) {
          if (teamOfPlayer.get(`${g.id}|${playerId}`) !== team) continue;
          const starting = entry?.starting ?? '';
          (out[playerId] ??= []).push({
            label: g.quarter_labels?.[i] || `Q${i + 1}`,
            starting,
            after10: entry?.after10 || starting,
          });
        }
      });
    }
    return out;
  };

  const teamLineups = (g: any, team: Team): QuarterLineup[] =>
    ((g.lineups?.[team]?.quarters ?? []) as any[])
      .map((quarter, i) => ({
        index: i,
        label: g.quarter_labels?.[i] || `Q${i + 1}`,
        players: Object.entries<any>(quarter ?? {})
          .filter(([id, entry]) => entry?.starting && teamOfPlayer.get(`${g.id}|${id}`) === team)
          .map(([id, entry]) => ({ id, starting: entry.starting, after10: entry.after10 || entry.starting })),
      }))
      .filter((quarter) => quarter.players.length);

  // The teams a game is opened with: those with a squad, or, before a
  // selection exists, as many as the game was set up for.
  const coachName = new Map((coaches.data ?? []).map((c) => [c.id, `${c.first_name} ${c.last_name}`.trim()]));
  const gameTeams = (g: { id: string; num_teams: number }) => {
    const withSquad = (['blue', 'red'] as Team[]).filter((t) => teamsByGame.get(g.id)?.has(t));
    const teams: Team[] = withSquad.length ? withSquad : g.num_teams === 1 ? ['blue'] : ['blue', 'red'];
    return teams.map((team) => ({
      team,
      players: playerList.filter((pl) => teamOfPlayer.get(`${g.id}|${pl.id}`) === team),
      coaches: (gameCoaches.data ?? [])
        .filter((gc) => gc.game_id === g.id && gc.team === team)
        .map((gc) => coachName.get(gc.coach_id))
        .filter((name): name is string => !!name),
    }));
  };

  const p = profile.data;
  return {
    players: playerList,
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
      numTeams: g.num_teams === 1 ? 1 : 2,
      format: asFormat(g.format ?? usualFormat),
      leagueMatchId: g.league_match_id ?? null,
      selection: Object.fromEntries(
        (squad.data ?? [])
          .filter((r) => r.game_id === g.id && (r.team || r.not_selected_reason !== null))
          .map((r) => [r.player_id, { team: r.team === 'blue' || r.team === 'red' ? (r.team as Team) : null, reason: r.not_selected_reason }]),
      ),
      teams: gameTeams(g),
      ratings: Object.fromEntries(
        (ratings.data ?? [])
          .filter((r) => r.game_id === g.id)
          .map((r) => [r.player_id, { score: r.score, comment: r.comment ?? '' }]),
      ),
      reports: Object.fromEntries(
        playingTeams(g.id)
          .map((team) => [team, teamReport(g, team)] as const)
          .filter(([, report]) => report !== null),
      ),
      stints: gameStints(g),
      lineups: Object.fromEntries(playingTeams(g.id).map((team) => [team, teamLineups(g, team)])),
      matches: g.quarters,
      quarterLength: g.quarter_length,
      subsAllowed: Array.from({ length: g.quarters }, (_, i) => g.team_eval?.subsAllowed?.[i] ?? true),
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
      majorTacticId: t.major_tactic_id,
      minorTacticId: t.minor_tactic_id,
      basicId: t.basic_id,
      absentCount: absentByTraining.get(t.id) ?? 0,
      absences: Object.fromEntries((absences.data ?? []).filter((r) => r.training_id === t.id).map((r) => [r.player_id, r.reason ?? ''])),
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
          isLeadAdmin: !!p.is_lead_admin,
          preferredTeam: p.preferred_team ?? null,
          ageGroup: p.age_group ?? null,
          avatarPath: p.avatar_path ?? null,
          canSaveVideos: p.is_admin || !!p.feature_flags?.saveVideos,
          tourSeen: p.tour_seen ?? 0,
          ageGroups,
          activeAgeGroup,
          avatarUrl: p.avatar_path ? supabase.storage.from('avatars').getPublicUrl(p.avatar_path).data.publicUrl : null,
        }
      : null,
    // The logo of the club the coach is working in.
    clubLogoUrl: activeAgeGroup ? activeAgeGroup.clubLogoUrl : logoUrl(club.data?.logo_path),
    clubName: activeAgeGroup?.clubName || 'FCV Dender',
    videoEnabled: !!activeAgeGroup?.video,
    teamTactics: tactics.data ?? [],
    basics: basics.data ?? [],
    competitors: (competitors.data ?? [])
      .map((c) => ({ id: c.id, name: c.name, logoPath: c.logo_path ?? null, logoUrl: logoUrl(c.logo_path) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    videos: (videos.data ?? []).map((v) => ({
      id: v.id,
      gameId: v.game_id,
      team: v.team,
      trainingId: v.training_id,
      title: v.title,
      storageKey: v.storage_key,
      url: v.url,
      sizeBytes: v.size_bytes,
      views: v.views ?? 0,
      createdAt: v.created_at,
    })),
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
