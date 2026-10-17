import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Animated, KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Crest } from '../components/MatchCard';
import { fmtDate, toIso, useData } from '../lib/data';
import { goBack } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';

// What the table can be ordered by, in the words the coach reads.
const RANKING: Record<string, string> = {
  points: 'Points',
  goal_difference: 'Goals scored − goals conceded',
  goals_for: 'Goals scored',
  wins: 'Total games won',
  goals_against: 'Goals conceded',
};
const DEFAULT_RANKING = Object.keys(RANKING);
const ROW = 54;

type Team = { id: string; competitorId: string | null; own: boolean; name: string; logoUrl: string | null };
type Match = { id: string; home: string; away: string; date: string | null; time: string | null; homeGoals: number | null; awayGoals: number | null };
type Matchday = { id: string; number: number; matches: Match[] };
type League = { id: string; name: string; win: number; draw: number; loss: number; ranking: string[] };
type View_ = 'main' | 'teams' | 'ranking' | { matchday: string; match?: string };

// A row that is picked up by its handle. While it is held it follows the
// finger; on release the page decides what the drop means.
function DragRow({
  children,
  onStart,
  onDrop,
  background,
  handleColor,
}: {
  children: ReactNode;
  onStart: () => void;
  onDrop: (dy: number, pageY: number) => void;
  background: string;
  handleColor: string;
}) {
  const move = useRef(new Animated.Value(0)).current;
  const [held, setHeld] = useState(false);
  // The latest callbacks, so the gesture never works with an old list.
  const latest = useRef({ onStart, onDrop });
  latest.current = { onStart, onDrop };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setHeld(true);
        latest.current.onStart();
      },
      onPanResponderMove: (_, g) => move.setValue(g.dy),
      onPanResponderRelease: (_, g) => {
        setHeld(false);
        move.setValue(0);
        latest.current.onDrop(g.dy, g.moveY);
      },
      onPanResponderTerminate: () => {
        setHeld(false);
        move.setValue(0);
        latest.current.onDrop(0, -1);
      },
    }),
  ).current;

  return (
    <Animated.View
      style={[
        styles.dragRow,
        { backgroundColor: background, transform: [{ translateY: move }] },
        held && styles.held,
      ]}
    >
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>{children}</View>
      <View {...pan.panHandlers} style={styles.handle} accessibilityLabel="Drag">
        <Ionicons name="reorder-three" size={24} color={handleColor} />
      </View>
    </Animated.View>
  );
}

