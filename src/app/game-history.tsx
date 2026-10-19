import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HistoryCard, pastMeetings } from '../components/HistoryCard';
import { useData } from '../lib/data';
import { goBack } from '../lib/nav';
import { fonts, useColors } from '../lib/theme';

// Every earlier game against the opponent of a game, newest first. A card
// opens that game.
export default function GameHistoryScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { game: id } = useLocalSearchParams<{ game: string }>();
  const { games, clubName, clubLogoUrl } = useData();
  const game = games.find((g) => g.id === id);
  const meetings = game ? pastMeetings(games, game) : [];

  return (
    <View style={[styles.page, { backgroundColor: c.chalk }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={goBack} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>
            vs {game?.opponent || 'Opponent'}
          </Text>
          <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>
            {meetings.length} {meetings.length === 1 ? 'game' : 'games'}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {meetings.length === 0 ? <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 14 }}>No earlier games against this club.</Text> : null}
        {meetings.map((g) => (
          <HistoryCard key={g.id} game={g} clubName={clubName} clubLogoUrl={clubLogoUrl} onPress={() => router.push(`/game/${g.id}`)} />
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
  content: { padding: 16, gap: 10, paddingBottom: 48 },
});
