import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fmtDate, useData } from '../lib/data';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';
import { goBack } from '../lib/nav';

// The five player ratings, from 1 to 5.
const RATING_LABELS = ['Performed Below IP3 Level', 'Limited Match Impact', 'Performed at IP3 Level', 'Actively Involved', 'Game Changer'];
const BENCH_SLOTS = ['S1', 'S2', 'S3', 'S4', 'S5'];
const spot = (position: string) => (!position ? '–' : BENCH_SLOTS.includes(position) ? 'Bench' : position);

// One player's game: rating, where they played per quarter, and the coach's
// feedback. The rating and the feedback each open a page to change them.
export default function GamePlayerScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ game: string; player: string }>();
  const { games, players, refresh } = useData();
  const [page, setPage] = useState<'rating' | 'feedback' | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const game = games.find((g) => g.id === params.game);
  const player = players.find((p) => p.id === params.player);

  if (!game || !player) {
    return (
      <View style={[styles.page, { backgroundColor: c.chalk, paddingTop: insets.top + 60, alignItems: 'center' }]}>
        <Text style={{ color: c.inkSoft, fontFamily: fonts.regular }}>This player or game no longer exists.</Text>
      </View>
    );
  }

  const rating = game.ratings[player.id];
  const stints = game.stints[player.id] ?? [];

  // Writes only the field that changed, so the rest of the rating stays as it is.
  async function save(change: { score: number | null } | { comment: string }) {
    if (saving) return;
    setSaving(true);
    setError('');
    const saved = await supabase
      .from('player_ratings')
      .upsert({ game_id: game!.id, player_id: player!.id, ...change }, { onConflict: 'game_id,player_id' });
    if (saved.error) {
      setError(`Could not save: ${saved.error.message}`);
      setSaving(false);
      return;
    }
    await refresh();
    setSaving(false);
    setPage(null);
  }

  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };

  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: c.chalk }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable
          style={[styles.round, { backgroundColor: c.surface }]}
          onPress={() => (page ? setPage(null) : goBack())}
          accessibilityLabel="Close"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>
            {player.firstName} {player.lastName}
          </Text>
          <Text style={[styles.sub, { color: c.inkSoft }]} numberOfLines={1}>
            {game.opponent || 'TBD'} · {fmtDate(game.date)}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <Text style={{ color: c.danger, fontFamily: fonts.regular, fontSize: 13 }}>{error}</Text> : null}
        {page === 'rating' ? (
          <View style={[styles.card, { backgroundColor: c.surface, paddingVertical: 4 }]}>
            {[5, 4, 3, 2, 1].map((score, i) => (
              <Pressable key={score} style={[styles.option, i > 0 && line]} onPress={() => save({ score })}>
                <View style={[styles.badge, { backgroundColor: c.rating[score - 1] }]}>
                  <Text style={{ color: '#fff', fontFamily: fonts.semi, fontSize: 15 }}>{score}</Text>
                </View>
                <Text style={[styles.label, { color: c.ink, flex: 1 }]}>{RATING_LABELS[score - 1]}</Text>
                {rating?.score === score ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
              </Pressable>
            ))}
            <Pressable style={[styles.option, line]} onPress={() => save({ score: null })}>
              <View style={[styles.badge, { backgroundColor: c.surface2 }]}>
                <Text style={{ color: c.inkSoft, fontFamily: fonts.semi, fontSize: 15 }}>–</Text>
              </View>
              <Text style={[styles.label, { color: c.ink, flex: 1 }]}>Not rated</Text>
              {!rating?.score ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
            </Pressable>
          </View>
        ) : page === 'feedback' ? (
          <>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <TextInput
                style={[styles.feedback, { color: c.ink, minHeight: 160, textAlignVertical: 'top', paddingVertical: 0 }]}
                value={draft}
                onChangeText={setDraft}
                placeholder="What went well, and what to work on."
                placeholderTextColor={c.inkSoft}
                multiline
                autoFocus
              />
            </View>
            <Pressable style={[styles.button, { backgroundColor: c.pitch }]} onPress={() => save({ comment: draft.trim() })}>
              {saving ? <ActivityIndicator color={c.onPitch} /> : <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>Save</Text>}
            </Pressable>
          </>
        ) : (
          <>
        <Pressable style={[styles.card, styles.row, { backgroundColor: c.surface }]} onPress={() => setPage('rating')}>
          <View style={[styles.score, { backgroundColor: rating?.score ? c.rating[rating.score - 1] : c.surface2 }]}>
            <Text style={[styles.scoreText, { color: rating?.score ? '#fff' : c.inkSoft }]}>{rating?.score ?? '–'}</Text>
          </View>
          <Text style={[styles.label, { color: c.ink, flex: 1 }]}>
            {rating?.score ? RATING_LABELS[rating.score - 1] : 'Not rated yet'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
        </Pressable>

        <Text style={[styles.section, { color: c.ink }]}>Positions</Text>
        <View style={[styles.card, { backgroundColor: c.surface, paddingVertical: 6 }]}>
          {stints.length === 0 ? (
            <Text style={[styles.sub, { color: c.inkSoft, paddingVertical: 10 }]}>No line-up recorded for this game.</Text>
          ) : null}
          {stints.map((s, i) => (
            <View key={i} style={[styles.stint, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}>
              <Text style={[styles.quarter, { color: c.inkSoft }]} numberOfLines={1}>
                {s.label}
              </Text>
              <Text style={[styles.label, { color: c.ink }]}>
                {spot(s.starting)}
                {s.after10 !== s.starting ? `  →  ${spot(s.after10)}` : ''}
              </Text>
            </View>
          ))}
        </View>

        <Text style={[styles.section, { color: c.ink }]}>Feedback</Text>
        <Pressable
          style={[styles.card, styles.row, { backgroundColor: c.surface, alignItems: 'flex-start' }]}
          onPress={() => {
            setDraft(rating?.comment ?? '');
            setPage('feedback');
          }}
        >
          <Text style={[styles.feedback, { flex: 1, color: rating?.comment ? c.ink : c.inkSoft }]}>
            {rating?.comment || 'Add feedback'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={c.inkSoft} style={{ marginTop: 3 }} />
        </Pressable>
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
  title: { fontFamily: fonts.medium, fontSize: 17 },
  sub: { fontFamily: fonts.regular, fontSize: 13 },
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  card: { borderRadius: 12, padding: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  score: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  scoreText: { fontFamily: fonts.semi, fontSize: 24 },
  label: { fontFamily: fonts.medium, fontSize: 16 },
  section: { fontFamily: fonts.medium, fontSize: 19, marginTop: 12 },
  stint: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  quarter: { width: 44, fontFamily: fonts.medium, fontSize: 13 },
  feedback: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 8 },
  badge: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  button: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
});