// One competition: its name, its teams, its matchdays with their matches,
// and the rules for the table. Everything saves as it is changed.
export default function LeagueScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me, competitors, clubName, clubLogoUrl } = useData();
  const group = me?.activeAgeGroup;

  const [league, setLeague] = useState<League | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [days, setDays] = useState<Matchday[]>([]);
  const [view, setView] = useState<View_>('main');
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [dragging, setDragging] = useState(false);
  // The team row being dragged, drawn above the rows it passes over.
  const [heldTeam, setHeldTeam] = useState<string | null>(null);
  // On a matchday: the team tapped first, waiting for its opponent.
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  // The match on show: its date and kick-off as they are being chosen, and
  // which of the two pickers is open.
  const [matchDate, setMatchDate] = useState<Date | null>(null);
  const [matchTime, setMatchTime] = useState<Date | null>(null);
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  // Its score: both empty while the match has not been played.
  const [homeGoals, setHomeGoals] = useState<number | null>(null);
  const [awayGoals, setAwayGoals] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [l, t, d] = await Promise.all([
      supabase.from('leagues').select('id, name, points_win, points_draw, points_loss, ranking').eq('id', id).maybeSingle(),
      supabase.from('league_teams').select('id, competitor_id, is_own_team').eq('league_id', id),
      supabase.from('league_matchdays').select('id, number, league_matches(id, home_team_id, away_team_id, position, match_date, kickoff, home_goals, away_goals)').eq('league_id', id).order('number'),
    ]);
    if (l.error || t.error || d.error) return setError(`Could not load the competition: ${(l.error ?? t.error ?? d.error)!.message}`);
    if (!l.data) return setMissing(true);
    const known = Array.isArray(l.data.ranking) ? (l.data.ranking as string[]).filter((k) => k in RANKING) : [];
    setLeague({
      id: l.data.id,
      name: l.data.name,
      win: l.data.points_win,
      draw: l.data.points_draw,
      loss: l.data.points_loss,
      ranking: [...known, ...DEFAULT_RANKING.filter((k) => !known.includes(k))],
    });
    setName(l.data.name);
    setTeams(
      (t.data ?? [])
        .map((row) => {
          const opponent = competitors.find((x) => x.id === row.competitor_id);
          return {
            id: row.id,
            competitorId: row.competitor_id,
            own: row.is_own_team,
            name: row.is_own_team ? clubName : (opponent?.name ?? 'Unknown'),
            logoUrl: row.is_own_team ? clubLogoUrl : (opponent?.logoUrl ?? null),
          };
        })
        .sort((a, b) => Number(b.own) - Number(a.own) || a.name.localeCompare(b.name)),
    );
    setDays(
      (d.data ?? []).map((day) => ({
        id: day.id,
        number: day.number,
        matches: (day.league_matches ?? [])
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((m) => ({ id: m.id, home: m.home_team_id, away: m.away_team_id, date: m.match_date ?? null, time: m.kickoff ? String(m.kickoff).slice(0, 5) : null, homeGoals: m.home_goals ?? null, awayGoals: m.away_goals ?? null })),
      })),
    );
  }, [id, competitors, clubName, clubLogoUrl]);
  useEffect(() => {
    load();
  }, [load]);

  // Every change goes straight to the database; a refusal is shown and the
  // page reloads what is really stored.
  async function save(action: PromiseLike<{ error: { message: string } | null }>) {
    setError('');
    const { error: failed } = await action;
    if (failed) setError(`Could not save: ${failed.message}`);
    await load();
  }

  const teamOf = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const day = typeof view === 'object' ? days.find((x) => x.id === view.matchday) : undefined;
  const match = typeof view === 'object' && view.match ? day?.matches.find((m) => m.id === view.match) : undefined;
  const free = day ? teams.filter((t) => !day.matches.some((m) => m.home === t.id || m.away === t.id)) : [];
  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };

  function renameLeague() {
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!league || !clean || clean === league.name) return setName(league?.name ?? '');
    save(supabase.from('leagues').update({ name: clean }).eq('id', league.id));
  }

  function setPoints(key: 'points_win' | 'points_draw' | 'points_loss', value: number) {
    if (!league || value < 0 || value > 9) return;
    save(supabase.from('leagues').update({ [key]: value }).eq('id', league.id));
  }

  function toggleTeam(competitorId: string) {
    const there = teams.find((t) => t.competitorId === competitorId);
    if (!there) return save(supabase.from('league_teams').insert({ league_id: id, competitor_id: competitorId }));
    const used = days.reduce((n, d) => n + d.matches.filter((m) => m.home === there.id || m.away === there.id).length, 0);
    if (!used) return save(supabase.from('league_teams').delete().eq('id', there.id));
    Alert.alert(`Remove ${there.name}?`, `${there.name} plays in ${used} ${used === 1 ? 'match' : 'matches'} of this competition. Removing the team removes those matches too.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => save(supabase.from('league_teams').delete().eq('id', there.id)) },
    ]);
  }

  function openMatch(m: Match) {
    if (!day) return;
    setMatchDate(m.date ? new Date(`${m.date}T00:00:00`) : null);
    if (m.time) {
      const t = new Date();
      t.setHours(Number(m.time.slice(0, 2)), Number(m.time.slice(3, 5)), 0, 0);
      setMatchTime(t);
    } else setMatchTime(null);
    setPicker(null);
    setHomeGoals(m.homeGoals);
    setAwayGoals(m.awayGoals);
    setView({ matchday: day.id, match: m.id });
  }

  const hhmm = (d: Date | null) => (d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : null);

  async function saveMatch() {
    if (!day || !match) return;
    // A score is both numbers or none.
    const scored = homeGoals !== null || awayGoals !== null;
    await save(
      supabase
        .from('league_matches')
        .update({ match_date: matchDate ? toIso(matchDate) : null, kickoff: hhmm(matchTime), home_goals: scored ? (homeGoals ?? 0) : null, away_goals: scored ? (awayGoals ?? 0) : null })
        .eq('id', match.id),
    );
    setView({ matchday: day.id });
  }

  function removeMatch() {
    if (!day || !match) return;
    Alert.alert('Delete this match?', `${teamOf.get(match.home)?.name ?? '?'} – ${teamOf.get(match.away)?.name ?? '?'} is removed from matchday ${day.number}. Both teams are free again.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => (setView({ matchday: day.id }), save(supabase.from('league_matches').delete().eq('id', match.id))) },
    ]);
  }

  function addMatchday() {
    const next = days.reduce((n, d) => Math.max(n, d.number), 0) + 1;
    save(supabase.from('league_matchdays').insert({ league_id: id, number: next }));
  }

  function addMatch(home: string, away: string) {
    if (!day || home === away) return;
    setPicked(null);
    save(supabase.from('league_matches').insert({ matchday_id: day.id, home_team_id: home, away_team_id: away, position: day.matches.length }));
  }

  // Dropping a dragged team: the row under the finger becomes its opponent.
  const rows = useRef(new Map<string, View | null>());
  function dropTeam(teamId: string, pageY: number) {
    setDragging(false);
    setHeldTeam(null);
    if (pageY < 0) return;
    for (const other of free) {
      if (other.id === teamId) continue;
      rows.current.get(other.id)?.measureInWindow((_x, y, _w, h) => {
        if (pageY >= y && pageY <= y + h) addMatch(teamId, other.id);
      });
    }
  }

  function dropRanking(key: string, dy: number) {
    setDragging(false);
    if (!league) return;
    const from = league.ranking.indexOf(key);
    const to = Math.max(0, Math.min(league.ranking.length - 1, from + Math.round(dy / ROW)));
    if (to === from) return;
    const next = league.ranking.slice();
    next.splice(to, 0, next.splice(from, 1)[0]);
    setLeague({ ...league, ranking: next });
    save(supabase.from('leagues').update({ ranking: next }).eq('id', league.id));
  }

  function remove() {
    if (!league) return;
    Alert.alert(`Delete ${league.name}?`, 'The competition disappears with its teams, matchdays and matches. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error: failed } = await supabase.from('leagues').delete().eq('id', league.id);
          if (failed) setError(`Could not delete: ${failed.message}`);
          else goBack();
        },
      },
    ]);
  }

  const back = () => (view === 'main' ? goBack() : match && day ? setView({ matchday: day.id }) : (setView('main'), setPicked(null), setSearch('')));
  const title = view === 'teams' ? 'Teams' : view === 'ranking' ? 'Order of clubs' : match ? 'Match' : day ? `Matchday ${day.number}` : (league?.name ?? 'Competition');

  const crest = (t: Team | undefined, size = 34) => (
    <View style={[styles.ring, { borderColor: c.line }]}>
      <Crest url={t?.logoUrl ?? null} name={t?.name ?? '?'} size={size} />
    </View>
  );
  const stepper = (label: string, key: 'points_win' | 'points_draw' | 'points_loss', value: number, first = false) => (
    <View style={[styles.row, !first && line]}>
      <Text style={[styles.label, { color: c.ink }]}>{label}</Text>
      <Pressable style={[styles.step, { backgroundColor: c.surface2 }]} onPress={() => setPoints(key, value - 1)} accessibilityLabel={`Less ${label.toLowerCase()}`} hitSlop={6}>
        <Ionicons name="remove" size={18} color={c.ink} />
      </Pressable>
      <Text style={{ width: 26, textAlign: 'center', color: c.ink, fontFamily: fonts.semi, fontSize: 17 }}>{value}</Text>
      <Pressable style={[styles.step, { backgroundColor: c.surface2 }]} onPress={() => setPoints(key, value + 1)} accessibilityLabel={`More ${label.toLowerCase()}`} hitSlop={6}>
        <Ionicons name="add" size={18} color={c.ink} />
      </Pressable>
    </View>
  );

  let body: ReactNode;
  if (missing) body = <Text style={[styles.note, { color: c.inkSoft }]}>This competition is not part of the team you are working in.</Text>;
  else if (!league) body = <ActivityIndicator color={c.pitch} style={{ marginTop: 24 }} />;
  else if (view === 'teams') {
    const q = search.trim().toLowerCase();
    const own = teams.find((t) => t.own);
    body = (
      <>
        <Text style={[styles.note, { color: c.inkSoft }]}>Choose the clubs that play in {league.name}. They come from the shared list of opponents.</Text>
        <View style={[styles.search, { backgroundColor: c.surface }]}>
          <Ionicons name="search" size={18} color={c.inkSoft} />
          <TextInput style={{ flex: 1, color: c.ink, fontFamily: fonts.regular, fontSize: 16, paddingVertical: 0 }} value={search} onChangeText={setSearch} placeholder="Search opponents" placeholderTextColor={c.inkSoft} autoCorrect={false} clearButtonMode="while-editing" />
        </View>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          {own && !q ? (
            <View style={styles.row}>
              {crest(own)}
              <Text style={[styles.label, { color: c.ink, fontFamily: fonts.medium }]}>{own.name}</Text>
              <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>Your club</Text>
            </View>
          ) : null}
          {competitors
            .filter((o) => !q || o.name.toLowerCase().includes(q))
            .map((o, i) => {
              const inLeague = teams.some((t) => t.competitorId === o.id);
              return (
                <Pressable key={o.id} style={[styles.row, (i > 0 || (own && !q)) && line]} onPress={() => toggleTeam(o.id)} accessibilityRole="checkbox" accessibilityState={{ checked: inLeague }}>
                  <View style={[styles.ring, { borderColor: c.line }]}>
                    <Crest url={o.logoUrl} name={o.name} size={34} />
                  </View>
                  <Text style={[styles.label, { color: c.ink }]} numberOfLines={1}>
                    {o.name}
                  </Text>
                  <Ionicons name={inLeague ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={inLeague ? c.pitch : c.line} />
                </Pressable>
              );
            })}
        </View>
      </>
    );
  } else if (view === 'ranking') {
    body = (
      <>
        <Text style={[styles.note, { color: c.inkSoft }]}>Clubs are ranked by the first line. When two clubs are equal there, the next line decides. Drag a line by its handle to change the order.</Text>
        <View style={[styles.card, { backgroundColor: c.surface, paddingHorizontal: 0 }]}>
          {league.ranking.map((key, i) => (
            <DragRow key={key} background={c.surface} handleColor={c.inkSoft} onStart={() => setDragging(true)} onDrop={(dy) => dropRanking(key, dy)}>
              <View style={[styles.badge, { backgroundColor: c.surface2 }]}>
                <Text style={{ color: c.ink, fontFamily: fonts.semi, fontSize: 13 }}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, color: c.ink, fontFamily: fonts.regular, fontSize: 16 }}>{RANKING[key]}</Text>
            </DragRow>
          ))}
        </View>
        <Pressable style={[styles.button, { backgroundColor: c.surface }]} onPress={() => save(supabase.from('leagues').update({ ranking: DEFAULT_RANKING }).eq('id', league.id))}>
          <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 16 }}>Back to the usual order</Text>
        </Pressable>
      </>
    );
  } else if (day && match) {
    const ten = new Date();
    ten.setHours(10, 0, 0, 0);
    const home = teamOf.get(match.home);
    const away = teamOf.get(match.away);
    body = (
      <>
        <View style={[styles.card, styles.versus, { backgroundColor: c.surface }]}>
          <View style={styles.side}>
            {crest(home, 52)}
            <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 14, textAlign: 'center' }} numberOfLines={2}>
              {home?.name ?? '?'}
            </Text>
          </View>
          <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>Matchday {day.number}</Text>
          <View style={styles.side}>
            {crest(away, 52)}
            <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 14, textAlign: 'center' }} numberOfLines={2}>
              {away?.name ?? '?'}
            </Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <Pressable style={styles.row} onPress={() => (setPicker(picker === 'date' ? null : 'date'), !matchDate && setMatchDate(new Date()))}>
            <Text style={[styles.label, { color: c.ink }]}>Date</Text>
            <Text style={{ color: matchDate ? c.pitch : c.inkSoft, fontFamily: fonts.regular, fontSize: 16 }}>{matchDate ? fmtDate(toIso(matchDate)) : 'Not set'}</Text>
          </Pressable>
          {picker === 'date' ? (
            <View style={line}>
              <DateTimePicker mode="date" display="inline" value={matchDate ?? new Date()} accentColor={c.pitch} onChange={(_, d) => d && setMatchDate(d)} />
              <Pressable style={[styles.row, line]} onPress={() => (setMatchDate(null), setPicker(null))}>
                <Text style={[styles.label, { color: c.danger }]}>No date yet</Text>
              </Pressable>
            </View>
          ) : null}
          <Pressable style={[styles.row, line]} onPress={() => (setPicker(picker === 'time' ? null : 'time'), !matchTime && setMatchTime(ten))}>
            <Text style={[styles.label, { color: c.ink }]}>Kick-off</Text>
            <Text style={{ color: matchTime ? c.pitch : c.inkSoft, fontFamily: fonts.regular, fontSize: 16 }}>{hhmm(matchTime) ?? 'Not set'}</Text>
          </Pressable>
          {picker === 'time' ? (
            <View style={line}>
              <DateTimePicker mode="time" display="spinner" minuteInterval={5} value={matchTime ?? ten} onChange={(_, d) => d && setMatchTime(d)} />
              <Pressable style={[styles.row, line]} onPress={() => (setMatchTime(null), setPicker(null))}>
                <Text style={[styles.label, { color: c.danger }]}>No kick-off time yet</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <Text style={[styles.caption, { color: c.inkSoft }]}>Score</Text>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          {(
            [
              [home, homeGoals, setHomeGoals],
              [away, awayGoals, setAwayGoals],
            ] as [Team | undefined, number | null, (n: number | null) => void][]
          ).map(([team, goals, set], i) => (
            <View key={i} style={[styles.row, i > 0 && line]}>
              <Text style={[styles.label, { color: c.ink }]} numberOfLines={1}>
                {team?.name ?? '?'}
              </Text>
              <Pressable style={[styles.step, { backgroundColor: c.surface2 }]} onPress={() => set(Math.max(0, (goals ?? 0) - 1))} accessibilityLabel={`One goal less for ${team?.name}`} hitSlop={6}>
                <Ionicons name="remove" size={18} color={c.ink} />
              </Pressable>
              <Text style={{ width: 30, textAlign: 'center', color: goals === null ? c.inkSoft : c.ink, fontFamily: fonts.semi, fontSize: 18 }}>{goals ?? '–'}</Text>
              <Pressable style={[styles.step, { backgroundColor: c.surface2 }]} onPress={() => set(Math.min(99, (goals ?? -1) + 1))} accessibilityLabel={`One goal more for ${team?.name}`} hitSlop={6}>
                <Ionicons name="add" size={18} color={c.ink} />
              </Pressable>
            </View>
          ))}
          {homeGoals !== null || awayGoals !== null ? (
            <Pressable style={[styles.row, line]} onPress={() => (setHomeGoals(null), setAwayGoals(null))}>
              <Text style={[styles.label, { color: c.danger }]}>No score yet</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={[styles.note, { color: c.inkSoft }]}>The score counts for the standings on the Home screen.</Text>

        <Pressable style={[styles.button, { backgroundColor: c.pitch }]} onPress={saveMatch}>
          <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>Save</Text>
        </Pressable>
        <Pressable style={[styles.button, { backgroundColor: c.surface }]} onPress={removeMatch}>
          <Text style={{ color: c.danger, fontFamily: fonts.medium, fontSize: 16 }}>Delete match</Text>
        </Pressable>
      </>
    );
  } else if (day) {
    body = (
      <>
        <Text style={[styles.caption, { color: c.inkSoft }]}>Matches</Text>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          {day.matches.length === 0 ? (
            <View style={styles.row}>
              <Text style={[styles.label, { color: c.inkSoft }]}>No matches yet.</Text>
            </View>
          ) : null}
          {day.matches.map((m, i) => (
            <Pressable key={m.id} style={[styles.row, { minHeight: 62 }, i > 0 && line]} onPress={() => openMatch(m)}>
              {crest(teamOf.get(m.home), 30)}
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 15 }} numberOfLines={1}>
                  {teamOf.get(m.home)?.name ?? '?'} <Text style={{ color: c.inkSoft, fontFamily: fonts.regular }}>–</Text> {teamOf.get(m.away)?.name ?? '?'}
                </Text>
                <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>
                  {m.date || m.time ? [m.date ? fmtDate(m.date) : null, m.time].filter(Boolean).join(' · ') : 'No date yet'}
                </Text>
              </View>
              {m.homeGoals !== null && m.awayGoals !== null ? (
                <Text style={{ color: c.ink, fontFamily: fonts.semi, fontSize: 16 }}>
                  {m.homeGoals} - {m.awayGoals}
                </Text>
              ) : null}
              {crest(teamOf.get(m.away), 30)}
              <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
            </Pressable>
          ))}
        </View>

        <Text style={[styles.caption, { color: c.inkSoft }]}>Teams without a match</Text>
        {free.length === 0 ? (
          <Text style={[styles.note, { color: c.inkSoft }]}>{teams.length < 2 ? 'Add teams to the competition first.' : 'Every team has a match on this matchday.'}</Text>
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: c.surface, paddingHorizontal: 0 }]}>
              {free.map((t) => (
                <View key={t.id} ref={(node) => void rows.current.set(t.id, node)} collapsable={false} style={heldTeam === t.id ? { zIndex: 5 } : undefined}>
                  <DragRow background={picked === t.id ? c.surface2 : c.surface} handleColor={c.inkSoft} onStart={() => (setDragging(true), setHeldTeam(t.id))} onDrop={(_dy, pageY) => dropTeam(t.id, pageY)}>
                    <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }} onPress={() => (picked && picked !== t.id ? addMatch(picked, t.id) : setPicked(picked === t.id ? null : t.id))}>
                      {crest(t)}
                      <Text style={{ flex: 1, color: c.ink, fontFamily: fonts.regular, fontSize: 16 }} numberOfLines={1}>
                        {t.name}
                      </Text>
                      {picked === t.id ? <Text style={{ color: c.pitch, fontFamily: fonts.medium, fontSize: 13 }}>Home</Text> : null}
                    </Pressable>
                  </DragRow>
                </View>
              ))}
            </View>
            <Text style={[styles.note, { color: c.inkSoft }]}>
              Drag a team by its handle onto its opponent to make a match; the team you drag plays at home. Or tap the home team, then the away team.
            </Text>
          </>
        )}
        <Pressable
          style={[styles.button, { backgroundColor: c.surface }]}
          onPress={() =>
            Alert.alert(`Delete matchday ${day.number}?`, 'Its matches are deleted too.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => (setView('main'), save(supabase.from('league_matchdays').delete().eq('id', day.id))) },
            ])
          }
        >
          <Text style={{ color: c.danger, fontFamily: fonts.medium, fontSize: 16 }}>Delete matchday</Text>
        </Pressable>
      </>
    );
  } else {
    body = (
      <>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <View style={styles.row}>
            <Text style={[styles.label, { color: c.ink }]}>Name</Text>
            <TextInput style={[styles.input, { color: c.ink }]} value={name} onChangeText={setName} onBlur={renameLeague} onSubmitEditing={renameLeague} returnKeyType="done" autoCorrect={false} />
          </View>
          <View style={[styles.row, line]}>
            <Text style={[styles.label, { color: c.ink }]}>Age group</Text>
            <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 16 }}>{group ? `${group.name} · ${group.clubName}` : '–'}</Text>
          </View>
          <Pressable style={[styles.row, line]} onPress={() => setView('teams')}>
            <Text style={[styles.label, { color: c.ink }]}>Teams</Text>
            <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 16 }}>{teams.length}</Text>
            <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
          </Pressable>
        </View>

        <Text style={[styles.caption, { color: c.inkSoft }]}>Matchdays</Text>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          {days.map((d, i) => (
            <Pressable key={d.id} style={[styles.row, i > 0 && line]} onPress={() => setView({ matchday: d.id })}>
              <Text style={[styles.label, { color: c.ink }]}>Matchday {d.number}</Text>
              <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 14 }}>
                {d.matches.length} {d.matches.length === 1 ? 'match' : 'matches'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
            </Pressable>
          ))}
          <Pressable style={[styles.row, days.length > 0 && line]} onPress={addMatchday}>
            <Ionicons name="add" size={20} color={c.pitch} />
            <Text style={[styles.label, { color: c.pitch }]}>Add matchday</Text>
          </Pressable>
        </View>

        <Text style={[styles.caption, { color: c.inkSoft }]}>Rules</Text>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          {stepper('Points per win', 'points_win', league.win, true)}
          {stepper('Points per draw', 'points_draw', league.draw)}
          {stepper('Points per loss', 'points_loss', league.loss)}
          <Pressable style={[styles.row, line]} onPress={() => setView('ranking')}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontFamily: fonts.regular, fontSize: 16 }}>Order of clubs</Text>
              <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }} numberOfLines={1}>
                {league.ranking.map((k) => RANKING[k]).join(', ')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
          </Pressable>
        </View>

        <Pressable style={[styles.button, { backgroundColor: c.surface }]} onPress={remove}>
          <Text style={{ color: c.danger, fontFamily: fonts.medium, fontSize: 16 }}>Delete competition</Text>
        </Pressable>
      </>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: c.chalk }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={back} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" scrollEnabled={!dragging}>
        {error ? <Text style={[styles.note, { color: c.danger }]}>{error}</Text> : null}
        {body}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 17 },
  content: { padding: 16, gap: 10, paddingBottom: 60 },
  caption: { fontFamily: fonts.regular, fontSize: 13, marginLeft: 12, marginTop: 8 },
  note: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, marginHorizontal: 12 },
  card: { borderRadius: 14, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingVertical: 9 },
  label: { flex: 1, fontFamily: fonts.regular, fontSize: 16 },
  input: { flex: 2, textAlign: 'right', fontFamily: fonts.regular, fontSize: 16, paddingVertical: 0 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, height: 44 },
  ring: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999 },
  versus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  side: { width: 110, alignItems: 'center', gap: 8 },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  step: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  button: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, marginTop: 6 },
  dragRow: { height: ROW, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, borderRadius: 14 },
  handle: { width: 56, height: ROW, alignItems: 'center', justifyContent: 'center' },
  held: { zIndex: 5, shadowColor: '#0E1320', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
});
