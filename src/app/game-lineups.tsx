import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { onPitch, Pitch } from '../components/Pitch';
import { useData, type Player, type Team } from '../lib/data';
import { fonts, useColors } from '../lib/theme';

const spot = (position: string) => (onPitch(position) ? position : 'Bench');

type Moment = 'starting' | 'after10';

// One team's line-ups for a game: a page per quarter to swipe through, each
// with the pitch, the substitutes and the changes made after 10 minutes.
export default function GameLineupsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ game: string; team: Team }>();
  const { games, players } = useData();
  const game = games.find((g) => g.id === params.game);
  const lineups = game?.lineups[params.team] ?? [];
  const [page, setPage] = useState(0);
  const [moment, setMoment] = useState<Moment>('starting');

  // "Thibaut C." like shortName() in the web app.
  const short = (p: Player) => `${p.firstName}${p.lastName.trim() ? ` ${p.lastName.trim()[0]}.` : ''}`;
  const names = new Map(players.map((p) => [p.id, short(p)]));
  const color = params.team === 'red' ? c.teamRed : c.teamBlue;

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
        <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>
          Line-up and subs{lineups[page] ? ` ${lineups[page].label}` : ''}
        </Text>
        <Pressable
          style={[styles.round, { backgroundColor: c.surface }]}
          onPress={() => router.push({ pathname: '/game-lineup-edit', params: { game: params.game, team: params.team } })}
          accessibilityLabel="Edit line-ups"
          hitSlop={8}
        >
          <Ionicons name="create-outline" size={18} color={c.ink} />
        </Pressable>
      </View>

      {lineups.length > 1 ? (
        <View style={styles.dots}>
          {lineups.map((_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: c.line }, i === page && { width: 18, backgroundColor: c.pitch }]} />
          ))}
        </View>
      ) : null}

      <View style={[styles.toggle, { backgroundColor: c.surface2 }]}>
        {(['starting', 'after10'] as Moment[]).map((m) => (
          <Pressable key={m} style={[styles.toggleOption, m === moment && { backgroundColor: c.surface }]} onPress={() => setMoment(m)}>
            <Text style={{ color: m === moment ? c.ink : c.inkSoft, fontFamily: fonts.medium, fontSize: 14 }}>
              {m === 'starting' ? 'Start' : "After 10'"}
            </Text>
          </Pressable>
        ))}
      </View>

      {lineups.length === 0 ? (
        <Text style={[styles.sub, { color: c.inkSoft, textAlign: 'center', marginTop: 40 }]}>No line-up for this game yet.</Text>
      ) : (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {lineups.map((lineup, i) => {
            const bench = lineup.players.filter((p) => !onPitch(p[moment]));
            // What the coach has to act on: players coming on, going off, or
            // switching position. Staying on the bench (in another bench slot) is not listed.
            const changes = lineup.players.filter(
              (p) => p.starting !== p.after10 && (onPitch(p.starting) || onPitch(p.after10)),
            );
            return (
              <ScrollView key={i} style={{ width }} contentContainerStyle={styles.content}>
                <View style={styles.pitch}>
                  <Pitch
                    color={color}
                    slots={Object.fromEntries(
                      lineup.players.filter((p) => onPitch(p[moment])).map((p) => [p[moment], names.get(p.id) ?? '?']),
                    )}
                  />
                </View>

                <Text style={[styles.section, { color: c.ink }]}>Substitutes</Text>
                <View style={[styles.card, { backgroundColor: c.surface }]}>
                  <Text style={[styles.text, { color: bench.length ? c.ink : c.inkSoft }]}>
                    {bench.length ? bench.map((p) => names.get(p.id) ?? '?').join(', ') : 'No one on the bench.'}
                  </Text>
                </View>

                <Text style={[styles.section, { color: c.ink }]}>Changes after 10'</Text>
                <View style={[styles.card, { backgroundColor: c.surface, paddingVertical: 6 }]}>
                  {changes.length === 0 ? (
                    <Text style={[styles.text, { color: c.inkSoft, paddingVertical: 10 }]}>No changes.</Text>
                  ) : null}
                  {changes.map((p, n) => {
                    const kind = !onPitch(p.starting) ? 'in' : !onPitch(p.after10) ? 'out' : 'move';
                    const icon = { in: 'arrow-up', out: 'arrow-down', move: 'swap-horizontal' } as const;
                    const tint = { in: c.win, out: c.danger, move: c.inkSoft };
                    return (
                      <View key={p.id} style={[styles.change, n > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}>
                        <Ionicons name={icon[kind]} size={16} color={tint[kind]} />
                        <Text style={[styles.changeName, { color: c.ink }]} numberOfLines={1}>
                          {names.get(p.id) ?? '?'}
                        </Text>
                        <Text style={[styles.sub, { color: c.inkSoft }]}>
                          {spot(p.starting)} → {spot(p.after10)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 17 },
  sub: { fontFamily: fonts.regular, fontSize: 13 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 12 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  toggle: { flexDirection: 'row', alignSelf: 'center', borderRadius: 10, padding: 3, marginBottom: 4 },
  toggleOption: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 18 },
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  pitch: { borderRadius: 12, overflow: 'hidden' },
  section: { fontFamily: fonts.medium, fontSize: 19, marginTop: 12 },
  card: { borderRadius: 12, padding: 18 },
  text: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  change: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  changeName: { flex: 1, fontFamily: fonts.medium, fontSize: 15 },
});
