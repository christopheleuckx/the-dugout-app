import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fmtDate, useData } from '../lib/data';
import { fonts, useColors } from '../lib/theme';

// Same scale as RATING_SCALE in the web app.
const RATING_LABELS = ['Below IP3 level', 'No influence', 'IP3 level', 'Gamechanger', 'Elite'];
const BENCH_SLOTS = ['S1', 'S2', 'S3', 'S4', 'S5'];
const spot = (position: string) => (!position ? '–' : BENCH_SLOTS.includes(position) ? 'Bench' : position);

// One player's game: rating, where they played per quarter, and the coach's feedback.
export default function GamePlayerScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ game: string; player: string }>();
  const { games, players } = useData();
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

  return (
    <View style={[styles.page, { backgroundColor: c.chalk }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable
          style={[styles.round, { backgroundColor: c.surface }]}
          onPress={() => router.back()}
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

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, styles.row, { backgroundColor: c.surface }]}>
          <View style={[styles.score, { backgroundColor: rating?.score ? c.rating[rating.score - 1] : c.surface2 }]}>
            <Text style={[styles.scoreText, { color: rating?.score ? '#fff' : c.inkSoft }]}>{rating?.score ?? '–'}</Text>
          </View>
          <Text style={[styles.label, { color: c.ink }]}>
            {rating?.score ? RATING_LABELS[rating.score - 1] : 'Not rated yet'}
          </Text>
        </View>

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
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <Text style={[styles.feedback, { color: rating?.comment ? c.ink : c.inkSoft }]}>
            {rating?.comment || 'No feedback written yet.'}
          </Text>
        </View>
      </ScrollView>
    </View>
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
});
