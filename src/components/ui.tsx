import type { ReactNode } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fmtDate, useData, type Game, type Training } from '../lib/data';
import { fonts, radius, useColors } from '../lib/theme';

// Page frame shared by every tab: light centred title bar, pull-to-refresh, and the
// loading / error states for the shared data load.
export function Screen({ title, left, children }: { title: string; left?: ReactNode; children: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { loading, error, refresh } = useData();

  return (
    <View style={{ flex: 1, backgroundColor: c.chalk }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.headerSide}>{left}</View>
        <Text style={[styles.headerTitle, { color: c.ink }]}>{title}</Text>
        <View style={styles.headerSide} />
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={c.pitch} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={c.pitch} />}
        >
          {error ? <Text style={{ color: c.danger }}>Could not load data: {error}</Text> : children}
        </ScrollView>
      )}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.sectionTitle, { color: c.ink }]}>{children}</Text>;
}

export function Card({ children }: { children: ReactNode }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>{children}</View>;
}

export function Empty({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={{ color: c.inkSoft, paddingVertical: 8 }}>{children}</Text>;
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function GameCard({ game }: { game: Game }) {
  const c = useColors();
  const resultColor = { W: c.win, D: c.amber, L: c.danger };
  const multi = game.scores.length > 1;

  return (
    <Card>
      <View style={styles.row}>
        {game.opponentLogoUrl ? (
          <Image source={{ uri: game.opponentLogoUrl }} style={styles.logo} resizeMode="contain" />
        ) : (
          <View style={[styles.logo, { backgroundColor: c.surface2, borderRadius: 18 }]} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>
            {game.opponent || 'Opponent to be confirmed'}
          </Text>
          <Text style={{ color: c.inkSoft }}>
            {fmtDate(game.date)}
            {game.time ? ` · ${game.time}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          {game.scores.map(({ team, score }) => (
            <Text key={team} style={[styles.score, { color: resultColor[score.result] }]}>
              {multi ? (team === 'blue' ? 'Blue ' : 'Red ') : ''}
              {score.home}–{score.away}
            </Text>
          ))}
        </View>
      </View>
      <View style={styles.badges}>
        <Badge label={game.homeAway} color={c.pitch} />
        <Badge label={game.competition} color={c.inkSoft} />
        {game.cancelStatus ? <Badge label={game.cancelStatus} color={c.danger} /> : null}
        {game.location ? (
          <Text style={{ color: c.inkSoft, flexShrink: 1 }} numberOfLines={1}>
            {game.location}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

export function TrainingCard({ training }: { training: Training }) {
  const c = useColors();
  const time = [training.startTime, training.endTime].filter(Boolean).join(' – ');

  return (
    <Card>
      <View style={styles.row}>
        <View style={[styles.stripe, { backgroundColor: c.training }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>
            {training.label}
          </Text>
          <Text style={{ color: c.inkSoft }}>
            {fmtDate(training.date)}
            {time ? ` · ${time}` : ''}
          </Text>
          {training.location ? <Text style={{ color: c.inkSoft }}>{training.location}</Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {training.cancelStatus ? <Badge label={training.cancelStatus} color={c.danger} /> : null}
          {training.absentCount > 0 ? (
            <Text style={{ color: c.inkSoft }}>{training.absentCount} absent</Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingBottom: 10, flexDirection: 'row', alignItems: 'center' },
  headerSide: { width: 36, height: 36, justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 19 },
  content: { padding: 16, gap: 10, paddingBottom: 120 },
  sectionTitle: { fontFamily: fonts.medium, fontSize: 19, marginTop: 12 },
  card: { borderRadius: radius, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 16, fontWeight: '600' },
  score: { fontFamily: fonts.display, fontSize: 20 },
  logo: { width: 36, height: 36 },
  stripe: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
});
