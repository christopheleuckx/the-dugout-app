import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fmtDate, toIso, useData } from '../lib/data';
import { FORMATS } from '../lib/formats';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';
import { goBack } from '../lib/nav';
import { showUndo } from '../lib/undo';

// The web app's choices, plus Cup: a cup game is played like any other game.
const VENUES = ['Home', 'Away'];
const COMPETITIONS = ['Friendly', 'Tournament', 'Competition', 'Cup'];
const LEVELS = ['Elite', 'IP3', 'Other'];
const TEAMS = [
  { value: 1, label: '1 team' },
  { value: 2, label: 'Blue and Red' },
];

type Page = null | 'opponent' | 'date' | 'time' | 'venue' | 'competition' | 'level' | 'teams' | 'format' | 'quarters';

// New game, or the details of an existing one when opened with its id: a
// settings-style form. Each row opens a page to choose its value; Save writes
// the game to the shared database, for the web app and every coach.
export default function NewGameScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { competitors, me, refresh } = useData();

  const [page, setPage] = useState<Page>(null);
  const [opponent, setOpponent] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<Date | null>(null);
  const [venue, setVenue] = useState('Home');
  const [competition, setCompetition] = useState('Competition');
  const [level, setLevel] = useState('IP3');
  // An age group with a single team has no Blue and Red to choose from.
  const oneTeam = (me?.activeAgeGroup?.teams.length ?? 2) < 2;
  const [teams, setTeams] = useState(oneTeam ? 1 : 2);
  // A new game starts with the age group's usual format.
  const [format, setFormat] = useState<string>(me?.activeAgeGroup?.format ?? '8v8');
  const [quarters, setQuarters] = useState(4);
  const [minutes, setMinutes] = useState(20);
  // Custom names per quarter; an empty one falls back to Q1, Q2…
  const [names, setNames] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Editing starts from the game as it is stored; the scores already filled in
  // are kept to carry them over when the number of quarters changes.
  const [loaded, setLoaded] = useState(!id);
  const [scores, setScores] = useState<unknown[]>([]);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('games')
      .select('date, time, opponent, type, competition, home_away, location, remarks, quarters, quarter_length, num_teams, quarter_scores, quarter_labels, format')
      .eq('id', id)
      .single()
      .then(({ data: g, error: failed }) => {
        if (failed || !g) {
          setError('Could not load the game.');
          return;
        }
        setOpponent(g.opponent ?? '');
        setDate(g.date ? new Date(`${g.date}T00:00:00`) : null);
        if (g.time) {
          const t = new Date();
          t.setHours(Number(g.time.slice(0, 2)), Number(g.time.slice(3, 5)), 0, 0);
          setTime(t);
        }
        setVenue(g.home_away ?? 'Home');
        setCompetition(g.competition ?? 'Competition');
        setLevel(g.type ?? 'IP3');
        setTeams(g.num_teams === 1 ? 1 : 2);
        if (g.format) setFormat(g.format);
        setQuarters(g.quarters ?? 4);
        setMinutes(g.quarter_length ?? 20);
        setNames(Array.isArray(g.quarter_labels) ? g.quarter_labels : []);
        setLocation(g.location ?? '');
        setRemarks(g.remarks ?? '');
        setScores(Array.isArray(g.quarter_scores) ? g.quarter_scores : []);
        setLoaded(true);
      });
  }, [id]);

  const tournament = competition === 'Tournament';
  const hhmm = time ? `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}` : null;

  async function save() {
    if (saving) return;
    if (!opponent.trim() || !date) {
      setError(`Fill in the ${tournament ? 'host club' : 'opponent'} and the date first.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      // Link a known club (for its logo), or add the new name to the club list like the web app does.
      const name = opponent.trim();
      let competitorId = competitors.find((x) => x.name.toLowerCase() === name.toLowerCase())?.id ?? null;
      if (!competitorId) {
        const created = await supabase.from('competitors').insert({ name }).select('id').single();
        if (created.error) throw created.error;
        competitorId = created.data.id;
      }
      const details = {
        date: toIso(date),
        time: hhmm,
        opponent: name,
        competitor_id: competitorId,
        type: level,
        competition,
        home_away: venue,
        quarters,
        quarter_length: minutes,
        num_teams: oneTeam ? 1 : teams,
        format,
        location: location.trim(),
        remarks,
        quarter_scores: Array.from({ length: quarters }, (_, i) => scores[i] ?? { for: null, against: null }),
        quarter_labels: Array.from({ length: quarters }, (_, i) => names[i]?.trim() ?? ''),
      };
      const { error: failed } = id
        ? await supabase.from('games').update(details).eq('id', id)
        : await supabase
            .from('games')
            .insert({ ...details, team_eval: { score: null, opponent: '', quarterNotes: [], wentWell: '', toImprove: '' } });
      if (failed) throw failed;
      await refresh();
      goBack();
    } catch (e) {
      setError(`Could not save the game: ${e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'unknown error'}`);
      setSaving(false);
    }
  }

  // Removing deletes the game at once, with everything attached to it
  // (selection, coaches, goals, ratings, videos). A copy is kept for the few
  // seconds the undo message is on screen, to put it all back.
  async function remove() {
    if (saving || !id) return;
    setSaving(true);
    setError('');
    try {
      const attached = ['game_squad', 'game_coaches', 'goals', 'player_ratings', 'videos'];
      const [game, ...rows] = await Promise.all([
        supabase.from('games').select('*').eq('id', id).single(),
        ...attached.map((table) => supabase.from(table).select('*').eq('game_id', id)),
      ]);
      const unread = [game, ...rows].find((r) => r.error);
      if (unread?.error) throw unread.error;
      const gone = await supabase.from('games').delete().eq('id', id);
      if (gone.error) throw gone.error;
      await refresh();
      router.dismissTo('/games');
      showUndo('Game removed', async () => {
        const back = await supabase.from('games').insert(game.data);
        if (!back.error) {
          for (let i = 0; i < attached.length; i++) {
            const list = rows[i].data ?? [];
            if (list.length) await supabase.from(attached[i]).insert(list);
          }
        }
        await refresh();
      });
    } catch (e) {
      setError(`Could not remove the game: ${e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'unknown error'}`);
      setSaving(false);
    }
  }

  const row = (label: string, value: string, target: Page, first = false) => (
    <Pressable style={[styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]} onPress={() => setPage(target)}>
      <Text style={[styles.label, { color: c.ink }]}>{label}</Text>
      <Text style={[styles.value, { color: c.inkSoft }]} numberOfLines={1}>
        {value}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
    </Pressable>
  );

  // A page listing options, the chosen one ticked; choosing goes back.
  const options = <T extends string | number>(items: { value: T; label: string }[], current: T, choose: (v: T) => void) => (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      {items.map((item, i) => (
        <Pressable
          key={String(item.value)}
          style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}
          onPress={() => {
            choose(item.value);
            setPage(null);
          }}
        >
          <Text style={[styles.label, { color: c.ink }]}>{item.label}</Text>
          {item.value === current ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
        </Pressable>
      ))}
    </View>
  );
  const plain = (list: string[]) => list.map((v) => ({ value: v, label: v }));

  const stepper = (value: number, set: (n: number) => void, min: number, max: number) => (
    <View style={styles.stepper}>
      <Pressable style={[styles.step, { backgroundColor: c.surface2 }]} onPress={() => set(Math.max(min, value - 1))} hitSlop={6} accessibilityLabel="Less">
        <Ionicons name="remove" size={18} color={c.ink} />
      </Pressable>
      <Text style={[styles.stepValue, { color: c.ink }]}>{value}</Text>
      <Pressable style={[styles.step, { backgroundColor: c.surface2 }]} onPress={() => set(Math.min(max, value + 1))} hitSlop={6} accessibilityLabel="More">
        <Ionicons name="add" size={18} color={c.ink} />
      </Pressable>
    </View>
  );

  const titles: Record<Exclude<Page, null>, string> = {
    opponent: tournament ? 'Host club' : 'Opponent',
    date: 'Date',
    time: 'Kick-off',
    venue: 'Venue',
    competition: 'Competition',
    level: 'Level',
    teams: 'Teams',
    format: 'Format',
    quarters: tournament ? 'Games' : 'Quarters',
  };

  let body: ReactNode;
  if (!loaded) {
    body = error ? <Text style={[styles.hint, { color: c.danger, marginTop: 8 }]}>{error}</Text> : <ActivityIndicator color={c.pitch} style={{ marginTop: 24 }} />;
  } else if (page === 'opponent') {
    const q = opponent.trim().toLowerCase();
    const matches = competitors.filter((x) => x.name.toLowerCase().includes(q));
    const isNew = q && !competitors.some((x) => x.name.toLowerCase() === q);
    body = (
      <>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <TextInput
            style={[styles.input, { color: c.ink }]}
            placeholder="Search or type a club"
            placeholderTextColor={c.inkSoft}
            value={opponent}
            onChangeText={setOpponent}
            autoFocus
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => setPage(null)}
          />
        </View>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          {isNew ? (
            <Pressable style={styles.row} onPress={() => setPage(null)}>
              <Text style={[styles.label, { color: c.pitch }]}>Use "{opponent.trim()}"</Text>
            </Pressable>
          ) : null}
          {matches.map((x, i) => (
            <Pressable
              key={x.id}
              style={[styles.row, (i > 0 || isNew) && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}
              onPress={() => {
                setOpponent(x.name);
                setPage(null);
              }}
            >
              <Text style={[styles.label, { color: c.ink }]}>{x.name}</Text>
              {x.name.toLowerCase() === q ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
            </Pressable>
          ))}
        </View>
      </>
    );
  } else if (page === 'date') {
    body = (
      <View style={[styles.card, { backgroundColor: c.surface, padding: 8 }]}>
        <DateTimePicker mode="date" display="inline" value={date ?? new Date()} accentColor={c.pitch} onChange={(_, d) => d && setDate(d)} />
      </View>
    );
  } else if (page === 'time') {
    const ten = new Date();
    ten.setHours(10, 0, 0, 0);
    body = (
      <>
        <View style={[styles.card, { backgroundColor: c.surface, padding: 8 }]}>
          <DateTimePicker mode="time" display="spinner" minuteInterval={5} value={time ?? ten} onChange={(_, d) => d && setTime(d)} />
        </View>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <Pressable
            style={styles.row}
            onPress={() => {
              setTime(null);
              setPage(null);
            }}
          >
            <Text style={[styles.label, { color: c.danger }]}>No kick-off time yet</Text>
          </Pressable>
        </View>
      </>
    );
  } else if (page === 'venue') body = options(plain(VENUES), venue, setVenue);
  else if (page === 'competition') body = options(plain(COMPETITIONS), competition, setCompetition);
  else if (page === 'level') body = options(plain(LEVELS), level, setLevel);
  else if (page === 'teams') body = options(TEAMS, teams, setTeams);
  else if (page === 'format') body = options(plain(FORMATS), format, setFormat);
  else if (page === 'quarters') {
    body = (
      <>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <View style={styles.row}>
            <Text style={[styles.label, { color: c.ink }]}>Number</Text>
            {stepper(quarters, setQuarters, 1, 6)}
          </View>
          <View style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}>
            <Text style={[styles.label, { color: c.ink }]}>Minutes each</Text>
            {stepper(minutes, setMinutes, 1, 45)}
          </View>
        </View>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          {Array.from({ length: quarters }, (_, i) => (
            <View key={i} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}>
              <Text style={{ width: 18, color: c.inkSoft, fontFamily: fonts.regular, fontSize: 15 }}>{i + 1}</Text>
              <TextInput
                style={[styles.input, { color: c.ink, paddingVertical: 0 }]}
                placeholder={`Q${i + 1}`}
                placeholderTextColor={c.inkSoft}
                value={names[i] ?? ''}
                onChangeText={(text) => setNames(Array.from({ length: 6 }, (_, n) => (n === i ? text : (names[n] ?? ''))))}
                autoCorrect={false}
              />
            </View>
          ))}
        </View>
        <Text style={[styles.hint, { color: c.inkSoft }]}>
          Leave a name empty to keep Q1, Q2… For a tournament, name each one after the opponent.
        </Text>
      </>
    );
  } else {
    body = (
      <>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          {row(titles.opponent, opponent.trim() || 'Choose', 'opponent', true)}
          {row('Date', date ? fmtDate(toIso(date)) : 'Choose', 'date')}
          {row('Kick-off', hhmm ?? 'Not set', 'time')}
        </View>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          {row('Venue', venue, 'venue', true)}
          {row('Competition', competition, 'competition')}
          {row('Level', level, 'level')}
          {oneTeam ? null : row('Teams', TEAMS.find((t) => t.value === teams)!.label, 'teams')}
          {row('Format', format, 'format')}
          {row(titles.quarters, `${quarters} × ${minutes}'`, 'quarters')}
        </View>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <View style={styles.row}>
            <Text style={[styles.label, { color: c.ink, flex: 0, width: 84 }]}>Location</Text>
            <TextInput style={[styles.input, { color: c.ink, paddingVertical: 0 }]} placeholder="Address" placeholderTextColor={c.inkSoft} value={location} onChangeText={setLocation} />
          </View>
          <View style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}>
            <Text style={[styles.label, { color: c.ink, flex: 0, width: 84 }]}>Remarks</Text>
            <TextInput
              style={[styles.input, { color: c.ink, paddingTop: 0, paddingBottom: 0 }]}
              placeholder="Optional"
              placeholderTextColor={c.inkSoft}
              value={remarks}
              onChangeText={setRemarks}
              multiline
            />
          </View>
        </View>
        {error ? <Text style={[styles.hint, { color: c.danger }]}>{error}</Text> : null}
        <Pressable style={[styles.save, { backgroundColor: c.pitch }]} onPress={save}>
          {saving ? <ActivityIndicator color={c.onPitch} /> : <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>Save game</Text>}
        </Pressable>
        {id ? (
          <Pressable style={[styles.save, { marginTop: 0 }]} onPress={remove}>
            <Text style={{ color: c.danger, fontFamily: fonts.medium, fontSize: 16 }}>Remove game</Text>
          </Pressable>
        ) : null}
      </>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: c.chalk }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable
          style={[styles.round, { backgroundColor: c.surface }]}
          onPress={() => (page ? setPage(null) : goBack())}
          accessibilityLabel={page ? 'Back' : 'Close'}
          hitSlop={8}
        >
          <Ionicons name={page ? 'chevron-back' : 'close'} size={20} color={c.ink} />
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]}>{page ? titles[page] : id ? 'Edit game' : 'New game'}</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  card: { borderRadius: 14, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingVertical: 10 },
  label: { flex: 1, fontFamily: fonts.regular, fontSize: 16 },
  value: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 16 },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, paddingVertical: 10 },
  hint: { fontFamily: fonts.regular, fontSize: 13, marginHorizontal: 12, marginTop: -4 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  step: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 24, textAlign: 'center', fontFamily: fonts.medium, fontSize: 16 },
  save: { borderRadius: 12, alignItems: 'center', paddingVertical: 14, marginTop: 4 },
});
