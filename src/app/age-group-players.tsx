import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { goBack } from '../lib/nav';
import { groupOf, POSITION_GROUPS } from '../lib/selection';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';

export type BasePlayer = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_position_1: string;
  best_position: string;
  developing_position: string;
  preferred_foot: string;
  strengths: string;
  primary_focus: string;
  remarks: string;
};

// The players of one age group, by line, as an admin manages them from Club
// management. These are the players its selections and trainings use.
export default function AgeGroupPlayersScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { group, name, club } = useLocalSearchParams<{ group: string; name: string; club?: string }>();
  const [players, setPlayers] = useState<BasePlayer[] | null>(null);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      supabase.rpc('age_group_players', { p_group: group }).then(({ data, error: failed }) => {
        if (failed) setError(`Could not load the players: ${failed.message}`);
        else setPlayers((data ?? []) as BasePlayer[]);
      });
    }, [group]),
  );

  const lines = [...POSITION_GROUPS.map((g) => g.label), 'No position yet']
    .map((label, i) => ({ label, players: (players ?? []).filter((p) => groupOf(p.best_position) === i) }))
    .filter((l) => l.players.length);
  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };
  const open = (id?: string) => router.push({ pathname: '/age-group-player', params: { group, name, ...(id ? { id } : {}) } });

  return (
    <View style={[styles.page, { backgroundColor: c.chalk }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={goBack} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.title, { color: c.ink }]}>Players</Text>
          <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }} numberOfLines={1}>
            {[club, name].filter(Boolean).join(' ')}
            {players ? ` · ${players.length} ${players.length === 1 ? 'player' : 'players'}` : ''}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error ? <Text style={{ color: c.danger, fontFamily: fonts.regular, fontSize: 13 }}>{error}</Text> : null}
        {players === null && !error ? <ActivityIndicator color={c.pitch} style={{ marginTop: 24 }} /> : null}
        {players && players.length === 0 ? (
          <Text style={[styles.note, { color: c.inkSoft }]}>No players created yet. Add the first one with the plus below. Only first and last name are needed.</Text>
        ) : null}
        {lines.map((l) => (
          <View key={l.label} style={{ gap: 8 }}>
            <Text style={[styles.group, { color: c.inkSoft }]}>{l.label}</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              {l.players.map((p, i) => (
                <Pressable key={p.id} style={[styles.row, i > 0 && line]} onPress={() => open(p.id)}>
                  <View style={[styles.badge, { backgroundColor: c.surface2 }]}>
                    <Text style={{ color: c.ink, fontFamily: fonts.semi, fontSize: 13 }}>{p.best_position || '–'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 15 }} numberOfLines={1}>
                      {`${p.first_name} ${p.last_name}`.trim()}
                    </Text>
                    {p.preferred_foot || p.developing_position ? (
                      <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }} numberOfLines={1}>
                        {[p.preferred_foot ? `${p.preferred_foot} foot` : null, p.developing_position ? `Developing ${p.developing_position}` : null].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <Pressable
        style={[styles.add, { backgroundColor: c.pitch, bottom: Math.max(insets.bottom, 12) + 12 }]}
        onPress={() => open()}
        accessibilityLabel="New player"
      >
        <Ionicons name="add" size={28} color={c.onPitch} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.medium, fontSize: 17 },
  content: { padding: 16, gap: 10, paddingBottom: 110 },
  note: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, marginHorizontal: 4 },
  group: { fontFamily: fonts.medium, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, marginHorizontal: 4 },
  card: { borderRadius: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingHorizontal: 16 },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  add: {
    position: 'absolute',
    right: 16,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0E1320',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
