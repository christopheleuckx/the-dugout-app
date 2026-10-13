import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Animated, KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Crest } from '../components/MatchCard';
import { useData } from '../lib/data';
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
type Match = { id: string; home: string; away: string };
type Matchday = { id: string; number: number; matches: Match[] };
type League = { id: string; name: string; win: number; draw: number; loss: number; ranking: string[] };
type View_ = 'main' | 'teams' | 'ranking' | { matchday: string };

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

  const load = useCallback(async () => {
    const [l, t, d] = await Promise.all([
      supabase.from('leagues').select('id, name, points_win, points_draw, points_loss, ranking').eq('id', id).maybeSingle(),
      supabase.from('league_teams').select('id, competitor_id, is_own_team').eq('league_id', id),
      supabase.from('league_matchdays').select('id, number, league_matches(id, home_team_id, away_team_id, position)').eq('league_id', id).order('number'),
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
          .map((m) => ({ id: m.id, home: m.home_team_id, away: m.away_team_id })),
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

  const back = () => (view === 'main' ? goBack() : (setView('main'), setPicked(null), setSearch('')));
  const title = view === 'teams' ? 'Teams' : view === 'ranking' ? 'Order of clubs' : day ? `Matchday ${day.number}` : (league?.name ?? 'Competition');

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
            <View key={m.id} style={[styles.row, { minHeight: 58 }, i > 0 && line]}>
              {crest(teamOf.get(m.home), 30)}
              <Text style={{ flex: 1, color: c.ink, fontFamily: fonts.medium, fontSize: 15 }} numberOfLines={1}>
                {teamOf.get(m.home)?.name ?? '?'} <Text style={{ color: c.inkSoft, fontFamily: fonts.regular }}>–</Text> {teamOf.get(m.away)?.name ?? '?'}
              </Text>
              {crest(teamOf.get(m.away), 30)}
              <Pressable onPress={() => save(supabase.from('league_matches').delete().eq('id', m.id))} accessibilityLabel="Remove this match" hitSlop={8}>
                <Ionicons name="close-circle" size={22} color={c.inkSoft} />
              </Pressable>
            </View>
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
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  step: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  button: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, marginTop: 6 },
  dragRow: { height: ROW, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, borderRadius: 14 },
  handle: { width: 56, height: ROW, alignItems: 'center', justifyContent: 'center' },
  held: { zIndex: 5, shadowColor: '#0E1320', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
});
