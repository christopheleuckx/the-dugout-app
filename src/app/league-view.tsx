import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Crest } from '../components/MatchCard';
import { Swimlane } from '../components/Swimlane';
import { fmtDate, useData } from '../lib/data';
import { currentMatchday, loadLeagues, standings, type League, type Row } from '../lib/leagues';
import { goBack } from '../lib/nav';
import { brand, fonts, useColors } from '../lib/theme';

// The figures of the table, in the order they scroll past. Points and games
// played come first, so they are on screen without swiping.
const COLUMNS: { key: string; label: string; meaning: string; value: (r: Row) => string | number }[] = [
  { key: 'points', label: 'Pts', meaning: 'Points', value: (r) => r.points },
  { key: 'played', label: 'P', meaning: 'Played', value: (r) => r.played },
  { key: 'wins', label: 'W', meaning: 'Won', value: (r) => r.wins },
  { key: 'draws', label: 'D', meaning: 'Drawn', value: (r) => r.draws },
  { key: 'losses', label: 'L', meaning: 'Lost', value: (r) => r.losses },
  { key: 'goals_for', label: 'GS', meaning: 'Goals scored', value: (r) => r.goals_for },
  { key: 'goals_against', label: 'GC', meaning: 'Goals conceded', value: (r) => r.goals_against },
  { key: 'goal_difference', label: '+/-', meaning: 'Goal difference', value: (r) => (r.goal_difference > 0 ? `+${r.goal_difference}` : r.goal_difference) },
];
const ROW = 46;
const COL = 44;

