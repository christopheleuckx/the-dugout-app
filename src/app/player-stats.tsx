import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useData } from '../lib/data';
import { goBack } from '../lib/nav';
import {
  playerStats,
  STAT_ABOUT,
  STAT_ORDER,
  STAT_TITLE,
  STAT_UNIT,
  valueOf,
  type PlayerStat,
  type Stat,
} from '../lib/playerStats';
import { fonts, useColors, type Colors } from '../lib/theme';

// How many of the latest games the strip under Games played shows.
const RECENT = 5;

const ICON: Record<Stat, keyof typeof Ionicons.glyphMap> = {
  games: 'trophy-outline',
  goals: 'football-outline',
  none: 'close-circle-outline',
  rotation: 'sync-outline',
  attendance: 'checkmark-done-outline',
};

// Player statistics: one statistic at a time, chosen from the title. Under
// Games played each row also shows the last five games, lit where he played.
export default function PlayerStatsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { players, games, goals, trainings } = useData();
  const [stat, setStat] = useState<Stat>('games');
  const [choosing, setChoosing] = useState(false);
  const [zeroOpen, setZeroOpen] = useState(false);

  const { stats, gameCount, trainingCount } = useMemo(() => playerStats(players, games, goals, trainings), [players, games, goals, trainings]);
  const sorted = useMemo(
    () =>
      stats
        .slice()
        .sort((a, b) => valueOf(b, stat) - valueOf(a, stat) || `${a.player.firstName} ${a.player.lastName}`.localeCompare(`${b.player.firstName} ${b.player.lastName}`)),
    [stats, stat],
  );
  // Games and attendance list everyone; the others hide the players at 0.
  const all = stat === 'games' || stat === 'attendance';
  const shown = all ? sorted : sorted.filter((s) => valueOf(s, stat) > 0);
  const zero = all ? [] : sorted.filter((s) => valueOf(s, stat) === 0);
  const total = stats.reduce((a, s) => a + valueOf(s, stat), 0);
  const subtitle =
    stat === 'games'
      ? `Total number of games: ${gameCount}`
      : stat === 'goals'
        ? `Total number of goals: ${total}`
        : stat === 'none'
          ? `Total times not selected: ${total}`
          : stat === 'attendance'
            ? `Total number of trainings: ${trainingCount}`
            : `Total number of rotations: ${total}`;

  // Equal values share a rank.
  const ranks = shown.map((s, i) => {
    let r = i;
    while (r > 0 && valueOf(shown[r - 1], stat) === valueOf(s, stat)) r--;
    return r + 1;
  });

  return (
    <View style={[styles.page, { backgroundColor: c.chalk }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={goBack} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <Text style={[styles.pageTitle, { color: c.ink }]}>Player statistics</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <Pressable style={styles.selector} onPress={() => setChoosing(true)} accessibilityRole="button" accessibilityLabel={`${STAT_TITLE[stat]}. Choose another statistic`} hitSlop={6}>
          <Text style={[styles.statTitle, { color: c.ink }]}>{STAT_TITLE[stat]}</Text>
          <View style={[styles.arrow, { backgroundColor: c.surface }]}>
            <Ionicons name="chevron-down" size={16} color={c.ink} />
          </View>
        </Pressable>
        <Text style={[styles.sub, { color: c.inkSoft }]}>{subtitle}</Text>

        {shown.length === 0 ? (
          <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 14, paddingVertical: 8 }}>Nothing to show yet.</Text>
        ) : (
          <View style={[styles.list, { backgroundColor: c.surface }]}>
            {shown.map((s, i) => {
              return <Row key={s.player.id} s={s} stat={stat} rank={ranks[i]} first={i === 0} c={c} />;
            })}
            {zero.length ? (
              <Pressable style={[styles.zero, { borderTopColor: c.line }]} onPress={() => setZeroOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: zeroOpen }}>
                <Text style={{ flex: 1, color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>
                  {zero.length} {zero.length === 1 ? 'player' : 'players'}: 0
                </Text>
                <Ionicons name={zeroOpen ? 'chevron-up' : 'chevron-down'} size={15} color={c.inkSoft} />
              </Pressable>
            ) : null}
            {zeroOpen ? (
              <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 12.5, paddingBottom: 12 }}>
                {zero.map((s) => `${s.player.firstName} ${s.player.lastName}`.trim()).join(', ')}
              </Text>
            ) : null}
          </View>
        )}
        <Text style={[styles.hint, { color: c.inkSoft }]}>Tap a player to open their profile</Text>
      </ScrollView>

      <Modal visible={choosing} transparent animationType="slide" onRequestClose={() => setChoosing(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setChoosing(false)} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 12 }]}>
          <View style={[styles.grabber, { backgroundColor: c.line }]} />
          <Text style={[styles.sheetTitle, { color: c.ink }]}>Player statistics</Text>
          <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13, marginBottom: 6 }}>Choose what to show</Text>
          {STAT_ORDER.map((st) => {
            const on = st === stat;
            return (
              <Pressable
                key={st}
                style={[styles.option, { borderTopColor: c.line }]}
                onPress={() => {
                  setStat(st);
                  setZeroOpen(false);
                  setChoosing(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <View style={[styles.optIcon, { backgroundColor: on ? c.pitch : c.surface2 }]}>
                  <Ionicons name={ICON[st]} size={20} color={on ? c.onPitch : c.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 16 }}>{STAT_TITLE[st]}</Text>
                  <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 12.5 }}>{STAT_ABOUT[st]}</Text>
                </View>
                {on ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Modal>
    </View>
  );
}

function subText(s: PlayerStat, stat: Stat, gameCount: number): string {
  if (stat === 'games') return `of ${gameCount} games`;
  if (stat === 'none') {
    const parts: string[] = [];
    if (s.injured) parts.push(`Injured ${s.injured}`);
    if (s.rotation) parts.push(`Rotation ${s.rotation}`);
    if (s.other) parts.push(`Other ${s.other}`);
    return parts.join(' · ');
  }
  if (stat === 'rotation') return `of ${s.notSelected} not selected`;
  if (stat === 'attendance') return `${s.attended} of ${s.trainings} trainings`;
  return `${s.games ? (s.goals / s.games).toFixed(2) : '0.00'} per game played`;
}

function Row({ s, stat, rank, first, c }: { s: PlayerStat; stat: Stat; rank: number; first: boolean; c: Colors }) {
  const name = `${s.player.firstName} ${s.player.lastName}`.trim();
  const initials = `${s.player.firstName[0] ?? ''}${s.player.lastName[0] ?? ''}`.toUpperCase();
  const v = valueOf(s, stat);
  return (
    <Pressable
      style={[styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}
      onPress={() => router.push({ pathname: '/squad-player', params: { id: s.player.id } })}
      accessibilityLabel={`${name}, ${v} ${STAT_UNIT[stat]}`}
    >
      <Text style={[styles.rank, { color: c.inkSoft }]}>{rank}</Text>
      <View style={[styles.avatar, { backgroundColor: c.surface2 }]}>
        <Text style={{ color: c.pitch, fontFamily: fonts.medium, fontSize: 12.5 }}>{initials}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 15 }} numberOfLines={1}>
          {name}
        </Text>
        {/* Games played only: the last five games, oldest first, lit where he played. */}
        {stat === 'games' ? (
          <View style={styles.strip}>
            {s.strip.slice(-RECENT).map((status, i) => (
              <View key={i} style={[styles.cell, { backgroundColor: status === 'played' ? c.pitch : c.surface2 }]} />
            ))}
          </View>
        ) : null}
        <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 12 }} numberOfLines={1}>
          {subText(s, stat, s.strip.length)}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', minWidth: 46 }}>
        <Text style={[styles.value, { color: c.ink }]}>{stat === 'attendance' ? `${v}%` : v}</Text>
        <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 10.5 }}>{STAT_UNIT[stat]}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 18 },
  content: { padding: 16, gap: 10 },
  selector: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingTop: 2 },
  statTitle: { fontFamily: fonts.medium, fontSize: 22 },
  arrow: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sub: { fontFamily: fonts.regular, fontSize: 13, marginTop: -4 },
  list: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  rank: { width: 20, textAlign: 'center', fontFamily: fonts.display, fontSize: 16 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  strip: { flexDirection: 'row', gap: 2 },
  cell: { flex: 1, height: 8, borderRadius: 2 },
  value: { fontFamily: fonts.display, fontSize: 28, lineHeight: 30 },
  zero: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, paddingBottom: 12 },
  hint: { fontFamily: fonts.regular, fontSize: 11.5, textAlign: 'center' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    shadowColor: '#0E1320',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 8 },
  sheetTitle: { fontFamily: fonts.medium, fontSize: 17, marginBottom: 2 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth },
  optIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
