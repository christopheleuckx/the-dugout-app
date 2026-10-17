import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useData } from '../lib/data';
import { goBack } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';

type League = { id: string; name: string; teams: number; matchdays: number };

// The competitions of the age group on show. A competition has its teams, its
// matchdays with their matches, and the rules for the table.
export default function LeaguesScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { me } = useData();
  const group = me?.activeAgeGroup;
  const [leagues, setLeagues] = useState<League[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: failed } = await supabase.from('leagues').select('id, name, league_teams(id), league_matchdays(id)').order('name');
    if (failed) setError(`Could not load the competitions: ${failed.message}`);
    setLeagues((data ?? []).map((l) => ({ id: l.id, name: l.name, teams: (l.league_teams ?? []).length, matchdays: (l.league_matchdays ?? []).length })));
  }, []);
  // Fresh every time the page comes back on show, after editing one.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function create() {
    if (saving) return;
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean) return setError('Give the competition a name.');
    setSaving(true);
    setError('');
    const made = await supabase.from('leagues').insert({ name: clean }).select('id').single();
    if (made.error) {
      setError(`Could not create the competition: ${made.error.message}`);
      setSaving(false);
      return;
    }
    // The club itself always plays in its own competition.
    await supabase.from('league_teams').insert({ league_id: made.data.id, is_own_team: true });
    setSaving(false);
    setAdding(false);
    router.push({ pathname: '/league', params: { id: made.data.id } });
  }

  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: c.chalk }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={() => (adding ? setAdding(false) : goBack())} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]}>{adding ? 'New competition' : 'Leagues and fixtures'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {adding ? (
          <>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <View style={styles.row}>
                <Text style={[styles.label, { color: c.ink }]}>Name</Text>
                <TextInput style={[styles.input, { color: c.ink }]} value={name} onChangeText={setName} placeholder="Elite league" placeholderTextColor={c.inkSoft} autoCorrect={false} autoFocus />
              </View>
              <View style={[styles.row, line]}>
                <Text style={[styles.label, { color: c.ink }]}>Age group</Text>
                <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 16 }}>{group ? `${group.name} · ${group.clubName}` : '–'}</Text>
              </View>
            </View>
            <Text style={[styles.note, { color: c.inkSoft }]}>The competition is made for the team you are working in. Teams, matchdays and rules follow on the next page.</Text>
            {error ? <Text style={[styles.note, { color: c.danger }]}>{error}</Text> : null}
            <Pressable style={[styles.button, { backgroundColor: c.pitch }]} onPress={create}>
              {saving ? <ActivityIndicator color={c.onPitch} /> : <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>Create competition</Text>}
            </Pressable>
          </>
        ) : leagues === null ? (
          <ActivityIndicator color={c.pitch} style={{ marginTop: 24 }} />
        ) : (
          <>
            {error ? <Text style={[styles.note, { color: c.danger }]}>{error}</Text> : null}
            <Text style={[styles.note, { color: c.inkSoft }]}>{group ? `Competitions of ${group.name} · ${group.clubName}.` : 'Choose a team first.'}</Text>
            {leagues.length === 0 ? (
              <Text style={[styles.note, { color: c.inkSoft, marginTop: 8 }]}>No competition yet. Create the first one with the plus below.</Text>
            ) : (
              <View style={[styles.card, { backgroundColor: c.surface }]}>
                {leagues.map((l, i) => (
                  <Pressable key={l.id} style={[styles.row, { minHeight: 62 }, i > 0 && line]} onPress={() => router.push({ pathname: '/league', params: { id: l.id } })}>
                    <Ionicons name="trophy-outline" size={22} color={c.inkSoft} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 15 }}>{l.name}</Text>
                      <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>{[count(l.teams, 'team'), count(l.matchdays, 'matchday')].join(' · ')}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
      {adding || !group ? null : (
        <Pressable style={[styles.add, { backgroundColor: c.pitch, bottom: Math.max(insets.bottom, 12) + 12 }]} onPress={() => (setName(''), setError(''), setAdding(true))} accessibilityLabel="New competition">
          <Ionicons name="add" size={28} color={c.onPitch} />
        </Pressable>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 17 },
  content: { padding: 16, gap: 10, paddingBottom: 110 },
  note: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, marginHorizontal: 12 },
  card: { borderRadius: 14, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingVertical: 9 },
  label: { flex: 1, fontFamily: fonts.regular, fontSize: 16 },
  input: { flex: 2, textAlign: 'right', fontFamily: fonts.regular, fontSize: 16, paddingVertical: 0 },
  button: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, marginTop: 6 },
  add: {
    position: 'absolute',
    right: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0E1320',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
