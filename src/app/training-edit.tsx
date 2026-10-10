import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fmtDate, toIso, useData, type Training } from '../lib/data';
import { goBack } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';

type Page = 'date' | 'start' | 'end' | 'status';
const PAGE_TITLES: Record<Page, string> = { date: 'Date', start: 'Start time', end: 'End time', status: 'Status' };

// Same three statuses as the web app; "Scheduled" is stored as no status.
const STATUSES: { value: string | null; label: string }[] = [
  { value: null, label: 'Scheduled' },
  { value: 'postponed', label: 'Postponed' },
  { value: 'cancelled', label: 'Cancelled' },
];

// "17:30" -> a Date today at that time, for the time wheel.
function timeOf(hhmm: string | null, fallbackHour: number, fallbackMinute = 0) {
  const d = new Date();
  const [h, m] = hhmm ? hhmm.split(':').map(Number) : [fallbackHour, fallbackMinute];
  d.setHours(h, m, 0, 0);
  return d;
}
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Edit one training, or add a new one when opened without an id: its name,
// date, start and end time, and its status.
export default function TrainingEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trainings } = useData();
  const training = trainings.find((t) => t.id === id);
  // The form starts from the training's values, so it waits for them.
  return training || !id ? <Form training={training ?? null} /> : null;
}

function Form({ training }: { training: Training | null }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { refresh } = useData();

  const [name, setName] = useState(training?.label ?? '');
  const [date, setDate] = useState<Date | null>(() => (training ? new Date(`${training.date}T00:00:00`) : null));
  const [start, setStart] = useState(() => timeOf(training?.startTime ?? null, 17, 30));
  const [end, setEnd] = useState(() => timeOf(training?.endTime ?? null, 19));
  const [status, setStatus] = useState<string | null>(training?.cancelStatus ?? null);
  const [page, setPage] = useState<Page | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // "Cancel training" saves at once, with the status set to cancelled.
  async function save(as: string | null = status) {
    if (saving) return;
    if (!name.trim()) return setError('Give the training a name.');
    if (!date) return setError('Choose a date.');
    if (hhmm(end) <= hhmm(start)) return setError('The end time has to be after the start time.');
    setSaving(true);
    setError('');
    const values = { label: name.trim(), date: toIso(date), start_time: hhmm(start), end_time: hhmm(end), cancel_status: as };
    // A new training has no absences, so everyone starts as present.
    const saved = training
      ? await supabase.from('trainings').update(values).eq('id', training.id)
      : await supabase.from('trainings').insert(values);
    if (saved.error) {
      setError(`Could not save the training: ${saved.error.message}`);
      setSaving(false);
      return;
    }
    await refresh();
    goBack();
  }

  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };
  const row = (label: string, value: string, target: Page) => (
    <Pressable style={[styles.row, line]} onPress={() => setPage(target)}>
      <Text style={[styles.label, { color: c.ink }]}>{label}</Text>
      <Text style={[styles.value, { color: c.ink }]}>{value}</Text>
      <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
    </Pressable>
  );

  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: c.chalk }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable
          style={[styles.round, { backgroundColor: c.surface }]}
          onPress={() => (page ? setPage(null) : goBack())}
          accessibilityLabel="Back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]}>{page ? PAGE_TITLES[page] : training ? 'Edit training' : 'New training'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {page === 'date' ? (
          <View style={[styles.card, { backgroundColor: c.surface, padding: 8 }]}>
            <DateTimePicker mode="date" display="inline" value={date ?? new Date()} accentColor={c.pitch} onChange={(_, d) => d && setDate(d)} />
          </View>
        ) : page === 'status' ? (
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            {STATUSES.map((option, i) => (
              <Pressable
                key={option.label}
                style={[styles.row, i > 0 && line]}
                onPress={() => {
                  setStatus(option.value);
                  setPage(null);
                }}
              >
                <Text style={[styles.label, { color: c.ink }]}>{option.label}</Text>
                {status === option.value ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
              </Pressable>
            ))}
          </View>
        ) : page ? (
          <View style={[styles.card, { backgroundColor: c.surface, padding: 8 }]}>
            <DateTimePicker
              mode="time"
              display="spinner"
              minuteInterval={5}
              value={page === 'start' ? start : end}
              onChange={(_, d) => d && (page === 'start' ? setStart(d) : setEnd(d))}
            />
          </View>
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <View style={styles.row}>
                <Text style={[styles.label, { color: c.ink, flex: 0 }]}>Name</Text>
                <TextInput
                  style={[styles.input, { color: c.ink }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Name of the training"
                  placeholderTextColor={c.inkSoft}
                  returnKeyType="done"
                />
              </View>
              {row('Date', date ? fmtDate(toIso(date)) : 'Choose', 'date')}
              {row('Start time', hhmm(start), 'start')}
              {row('End time', hhmm(end), 'end')}
              {row('Status', STATUSES.find((x) => x.value === status)?.label ?? 'Scheduled', 'status')}
            </View>
            {error ? <Text style={{ color: c.danger, fontFamily: fonts.regular, fontSize: 13, marginHorizontal: 12 }}>{error}</Text> : null}
            <Pressable style={[styles.button, { backgroundColor: c.pitch }]} onPress={() => save()}>
              {saving ? <ActivityIndicator color={c.onPitch} /> : <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>Save</Text>}
            </Pressable>
            {training && status !== 'cancelled' ? (
              <Pressable style={styles.button} onPress={() => save('cancelled')}>
                <Text style={{ color: c.danger, fontFamily: fonts.medium, fontSize: 16 }}>Cancel training</Text>
              </Pressable>
            ) : null}
          </>
        )}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, paddingVertical: 9 },
  label: { flex: 1, fontFamily: fonts.regular, fontSize: 16 },
  value: { fontFamily: fonts.regular, fontSize: 16 },
  input: { flex: 1, textAlign: 'right', fontFamily: fonts.regular, fontSize: 16, paddingVertical: 0 },
  button: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
});