// One competition for reading: every matchday in a lane (opening on the
// matchday of the moment) and the full table under it.
export default function LeagueViewScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me, competitors, clubName, clubLogoUrl, games } = useData();
  const groupId = me?.activeAgeGroup?.id;
  const [league, setLeague] = useState<League | null | undefined>(undefined);

  const load = useCallback(async () => {
    if (!groupId) return setLeague(null);
    const found = await loadLeagues(groupId, competitors, clubName, clubLogoUrl, id);
    setLeague(found?.[0] ?? null);
  }, [groupId, competitors, clubName, clubLogoUrl, id]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };
  const days = league?.days.filter((d) => d.matches.length) ?? [];
  const teamOf = new Map((league?.teams ?? []).map((t) => [t.id, t]));
  const table = league ? standings(league) : [];
  const cardWidth = days.length > 1 ? Math.round(width * 0.86) : width - 32;

  const side = (teamId: string, goals: number | null, won: boolean) => {
    const team = teamOf.get(teamId);
    return (
      <View style={styles.side}>
        <Crest url={team?.logoUrl ?? null} name={team?.name ?? '?'} size={26} />
        <Text style={{ flex: 1, color: c.ink, fontFamily: team?.own || won ? fonts.semi : fonts.regular, fontSize: 15 }} numberOfLines={1}>
          {team?.name ?? '?'}
        </Text>
        {goals !== null ? <Text style={{ color: c.ink, fontFamily: won ? fonts.semi : fonts.regular, fontSize: 16, width: 22, textAlign: 'right' }}>{goals}</Text> : null}
      </View>
    );
  };

  return (
    <View style={[styles.page, { backgroundColor: c.chalk }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={goBack} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>
          {league?.name ?? 'Competition'}
        </Text>
        <Pressable
          style={[styles.round, { backgroundColor: c.surface }]}
          onPress={() => league && router.push({ pathname: '/league', params: { id: league.id } })}
          accessibilityLabel="Edit the competition"
          hitSlop={8}
        >
          <Ionicons name="settings-outline" size={18} color={c.ink} />
        </Pressable>
      </View>

      {league === undefined ? (
        <ActivityIndicator color={c.pitch} style={{ marginTop: 24 }} />
      ) : league === null ? (
        <Text style={[styles.note, { color: c.inkSoft, margin: 16 }]}>This competition is not part of the team you are working in.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.section, { color: c.ink }]}>Games</Text>
          {days.length === 0 ? <Text style={[styles.note, { color: c.inkSoft }]}>No matches yet. Add them with the gear in the top right.</Text> : null}
          {days.length ? (
            <Swimlane cardWidth={cardWidth} initialIndex={currentMatchday(days)}>
              {days.map((d) => (
                <View key={d.id} style={[styles.card, { backgroundColor: c.surface }]}>
                  <View style={[styles.head, { backgroundColor: brand.navy }]}>
                    <Text style={styles.headText}>Matchday {d.number}</Text>
                  </View>
                  {d.matches.map((m, i) => {
                    const played = m.homeGoals !== null && m.awayGoals !== null;
                    const ours = teamOf.get(m.home)?.own || teamOf.get(m.away)?.own;
                    const game = ours ? games.find((g) => g.leagueMatchId === m.id) : undefined;
                    return (
                      <Pressable key={m.id} style={[styles.match, i > 0 && line, ours && { backgroundColor: c.surface2 }]} disabled={!game} onPress={() => game && router.push(`/game/${game.id}`)}>
                        <View style={{ flex: 1, gap: 8 }}>
                          {side(m.home, played ? m.homeGoals : null, played && m.homeGoals! > m.awayGoals!)}
                          {side(m.away, played ? m.awayGoals : null, played && m.awayGoals! > m.homeGoals!)}
                        </View>
                        {played ? null : (
                          <View style={[styles.when, { borderLeftColor: c.line }]}>
                            <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>{m.date ? fmtDate(m.date).slice(4) : 'No date'}</Text>
                            <Text style={{ color: c.ink, fontFamily: fonts.semi, fontSize: 16 }}>{m.time ?? '–'}</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </Swimlane>
          ) : null}

          <Text style={[styles.section, { color: c.ink, marginTop: 8 }]}>League table</Text>
          {/* The clubs stay put on the left; the figures scroll sideways. */}
          <View style={[styles.card, styles.table, { backgroundColor: c.surface }]}>
            <View style={{ flex: 1 }}>
              <View style={[styles.cellRow, { backgroundColor: brand.navy, paddingLeft: 12 }]}>
                <Text style={[styles.headText, { width: 22, textAlign: 'center' }]}>#</Text>
                <Text style={[styles.headText, { marginLeft: 8 }]}>Club</Text>
              </View>
              {table.map((row, i) => (
                <View key={row.team.id} style={[styles.cellRow, { paddingLeft: 12, gap: 8 }, i > 0 && line, row.team.own && { backgroundColor: c.surface2 }]}>
                  <Text style={{ width: 22, textAlign: 'center', color: c.ink, fontFamily: fonts.medium, fontSize: 13 }}>{i + 1}</Text>
                  <Crest url={row.team.logoUrl} name={row.team.name} size={22} />
                  <Text style={{ flex: 1, color: c.ink, fontFamily: row.team.own ? fonts.semi : fonts.regular, fontSize: 14 }} numberOfLines={1}>
                    {row.team.name}
                  </Text>
                </View>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: COL * 4, flexGrow: 0 }} bounces={false}>
              <View>
                <View style={[styles.cellRow, { backgroundColor: brand.navy }]}>
                  {COLUMNS.map((col) => (
                    <Text key={col.key} style={[styles.headText, styles.figure]}>
                      {col.label}
                    </Text>
                  ))}
                </View>
                {table.map((row, i) => (
                  <View key={row.team.id} style={[styles.cellRow, i > 0 && line, row.team.own && { backgroundColor: c.surface2 }]}>
                    {COLUMNS.map((col) => (
                      <Text key={col.key} style={[styles.figure, { color: c.ink, fontFamily: col.key === 'points' ? fonts.semi : fonts.regular, fontSize: 14 }]}>
                        {col.value(row)}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
          <Text style={[styles.note, { color: c.inkSoft }]}>Swipe the figures sideways for more. {COLUMNS.map((col) => `${col.label} ${col.meaning.toLowerCase()}`).join(' · ')}.</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 17 },
  content: { padding: 16, gap: 10, paddingBottom: 60 },
  section: { fontFamily: fonts.medium, fontSize: 19 },
  note: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, marginHorizontal: 4 },
  card: { borderRadius: 14, overflow: 'hidden' },
  head: { paddingHorizontal: 16, paddingVertical: 10 },
  headText: { color: '#fff', fontFamily: fonts.semi, fontSize: 13, letterSpacing: 0.4 },
  match: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  side: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  when: { width: 74, alignItems: 'center', gap: 2, borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: 10 },
  table: { flexDirection: 'row' },
  cellRow: { height: ROW, flexDirection: 'row', alignItems: 'center' },
  figure: { width: COL, textAlign: 'center' },
});
