import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useData, type AgeGroup } from '../lib/data';
import { goBack } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';

// The switcher: a coach who is linked to more than one age group chooses the
// one to work in. The whole app then shows that age group's players, games
// and trainings, because the database only returns those.
export default function AgeGroupScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { me, refresh } = useData();
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!me) return null;

  async function choose(group: AgeGroup) {
    if (switching) return;
    if (group.id === me!.activeAgeGroup?.id) return goBack();
    setSwitching(group.id);
    setError('');
    const saved = await supabase.from('profiles').update({ active_age_group_id: group.id }).eq('id', me!.id);
    if (saved.error) {
      setError(`Could not switch: ${saved.error.message}`);
      setSwitching(null);
      return;
    }
    await refresh();
    goBack();
  }

  const clubs = [...new Set(me.ageGroups.map((g) => g.clubName))];
  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };

  return (
    <View style={[styles.page, { backgroundColor: c.chalk }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={goBack} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]}>Age group</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {error ? <Text style={{ color: c.danger, fontFamily: fonts.regular, fontSize: 13 }}>{error}</Text> : null}
        {clubs.map((club) => (
          <View key={club} style={{ gap: 10 }}>
            <Text style={[styles.section, { color: c.ink }]}>{club}</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              {me.ageGroups
                .filter((g) => g.clubName === club)
                .map((group, i) => (
                  <Pressable key={group.id} style={[styles.row, i > 0 && line]} onPress={() => choose(group)}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 16 }}>{group.name}</Text>
                      <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>
                        {[group.format, group.teams.map((t) => t.name).join(' and ')].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    {switching === group.id ? (
                      <ActivityIndicator size="small" color={c.pitch} />
                    ) : me.activeAgeGroup?.id === group.id ? (
                      <Ionicons name="checkmark" size={20} color={c.pitch} />
                    ) : null}
                  </Pressable>
                ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 17 },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  section: { fontFamily: fonts.medium, fontSize: 19 },
  card: { borderRadius: 14, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 9 },
});
