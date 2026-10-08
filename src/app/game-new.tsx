import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
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
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';

// Same choices as the web app's new-game form.
const VENUES = ['Home', 'Away'];
const COMPETITIONS = ['Friendly', 'Tournament', 'Competition'];
const LEVELS = ['Elite', 'IP3', 'Other'];
const TEAMS = [
  { value: 1, label: '1 team' },
  { value: 2, label: 'Blue and Red' },
];

type Page = null | 'opponent' | 'date' | 'time' | 'venue' | 'competition' | 'level' | 'teams' | 'quarters';

// New game: a settings-style form. Each row opens a page to choose its value;
// Save writes the game to the shared database, for the web app and every coach.
export default function NewGameScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { competitors, refresh } = useData();

  const [page, setPage] = useState<Page>(null);
  const [opponent, setOpponent] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<Date | null>(null);
  const [venue, setVenue] = useState('Home');
  const [competition, setCompetition] = useState('Competition');
  const [level, setLevel] = useState('IP3');
  const [teams, setTeams] = useState(2);
  const [quarters, setQuarters] = useState(4);
  const [minutes, setMinutes] = useState(20);
  // Custom names per quarter; an empty one falls back to Q1, Q2…
  const [names, setNames] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
      const { error: failed } = await supabase.from('games').insert({
        date: toIso(date),
        time: hhmm,
        opponent: name,
        competitor_id: competitorId,
        type: level,
        competition,
        home_away: venue,
        quarters,
        quarter_length: minutes,
        num_teams: teams,
        location: location.trim(),
        remarks,
        quarter_scores: Array.from({ length: quarters }, () => ({ for: null, against: null })),
        quarter_labels: Array.from({ length: quarters }, (_, i) => names[i]?.trim() ?? ''),
        team_eval: { score: null, opponent: '', quarterNotes: [], wentWell: '', toImprove: '' },
      });
      if (failed) throw failed;
      await refresh();
      router.back();
    } catch (e) {
      setError(`Could not save the game: ${e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'unknown error'}`);
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
    quarters: tournament ? 'Games' : 'Quarters',
  };

  let body: ReactNode;
  if (page === 'opponent') {
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
          {row('Teams', TEAMS.find((t) => t.value === teams)!.label, 'teams')}
          {row(titles.quarters, `${quarters} × ${minutes}'`, 'quarters')}
        </View>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <View style={styles.row}>
            <Text style={[styles.label, { color: c.ink, flex: 0, width: 84 }]}>Location</Text>
            <TextInput style={[styles.input, { color: c.ink }]} placeholder="Address" placeholderTextColor={c.inkSoft} value={location} onChangeText={setLocation} />
          </View>
          <View style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, alignItems: 'flex-start' }]}>
            <Text style={[styles.label, { color: c.ink, flex: 0, width: 84 }]}>Remarks</Text>
            <TextInput style={[styles.input, { color: c.ink }]} placeholder="Optional" placeholderTextColor={c.inkSoft} value={remarks} onChangeText={setRemarks} multiline />
          </View>
        </View>
        {error ? <Text style={[styles.hint, { color: c.danger }]}>{error}</Text> : null}
        <Pressable style={[styles.save, { backgroundColor: c.pitch }]} onPress={save}>
          {saving ? <ActivityIndicator color={c.onPitch} /> : <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>Save game</Text>}
        </Pressable>
      </>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: c.chalk }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable
          style={[styles.round, { backgroundColor: c.surface }]}
          onPress={() => (page ? setPage(null) : router.back())}
          accessibilityLabel={page ? 'Back' : 'Close'}
          hitSlop={8}
        >
          <Ionicons name={page ? 'chevron-back' : 'close'} size={20} color={c.ink} />
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]}>{page ? titles[page] : 'New game'}</Text>
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
