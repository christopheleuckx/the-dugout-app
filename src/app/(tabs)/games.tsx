import { useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { isPlayed, MatchCard } from '../../components/MatchCard';
import { Empty, Screen, SectionTitle } from '../../components/ui';
import { todayIso, useData } from '../../lib/data';
import { useColors } from '../../lib/theme';

const monthTitle = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

// The whole season as one calendar, oldest first, with a title per month.
// It opens with the last played game at the top and the next game right
// below it: scroll up for results, down for what's coming.
export default function Games() {
  const c = useColors();
  const { games } = useData();
  const today = todayIso();
  const scrollRef = useRef<ScrollView>(null);
  const opened = useRef(false);

  const sorted = games
    .slice()
    .sort((a, b) => ((a.date ?? '9999') + (a.time ?? '')).localeCompare((b.date ?? '9999') + (b.time ?? '')));
  const next = sorted.find((g) => g.date && g.date >= today && !g.cancelStatus && !isPlayed(g, today));
  // The page opens on the game just before the next one (or, with no game
  // left to play, on the most recent one).
  const nextIndex = next ? sorted.indexOf(next) : sorted.filter((g) => g.date).length;
  const anchorId = sorted[Math.max(0, nextIndex - 1)]?.id;

  return (
    <View style={{ flex: 1 }}>
    <Screen title="Games" scrollRef={scrollRef}>
      {sorted.length === 0 ? <Empty>No games planned.</Empty> : null}
      {sorted.map((g, i) => {
        const month = g.date ? g.date.slice(0, 7) : '';
        const newMonth = i === 0 || month !== (sorted[i - 1].date ?? '').slice(0, 7);
        return (
          <View
            key={g.id}
            style={{ gap: 10 }}
            onLayout={(e) => {
              if (g.id !== anchorId || opened.current) return;
              opened.current = true;
              scrollRef.current?.scrollTo({ y: e.nativeEvent.layout.y - 8, animated: false });
            }}
          >
            {newMonth ? <SectionTitle>{g.date ? monthTitle(g.date) : 'No date yet'}</SectionTitle> : null}
            <Pressable onPress={() => router.push(`/game/${g.id}`)}>
              <MatchCard
                game={g}
                today={today}
                variant={g.id === next?.id ? 'next' : isPlayed(g, today) ? 'played' : 'upcoming'}
              />
            </Pressable>
          </View>
        );
      })}
    </Screen>
      <Pressable
        style={[styles.add, { backgroundColor: c.pitch }]}
        onPress={() => router.push('/game-new')}
        accessibilityLabel="New game"
      >
        <Ionicons name="add" size={28} color={c.onPitch} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Floats above the tab bar.
  add: {
    position: 'absolute',
    right: 18,
    bottom: 104,
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
