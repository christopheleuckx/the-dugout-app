import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FIELD_POSITIONS, onPitch, Pitch } from '../components/Pitch';
import { useData, type Player, type Team } from '../lib/data';
import { generateLineups } from '../lib/lineup';
import { groupOf } from '../lib/selection';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';

type Moment = 'starting' | 'after10';
// Who stands where (player id -> field position); everyone else is on the bench.
type Spots = Record<string, string>;
// `after` stays null while the line-up after 10 minutes is the same as at the start.
type Quarter = { start: Spots; after: Spots | null };
type Sheet = null | { position: string } | { player: string };

const BENCH_SLOTS = ['S1', 'S2', 'S3', 'S4', 'S5'];
// The field positions per line, back to front, as in selection.ts.
const LINE_SPOTS = [['K'], ['3', '4'], ['6', '10'], ['7', '11'], ['9']];

function shuffle<T>(list: T[]) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Everyone on their best position (in the order given, so a shuffled squad
// gives a different line-up each time), then the open spots filled with whoever
// is left (keepers last, so a second keeper isn't put up front).
function autoFill(players: Player[]): Spots {
  const spots: Spots = {};
  const taken = new Set<string>();
  LINE_SPOTS.forEach((positions, line) => {
    const inLine = players.filter((p) => groupOf(p.bestPosition) === line);
    for (const p of inLine) if (positions.includes(p.bestPosition) && !taken.has(p.bestPosition)) { spots[p.id] = p.bestPosition; taken.add(p.bestPosition); }
    for (const p of inLine) {
      const free = positions.find((x) => !taken.has(x));
      if (!spots[p.id] && free) { spots[p.id] = free; taken.add(free); }
    }
  });
  const rest = players.filter((p) => !spots[p.id]).sort((a, b) => Number(groupOf(a.bestPosition) === 0) - Number(groupOf(b.bestPosition) === 0));
  for (const position of FIELD_POSITIONS) {
    if (taken.has(position)) continue;
    const p = rest.shift();
    if (!p) break;
    spots[p.id] = position;
    taken.add(position);
  }
  return spots;
}

// Build a team's line-ups: tap a position to place a player, quarter by
// quarter. Nothing is written until "Save line-ups".
export default function GameLineupEditScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ game: string; team: Team }>();
  const { games, refresh } = useData();
  const game = games.find((g) => g.id === params.game);
  const team = params.team;
  const squad = (game?.teams.find((t) => t.team === team)?.players ?? [])
    .slice()
    .sort((a, b) => groupOf(a.bestPosition) - groupOf(b.bestPosition) || a.firstName.localeCompare(b.firstName));
  const count = game?.matches ?? 4;

  const [quarters, setQuarters] = useState<Quarter[]>(() =>
    Array.from({ length: count }, (_, i) => {
      const saved = game?.lineups[team]?.find((q) => q.index === i)?.players ?? [];
      const field = (key: 'starting' | 'after10') => Object.fromEntries(saved.filter((p) => onPitch(p[key])).map((p) => [p.id, p[key]]));
      return { start: field('starting'), after: saved.some((p) => p.after10 !== p.starting) ? field('after10') : null };
    }),
  );
  const [page, setPage] = useState(0);
  const [moment, setMoment] = useState<Moment>('starting');
  const [sheet, setSheet] = useState<Sheet>(null);
  // The "Generate line-up" page and its settings, with the web app's defaults.
  const [generating, setGenerating] = useState(false);
  const [bestOnly, setBestOnly] = useState(true);
  const [equalTime, setEqualTime] = useState(true);
  const [equalStarting, setEqualStarting] = useState(true);
  const [subs, setSubs] = useState<boolean[]>(() => game?.subsAllowed ?? []);
  const [extra, setExtra] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pager = useRef<ScrollView>(null);

  if (!game) {
    return (
      <View style={[styles.page, { backgroundColor: c.chalk, paddingTop: insets.top + 60, alignItems: 'center' }]}>
        <Text style={{ color: c.inkSoft, fontFamily: fonts.regular }}>This game no longer exists.</Text>
      </View>
    );
  }

  const short = (p: Player) => `${p.firstName}${p.lastName.trim() ? ` ${p.lastName.trim()[0]}.` : ''}`;
  const label = (i: number) => game.quarters[team]?.[i]?.label ?? `Q${i + 1}`;
  const color = team === 'red' ? c.teamRed : c.teamBlue;
  const afterOf = (q: Quarter) => q.after ?? q.start;
  const spotsOf = (q: Quarter) => (moment === 'starting' ? q.start : afterOf(q));
  const current = quarters[page];

  const update = (i: number, spots: Spots, at: Moment = moment) =>
    setQuarters(quarters.map((q, n) => (n !== i ? q : at === 'starting' ? { ...q, start: spots } : { ...q, after: spots })));
  const goTo = (i: number) => {
    setPage(i);
    pager.current?.scrollTo({ x: i * width, animated: true });
  };

  // Put a player on a position; whoever stood there takes the player's old spot (or the bench).
  function place(playerId: string, position: string) {
    const spots = { ...spotsOf(current) };
    const occupant = Object.keys(spots).find((id) => spots[id] === position);
    const old = spots[playerId];
    delete spots[playerId];
    if (occupant && occupant !== playerId) {
      if (old) spots[occupant] = old;
      else delete spots[occupant];
    }
    spots[playerId] = position;
    update(page, spots);
    setSheet(null);
  }
  function toBench(playerId: string) {
    const spots = { ...spotsOf(current) };
    delete spots[playerId];
    update(page, spots);
    setSheet(null);
  }

  // Periods on the pitch per player: two per quarter (start, after 10').
  const periods = (id: string) => quarters.reduce((n, q) => n + (q.start[id] ? 1 : 0) + (afterOf(q)[id] ? 1 : 0), 0);

  async function save() {
    if (saving) return;
    setSaving(true);
    setError('');
    // Bench players get the web app's bench slots S1..S5, in line order.
    const entries = (q: Quarter) => {
      if (!Object.keys(q.start).length) return {};
      const slot = (spots: Spots, id: string) => spots[id] ?? BENCH_SLOTS[squad.filter((p) => !spots[p.id]).findIndex((p) => p.id === id)] ?? '';
      return Object.fromEntries(squad.map((p) => [p.id, { starting: slot(q.start, p.id), after10: slot(afterOf(q), p.id) }]));
    };
    // Start from the team's line-up as it is in the database right now, so
    // scores, reports and the place entered meanwhile are kept.
    const fresh = await supabase.from('games').select('lineups').eq('id', game!.id).single();
    const existing = fresh.data?.lineups?.[team] ?? {};
    const value = {
      ...existing,
      quarters: quarters.map(entries),
      confirmed: Array.from({ length: count }, (_, i) => existing.confirmed?.[i] ?? false),
    };
    const saved = fresh.error ? fresh : await supabase.rpc('patch_game_team_lineup', { p_game_id: game!.id, p_team: team, p_value: value });
    // Keep the per-quarter substitution setting the generator used, as the web app does.
    if (!saved.error && subs.some((v, i) => v !== game!.subsAllowed[i])) {
      const evalRow = await supabase.from('games').select('team_eval').eq('id', game!.id).single();
      if (!evalRow.error) await supabase.from('games').update({ team_eval: { ...(evalRow.data.team_eval ?? {}), subsAllowed: subs } }).eq('id', game!.id);
    }
    if (saved.error) {
      setError(`Could not save the line-ups: ${saved.error.message}`);
      setSaving(false);
      return;
    }
    await refresh();
    router.back();
  }

  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };
  // A settings row whose whole width toggles the switch.
  const toggleRow = (key: string, text: string, value: boolean, set: (v: boolean) => void, first = false, disabled = false) => (
    <Pressable
      key={key}
      style={[styles.setting, !first && line]}
      onPress={() => set(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
    >
      <Text style={{ flex: 1, color: disabled ? c.inkSoft : c.ink, fontFamily: fonts.regular, fontSize: 16 }} numberOfLines={1}>
        {text}
      </Text>
      <Switch value={value} onValueChange={set} disabled={disabled} trackColor={{ true: c.pitch }} />
    </Pressable>
  );

  function generate() {
    const made = generateLineups(squad, count, game!.quarterLength, {
      bestPositionOnly: bestOnly,
      equalTime,
      equalStarting,
      subsAllowed: subs,
      // Extra playing time only applies when the time isn't shared equally.
      highMinuteIds: equalTime ? [] : extra,
    });
    const same = (a: Spots, b: Spots) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((id) => a[id] === b[id]);
    setQuarters(made.map((q) => ({ start: q.start, after: same(q.start, q.after) ? null : q.after })));
    setGenerating(false);
    setMoment('starting');
    goTo(0);
  }
  const sheetSpots = spotsOf(current);
  // Players for a tapped position: those whose best position matches come first.
  const candidates =
    sheet && 'position' in sheet
      ? squad.slice().sort((a, b) => Number(b.bestPosition === sheet.position) - Number(a.bestPosition === sheet.position))
      : [];

  return (
    <View style={[styles.page, { backgroundColor: c.chalk }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable
          style={[styles.round, { backgroundColor: c.surface }]}
          onPress={() => (generating ? setGenerating(false) : router.back())}
          accessibilityLabel={generating ? 'Back' : 'Close'}
          hitSlop={8}
        >
          <Ionicons name={generating ? 'chevron-back' : 'close'} size={20} color={c.ink} />
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>
          {generating ? 'Generate game line-ups' : `Line-up ${label(page)}`}
        </Text>
        {generating || !squad.length ? (
          <View style={{ width: 36 }} />
        ) : (
          <Pressable
            style={[styles.round, { backgroundColor: c.pitch }]}
            onPress={() => setGenerating(true)}
            accessibilityLabel="Generate game line-ups"
            hitSlop={8}
          >
            <Ionicons name="sparkles" size={18} color={c.onPitch} />
          </Pressable>
        )}
      </View>

      {generating ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.card, { backgroundColor: c.surface, paddingVertical: 2 }]}>
            {toggleRow('best', 'Always best position', bestOnly, setBestOnly, true)}
            {toggleRow('time', 'Equal time per game', equalTime, setEqualTime)}
            {toggleRow('start', 'Equal starting time', equalStarting, setEqualStarting)}
          </View>

          <Text style={[styles.group, { color: c.inkSoft }]}>Substitution</Text>
          <View style={[styles.card, { backgroundColor: c.surface, paddingVertical: 2 }]}>
            {Array.from({ length: count }, (_, i) =>
              toggleRow(`q${i}`, label(i), subs[i] ?? true, (v) => setSubs(Array.from({ length: count }, (_, n) => (n === i ? v : (subs[n] ?? true)))), i === 0),
            )}
          </View>
          <Text style={[styles.hint, { color: c.inkSoft }]}>On: players may change after 10 minutes in that quarter.</Text>

          <Text style={[styles.group, { color: c.inkSoft }]}>Extra playing time</Text>
          <View style={[styles.card, { backgroundColor: c.surface, paddingVertical: 2 }]}>
            {squad.map((p, n) =>
              toggleRow(p.id, `${p.firstName} ${p.lastName}`.trim(), !equalTime && extra.includes(p.id), (v) => setExtra(v ? [...extra, p.id] : extra.filter((id) => id !== p.id)), n === 0, equalTime),
            )}
          </View>
          <Text style={[styles.hint, { color: c.inkSoft }]}>
            {equalTime
              ? 'Switch off "Equal time per game" to give specific players extra playing time.'
              : 'On: the player gets at least 75% of the playing time.'}
          </Text>

          <Pressable style={[styles.button, { backgroundColor: c.pitch }]} onPress={generate}>
            <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>Generate game line-ups</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <>
      {/* Quarter bar: tap to jump; a dot marks quarters that have a line-up. */}
      <View style={styles.quarterBar}>
        {quarters.map((q, i) => (
          <Pressable key={i} style={[styles.quarterChip, { backgroundColor: i === page ? c.pitch : c.surface }]} onPress={() => goTo(i)}>
            <Text style={{ color: i === page ? c.onPitch : c.ink, fontFamily: fonts.medium, fontSize: 13 }} numberOfLines={1}>
              {label(i)}
            </Text>
            {Object.keys(q.start).length ? <View style={[styles.filled, { backgroundColor: i === page ? c.onPitch : c.win }]} /> : null}
          </Pressable>
        ))}
      </View>

      <View style={[styles.toggle, { backgroundColor: c.surface2 }]}>
        {(['starting', 'after10'] as Moment[]).map((m) => (
          <Pressable key={m} style={[styles.toggleOption, m === moment && { backgroundColor: c.surface }]} onPress={() => setMoment(m)}>
            <Text style={{ color: m === moment ? c.ink : c.inkSoft, fontFamily: fonts.medium, fontSize: 14 }}>
              {m === 'starting' ? 'Start' : "After 10'"}
            </Text>
          </Pressable>
        ))}
      </View>

      {squad.length === 0 ? (
        <Text style={[styles.hint, { color: c.inkSoft, textAlign: 'center', marginTop: 40 }]}>
          Create the selection first; a line-up is built from the selected players.
        </Text>
      ) : (
        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={(e) => setPage(Math.max(0, Math.min(count - 1, Math.round(e.nativeEvent.contentOffset.x / width))))}
        >
          {quarters.map((q, i) => {
            const spots = spotsOf(q);
            const bench = squad.filter((p) => !spots[p.id]);
            return (
              <ScrollView key={i} style={{ width }} contentContainerStyle={styles.content}>
                <View style={styles.pitch}>
                  <Pitch
                    color={color}
                    slots={Object.fromEntries(squad.filter((p) => spots[p.id]).map((p) => [spots[p.id], short(p)]))}
                    onPressSpot={(position) => setSheet({ position })}
                  />
                </View>

                {moment === 'starting' ? (
                  <Pressable style={[styles.action, { backgroundColor: c.surface }]} onPress={() => update(i, autoFill(shuffle(squad)), 'starting')}>
                    <Ionicons name="shuffle" size={18} color={c.pitch} />
                    <Text style={[styles.actionText, { color: c.pitch }]}>Random line-up</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={[styles.action, { backgroundColor: c.surface }]}
                    onPress={() => setQuarters(quarters.map((x, n) => (n === i ? { ...x, after: null } : x)))}
                  >
                    <Ionicons name="copy-outline" size={16} color={c.pitch} />
                    <Text style={[styles.actionText, { color: c.pitch }]}>Copy start line-up</Text>
                  </Pressable>
                )}

                <Text style={[styles.section, { color: c.ink }]}>Bench</Text>
                <View style={[styles.card, styles.chips, { backgroundColor: c.surface }]}>
                  {bench.length === 0 ? <Text style={[styles.hint, { color: c.inkSoft, margin: 0 }]}>No one on the bench.</Text> : null}
                  {bench.map((p) => (
                    <Pressable key={p.id} style={[styles.chip, { backgroundColor: c.surface2 }]} onPress={() => setSheet({ player: p.id })}>
                      <Text style={{ color: c.inkSoft, fontFamily: fonts.semi, fontSize: 12 }}>{p.bestPosition || '–'}</Text>
                      <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 14 }}>{short(p)}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.section, { color: c.ink }]}>Playing time</Text>
                <View style={[styles.card, { backgroundColor: c.surface, paddingVertical: 6 }]}>
                  {squad.map((p, n) => (
                    <View key={p.id} style={[styles.timeRow, n > 0 && line]}>
                      <Text style={{ flex: 1, color: c.ink, fontFamily: fonts.regular, fontSize: 15 }} numberOfLines={1}>
                        {short(p)}
                      </Text>
                      <View style={[styles.track, { backgroundColor: c.surface2 }]}>
                        <View style={{ width: `${(periods(p.id) / (count * 2)) * 100}%`, height: '100%', borderRadius: 3, backgroundColor: color }} />
                      </View>
                      <Text style={{ width: 34, textAlign: 'right', color: c.inkSoft, fontFamily: fonts.medium, fontSize: 13 }}>
                        {periods(p.id)}/{count * 2}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text style={[styles.hint, { color: c.inkSoft }]}>Periods on the pitch: two per quarter, the start and after 10 minutes.</Text>

                {i < count - 1 ? (
                  <Pressable
                    style={[styles.button, { backgroundColor: c.surface }]}
                    onPress={() => {
                      // An empty next quarter starts from who is on the pitch at the end of this one.
                      const next = quarters[i + 1];
                      if (!Object.keys(next.start).length) {
                        setQuarters(quarters.map((x, n) => (n === i + 1 ? { start: { ...afterOf(q) }, after: null } : x)));
                      }
                      setMoment('starting');
                      goTo(i + 1);
                    }}
                  >
                    <Text style={{ color: c.pitch, fontFamily: fonts.medium, fontSize: 16 }}>Continue to {label(i + 1)}</Text>
                  </Pressable>
                ) : null}
                {error ? <Text style={[styles.hint, { color: c.danger }]}>{error}</Text> : null}
                <Pressable style={[styles.button, { backgroundColor: c.pitch }]} onPress={save}>
                  {saving ? <ActivityIndicator color={c.onPitch} /> : <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>Save line-ups</Text>}
                </Pressable>
              </ScrollView>
            );
          })}
        </ScrollView>
      )}
        </>
      )}

      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={{ flex: 1 }} onPress={() => setSheet(null)} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 12 }]}>
          <View style={[styles.grabber, { backgroundColor: c.line }]} />
          {sheet && 'position' in sheet ? (
            <>
              <Text style={[styles.sheetTitle, { color: c.ink }]}>Position {sheet.position}</Text>
              <ScrollView style={{ maxHeight: 420 }}>
                {candidates.map((p, n) => {
                  const here = sheetSpots[p.id] === sheet.position;
                  return (
                    <Pressable key={p.id} style={[styles.option, n > 0 && line]} onPress={() => (here ? toBench(p.id) : place(p.id, sheet.position))}>
                      <View style={[styles.badge, { backgroundColor: c.surface2 }]}>
                        <Text style={{ color: c.ink, fontFamily: fonts.semi, fontSize: 12 }}>{p.bestPosition || '–'}</Text>
                      </View>
                      <Text style={{ flex: 1, color: c.ink, fontFamily: fonts.regular, fontSize: 16 }}>{short(p)}</Text>
                      <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>
                        {here ? 'Tap to bench' : sheetSpots[p.id] ? `Now on ${sheetSpots[p.id]}` : 'Bench'}
                      </Text>
                      {here ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          ) : sheet ? (
            <>
              <Text style={[styles.sheetTitle, { color: c.ink }]}>
                Place {short(squad.find((p) => p.id === sheet.player)!)}
              </Text>
              {FIELD_POSITIONS.map((position, n) => {
                const occupant = squad.find((p) => sheetSpots[p.id] === position);
                return (
                  <Pressable key={position} style={[styles.option, n > 0 && line]} onPress={() => place(sheet.player, position)}>
                    <View style={[styles.badge, { backgroundColor: c.surface2 }]}>
                      <Text style={{ color: c.ink, fontFamily: fonts.semi, fontSize: 12 }}>{position}</Text>
                    </View>
                    <Text style={{ flex: 1, color: occupant ? c.ink : c.inkSoft, fontFamily: fonts.regular, fontSize: 16 }}>
                      {occupant ? short(occupant) : 'Empty'}
                    </Text>
                    {occupant ? <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>Goes to the bench</Text> : null}
                  </Pressable>
                );
              })}
            </>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 17 },
  // Centred; wraps to a second row when a tournament has long names.
  quarterBar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 18 },
  quarterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, borderRadius: 17, paddingHorizontal: 14, maxWidth: 170 },
  filled: { width: 6, height: 6, borderRadius: 3 },
  toggle: { flexDirection: 'row', alignSelf: 'center', borderRadius: 10, padding: 3 },
  toggleOption: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 18 },
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  pitch: { borderRadius: 12, overflow: 'hidden' },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 11 },
  actionText: { fontFamily: fonts.medium, fontSize: 15 },
  section: { fontFamily: fonts.medium, fontSize: 19, marginTop: 12 },
  card: { borderRadius: 12, padding: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  track: { width: 90, height: 6, borderRadius: 3, overflow: 'hidden' },
  hint: { fontFamily: fonts.regular, fontSize: 13, marginHorizontal: 12 },
  group: { fontFamily: fonts.medium, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase', marginLeft: 12, marginTop: 8 },
  setting: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingVertical: 8 },
  button: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, marginTop: 4 },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    shadowColor: '#0E1320',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 8 },
  sheetTitle: { fontFamily: fonts.medium, fontSize: 17, marginBottom: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
