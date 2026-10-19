import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useData } from '../lib/data';
import { goBack } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';
import type { BasePlayer } from './age-group-players';

// The positions as the rest of the app knows them: keeper, then the numbers.
const POSITIONS = ['K', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
const FEET = ['Right', 'Left', 'Both'];
const EMPTY = { first_name: '', last_name: '', preferred_position_1: '', best_position: '', developing_position: '', preferred_foot: '', strengths: '', primary_focus: '', remarks: '' };
type Form = typeof EMPTY;

// The basic information of one player of an age group: new, or one to change.
// Only first and last name are required.
export default function AgeGroupPlayerScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { group, name, id } = useLocalSearchParams<{ group: string; name: string; id?: string }>();
  const { refresh } = useData();
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    supabase.rpc('age_group_players', { p_group: group }).then(({ data, error: failed }) => {
      const found = ((data ?? []) as BasePlayer[]).find((p) => p.id === id);
      if (failed || !found) setError(failed ? `Could not load the player: ${failed.message}` : 'This player no longer exists.');
      else setForm(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, (found as Record<string, string>)[k] ?? ''])) as Form);
      setLoading(false);
    });
  }, [group, id]);

  const set = (key: keyof Form, value: string) => setForm({ ...form, [key]: value });
  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };

  async function save() {
    if (saving) return;
    if (!form.first_name.trim() || !form.last_name.trim()) return setError('First and last name are required.');
    setSaving(true);
    setError('');
    const { error: failed } = await supabase.rpc('save_age_group_player', { p_group: group, p_id: id ?? null, p: form });
    setSaving(false);
    if (failed) return setError(`Could not save the player: ${failed.message}`);
    // The squad, selections and trainings of the team on show may use this player.
    refresh();
    goBack();
  }

  function remove() {
    Alert.alert(
      'Remove this player?',
      `${form.first_name} ${form.last_name} is removed from ${name}, together with their selections, ratings and training attendance. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const { error: failed } = await supabase.rpc('delete_age_group_player', { p_group: group, p_id: id });
            if (failed) return setError(`Could not remove the player: ${failed.message}`);
            refresh();
            goBack();
          },
        },
      ],
    );
  }

  const text = (label: string, key: keyof Form, placeholder: string, first = false) => (
    <View style={[styles.field, !first && line]}>
      <Text style={[styles.label, { color: c.ink }]}>{label}</Text>
      <TextInput
        value={form[key]}
        onChangeText={(v) => set(key, v)}
        placeholder={placeholder}
        placeholderTextColor={c.inkSoft}
        autoCapitalize="words"
        style={[styles.input, { color: c.ink }]}
      />
    </View>
  );
  const long = (label: string, key: keyof Form, placeholder: string) => (
    <View style={{ gap: 8 }}>
      <Text style={[styles.caption, { color: c.inkSoft }]}>{label}</Text>
      <TextInput
        value={form[key]}
        onChangeText={(v) => set(key, v)}
        placeholder={placeholder}
        placeholderTextColor={c.inkSoft}
        multiline
        style={[styles.card, styles.area, { backgroundColor: c.surface, color: c.ink }]}
      />
    </View>
  );
  // One choice from a row of chips; tapping the chosen one clears it.
  const chips = (label: string, key: keyof Form, options: string[]) => (
    <View style={{ gap: 8 }}>
      <Text style={[styles.caption, { color: c.inkSoft }]}>{label}</Text>
      <View style={styles.chips}>
        {options.map((o) => {
          const on = form[key] === o;
          return (
            <Pressable key={o} style={[styles.chip, { backgroundColor: on ? c.pitch : c.surface }]} onPress={() => set(key, on ? '' : o)}>
              <Text style={{ color: on ? c.onPitch : c.ink, fontFamily: fonts.medium, fontSize: 15 }}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: c.chalk }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={goBack} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>
            {id ? `${form.first_name} ${form.last_name}`.trim() || 'Player' : 'New player'}
          </Text>
          <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>{name}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={c.pitch} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            {text('First name', 'first_name', 'Required', true)}
            {text('Last name', 'last_name', 'Required')}
          </View>
          {chips('Preferred position', 'preferred_position_1', POSITIONS)}
          {chips('Best position', 'best_position', POSITIONS)}
          {chips('Developing position', 'developing_position', POSITIONS)}
          {chips('Preferred foot', 'preferred_foot', FEET)}
          {long('Strengths', 'strengths', 'What the player is good at')}
          {long('Primary focus for improvement', 'primary_focus', 'What to work on first')}
          {long('Remarks', 'remarks', 'Anything else')}
          {error ? <Text style={{ color: c.danger, fontFamily: fonts.regular, fontSize: 13 }}>{error}</Text> : null}
          <Pressable style={[styles.button, { backgroundColor: c.pitch }, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={c.onPitch} /> : <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>{id ? 'Save' : 'Add player'}</Text>}
          </Pressable>
          {id ? (
            <Pressable style={[styles.button, { backgroundColor: c.surface }]} onPress={remove}>
              <Text style={{ color: c.danger, fontFamily: fonts.medium, fontSize: 16 }}>Remove player</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.medium, fontSize: 17 },
  content: { padding: 16, gap: 14, paddingBottom: 60 },
  card: { borderRadius: 14 },
  field: { flexDirection: 'row', alignItems: 'center', minHeight: 54, paddingHorizontal: 16, gap: 12 },
  label: { width: 96, fontFamily: fonts.regular, fontSize: 16 },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, textAlign: 'right', paddingVertical: 12 },
  caption: { fontFamily: fonts.medium, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, marginHorizontal: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minWidth: 46, height: 40, borderRadius: 12, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  area: { minHeight: 84, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, fontFamily: fonts.regular, fontSize: 15, textAlignVertical: 'top' },
  button: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
