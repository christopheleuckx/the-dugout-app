import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { useData, type Player, type QuarterLineup, type Team } from '../lib/data';
import { fonts, useColors } from '../lib/theme';

// Same pitch as pitchDiagram() in the web app: size, markings and where each
// position stands (percent of width and height, our goal at the bottom).
const W = 300;
const H = 420;
const TURF = '#3F7D4A';
const TURF_DARK = '#386F43';
const TURF_LINE = 'rgba(255,255,255,0.85)';
const PITCH_COORDS: Record<string, { x: number; y: number }> = {
  K: { x: 50, y: 90 },
  '4': { x: 38, y: 62 },
  '3': { x: 62, y: 62 },
  '10': { x: 40, y: 40 },
  '6': { x: 60, y: 40 },
  '11': { x: 28, y: 22 },
  '7': { x: 72, y: 22 },
  '9': { x: 50, y: 9 },
};
const onPitch = (position: string) => position in PITCH_COORDS;
const spot = (position: string) => (onPitch(position) ? position : 'Bench');

type Moment = 'starting' | 'after10';

function Pitch({ lineup, moment, names, color }: { lineup: QuarterLineup; moment: Moment; names: Map<string, string>; color: string }) {
  return (
    <Svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ aspectRatio: W / H }}>
      {Array.from({ length: 8 }, (_, i) => (
        <Rect key={i} x={0} y={(i * H) / 8} width={W} height={H / 8} fill={i % 2 === 0 ? TURF : TURF_DARK} />
      ))}
      <G fill="none" stroke={TURF_LINE} strokeWidth={2}>
        <Rect x={6} y={6} width={W - 12} height={H - 12} />
        <Line x1={6} y1={H / 2} x2={W - 6} y2={H / 2} />
        <Circle cx={W / 2} cy={H / 2} r={42} />
        <Rect x={W / 2 - 70} y={H - 70} width={140} height={64} />
        <Rect x={W / 2 - 32} y={H - 24} width={64} height={18} />
        <Rect x={W / 2 - 70} y={6} width={140} height={64} />
        <Rect x={W / 2 - 32} y={6} width={64} height={18} />
      </G>
      <Circle cx={W / 2} cy={H / 2} r={2.5} fill={TURF_LINE} />
      {lineup.players
        .filter((p) => onPitch(p[moment]))
        .map((p) => {
          const cx = (PITCH_COORDS[p[moment]].x / 100) * W;
          const cy = (PITCH_COORDS[p[moment]].y / 100) * H;
          return (
            <G key={p.id}>
              <Circle cx={cx} cy={cy} r={16} fill={color} stroke="#fff" strokeWidth={2} />
              <SvgText x={cx} y={cy + 5} textAnchor="middle" fontSize={13} fontWeight="800" fill="#fff">
                {p[moment]}
              </SvgText>
              {/* Narrower than on the web so the two central labels don't overlap. */}
              <Rect x={cx - 29} y={cy + 21} width={58} height={17} rx={4} fill="rgba(10,14,22,0.82)" />
              <SvgText x={cx} y={cy + 33} textAnchor="middle" fontSize={9} fontWeight="700" fill="#fff">
                {names.get(p.id) ?? '?'}
              </SvgText>
            </G>
          );
        })}
    </Svg>
  );
}

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
        <View style={{ width: 36 }} />
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
            const changes = lineup.players.filter((p) => p.starting !== p.after10);
            return (
              <ScrollView key={i} style={{ width }} contentContainerStyle={styles.content}>
                <View style={styles.pitch}>
                  <Pitch lineup={lineup} moment={moment} names={names} color={color} />
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
                    // Coming on, going off, or moving to another position.
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
