import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fmtDate, TEAM_RATING_LABELS, useData, type Team } from '../lib/data';
import { fonts, useColors } from '../lib/theme';

// One team's post-match report: rating, the opponent, notes per quarter,
// what went well and what to improve.
export default function GameReportScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ game: string; team: Team }>();
  const { games } = useData();
  const game = games.find((g) => g.id === params.game);
  const report = game?.reports[params.team];

  if (!game || !report) {
    return (
      <View style={[styles.page, { backgroundColor: c.chalk, paddingTop: insets.top + 60, alignItems: 'center' }]}>
        <Text style={{ color: c.inkSoft, fontFamily: fonts.regular }}>This report no longer exists.</Text>
      </View>
    );
  }

  const sections = [
    { title: 'About the opponent', text: report.opponent },
    ...report.quarterNotes.map((q) => ({ title: q.label, text: q.note })),
    { title: 'What went well', text: report.wentWell },
    { title: 'Points to improve', text: report.toImprove },
  ].filter((section) => section.text);

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
            Game report
          </Text>
          <Text style={[styles.sub, { color: c.inkSoft }]} numberOfLines={1}>
            {game.opponent || 'TBD'} · {fmtDate(game.date)}
            {game.teams.length > 1 ? ` · ${params.team === 'blue' ? 'Blue' : 'Red'}` : ''}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, styles.row, { backgroundColor: c.surface }]}>
          <View style={[styles.score, { backgroundColor: report.score ? c.rating[report.score - 1] : c.surface2 }]}>
            <Text style={[styles.scoreText, { color: report.score ? '#fff' : c.inkSoft }]}>{report.score ?? '–'}</Text>
          </View>
          <Text style={[styles.label, { color: c.ink }]}>
            {report.score ? TEAM_RATING_LABELS[report.score - 1] : 'Not rated yet'}
          </Text>
        </View>

        {sections.map((section, i) => (
          <View key={i} style={{ gap: 10 }}>
            <Text style={[styles.section, { color: c.ink }]}>{section.title}</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <Text style={[styles.text, { color: c.ink }]}>{section.text}</Text>
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
  title: { fontFamily: fonts.medium, fontSize: 17 },
  sub: { fontFamily: fonts.regular, fontSize: 13 },
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  card: { borderRadius: 12, padding: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  score: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  scoreText: { fontFamily: fonts.semi, fontSize: 24 },
  label: { fontFamily: fonts.medium, fontSize: 16 },
  section: { fontFamily: fonts.medium, fontSize: 19, marginTop: 12 },
  text: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
});
