import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Crest } from '../components/MatchCard';
import { fmtDate, useData } from '../lib/data';
import { currentMatchday, loadLeagues, standings, type League, type Row } from '../lib/leagues';
import { goBack } from '../lib/nav';
import { shortName } from '../lib/opponents';
import { fonts, useColors } from '../lib/theme';

// The figures of the table, in the order they scroll past: the first four
// are on screen, the rest comes with a swipe.
const COLUMNS: { key: string; label: string; meaning: string; value: (r: Row) => string | number }[] = [
  { key: 'played', label: 'P', meaning: 'played', value: (r) => r.played },
  { key: 'wins', label: 'W', meaning: 'won', value: (r) => r.wins },
  { key: 'goal_difference', label: 'GD', meaning: 'goal difference', value: (r) => r.goal_difference },
  { key: 'points', label: 'Pts', meaning: 'points', value: (r) => r.points },
  { key: 'draws', label: 'D', meaning: 'drawn', value: (r) => r.draws },
  { key: 'losses', label: 'L', meaning: 'lost', value: (r) => r.losses },
  { key: 'goals_for', label: 'GS', meaning: 'goals scored', value: (r) => r.goals_for },
  { key: 'goals_against', label: 'GC', meaning: 'goals conceded', value: (r) => r.goals_against },
];
const ROW = 46;
const COL = 40;

// One competition for reading: the matchday of the moment, with arrows (or a
// swipe) to the others, and the full table under it.
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
  const pageWidth = width - 32;

  // The matchday on show: the one of the moment first, then wherever the
  // arrows or a swipe lead.
  const pager = useRef<ScrollView>(null);
  const [index, setIndex] = useState<number | null>(null);
  const start = days.length ? currentMatchday(days) : 0;
  const shown = index ?? start;
  useEffect(() => {
    if (index === null && days.length) setTimeout(() => pager.current?.scrollTo({ x: start * pageWidth, animated: false }), 0);
  }, [index, days.length, start, pageWidth]);
  const go = (to: number) => {
    if (to < 0 || to >= days.length) return;
    setIndex(to);
    pager.current?.scrollTo({ x: to * pageWidth, animated: true });
  };
  const day = days[shown];
  const dates = day ? [...new Set(day.matches.map((m) => m.date).filter((d): d is string => !!d))].sort() : [];
  const range = dates.length === 0 ? 'No dates yet' : dates.length === 1 ? fmtDate(dates[0]) : `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}`;

  // Our form: the last five league matches we played, oldest first.
  const own = league?.teams.find((t) => t.own);
  const form = own
    ? (league?.days ?? [])
        .flatMap((d) => d.matches)
        .filter((m) => (m.home === own.id || m.away === own.id) && m.homeGoals !== null && m.awayGoals !== null)
        .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
        .slice(-5)
        .map((m) => {
          const ours = m.home === own.id ? m.homeGoals! : m.awayGoals!;
          const theirs = m.home === own.id ? m.awayGoals! : m.homeGoals!;
          const opponent = teamOf.get(m.home === own.id ? m.away : m.home);
          return { id: m.id, result: ours > theirs ? 'W' : ours < theirs ? 'L' : 'D', score: `${ours}-${theirs}`, opponent };
        })
    : [];
  const formColor = { W: c.win, D: c.amber, L: c.danger } as Record<string, string>;

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
          {days.length === 0 ? <Text style={[styles.note, { color: c.inkSoft }]}>No matches yet. Add them with the gear in the top right.</Text> : null}
          {own && form.length && league.showStandings ? (
            <View style={[styles.card, styles.form, { backgroundColor: c.surface }]}>
              <Crest url={own.logoUrl} name={own.name} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontFamily: fonts.semi, fontSize: 15 }}>{own.name}</Text>
                <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>Form, last {form.length === 1 ? 'match' : `${form.length} matches`}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {form.map((f) => (
                  <View key={f.id} style={[styles.result, { backgroundColor: formColor[f.result] }]} accessibilityLabel={`${f.result} ${f.score} against ${f.opponent?.name ?? '?'}`}>
                    <Text style={{ color: '#fff', fontFamily: fonts.semi, fontSize: 13 }}>{f.result}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {day ? (
            <>
              <View style={[styles.week, { marginTop: 8 }]}>
                <Pressable style={[styles.arrow, { backgroundColor: c.surface }, shown === 0 && { opacity: 0.35 }]} onPress={() => go(shown - 1)} disabled={shown === 0} accessibilityLabel="Previous matchday" hitSlop={8}>
                  <Ionicons name="chevron-back" size={20} color={c.ink} />
                </Pressable>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: c.ink, fontFamily: fonts.semi, fontSize: 20 }}>Matchday {day.number}</Text>
                  <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 14 }}>{range}</Text>
                </View>
                <Pressable
                  style={[styles.arrow, { backgroundColor: c.surface }, shown === days.length - 1 && { opacity: 0.35 }]}
                  onPress={() => go(shown + 1)}
                  disabled={shown === days.length - 1}
                  accessibilityLabel="Next matchday"
                  hitSlop={8}
                >
                  <Ionicons name="chevron-forward" size={20} color={c.ink} />
                </Pressable>
              </View>

              <ScrollView
                ref={pager}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={32}
                onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / pageWidth))}
                // Whenever the matches are (re)drawn, the lane goes back to the matchday in the title.
                onContentSizeChange={() => pager.current?.scrollTo({ x: shown * pageWidth, animated: false })}
              >
                {days.map((d) => {
                  return (
                    <View key={d.id} style={{ width: pageWidth }}>
                      <View style={[styles.card, { backgroundColor: c.surface, paddingHorizontal: 14, paddingVertical: 4 }]}>
                        {d.matches.map((m, i) => {
                          const played = m.homeGoals !== null && m.awayGoals !== null;
                          const home = teamOf.get(m.home);
                          const away = teamOf.get(m.away);
                          const game = home?.own || away?.own ? games.find((x) => x.leagueMatchId === m.id) : undefined;
                          return (
                            <Pressable key={m.id} style={[styles.fixture, i > 0 && line]} disabled={!game} onPress={() => game && router.push(`/game/${game.id}`)}>
                              <Text style={[styles.club, { textAlign: 'right', color: c.ink, fontFamily: home?.own ? fonts.semi : fonts.medium }]} numberOfLines={1}>
                                {shortName(home?.name ?? '?')}
                              </Text>
                              <Crest url={home?.logoUrl ?? null} name={home?.name ?? '?'} size={26} />
                              {/* A match to come has its day on top of the kick-off; a played one only its score, centred. */}
                              <View style={styles.middle}>
                                {played ? null : <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 12 }}>{m.date ? fmtDate(m.date) : 'No date'}</Text>}
                                {played ? (
                                  <View style={[styles.score, { backgroundColor: c.surface2 }]}>
                                    <Text style={{ color: c.ink, fontFamily: fonts.semi, fontSize: 16 }}>
                                      {m.homeGoals} - {m.awayGoals}
                                    </Text>
                                  </View>
                                ) : (
                                  <View style={styles.score}>
                                    <Text style={{ color: c.ink, fontFamily: fonts.semi, fontSize: 16 }}>{m.time ?? '–'}</Text>
                                  </View>
                                )}
                              </View>
                              <Crest url={away?.logoUrl ?? null} name={away?.name ?? '?'} size={26} />
                              <Text style={[styles.club, { color: c.ink, fontFamily: away?.own ? fonts.semi : fonts.medium }]} numberOfLines={1}>
                                {shortName(away?.name ?? '?')}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          {league.showStandings ? (
            <>
              <Text style={[styles.section, { color: c.ink }]}>Standings</Text>
              {/* The clubs stay put on the left; the figures scroll sideways. */}
              <View style={[styles.card, styles.table, { backgroundColor: c.surface }]}>
                <View style={{ flex: 1 }}>
                  <View style={[styles.cellRow, { paddingLeft: 12, gap: 8 }]}>
                    <Text style={[styles.th, { width: 26, textAlign: 'center', color: c.inkSoft }]}>Pos</Text>
                    <Text style={[styles.th, { color: c.inkSoft, marginLeft: 32 }]}>Team</Text>
                  </View>
                  {table.map((row, i) => (
                    <View key={row.team.id} style={[styles.cellRow, { paddingLeft: 12, gap: 8 }, line]}>
                      {row.team.own ? <View style={[styles.mark, { backgroundColor: c.pitch }]} /> : null}
                      <Text style={{ width: 26, textAlign: 'center', color: c.ink, fontFamily: fonts.semi, fontSize: 14 }}>{i + 1}</Text>
                      <Crest url={row.team.logoUrl} name={row.team.name} size={24} />
                      <Text style={{ flex: 1, color: c.ink, fontFamily: row.team.own ? fonts.semi : fonts.medium, fontSize: 14 }} numberOfLines={1}>
                        {shortName(row.team.name)}
                      </Text>
                    </View>
                  ))}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: COL * 4, flexGrow: 0 }} bounces={false}>
                  <View>
                    <View style={styles.cellRow}>
                      {COLUMNS.map((col) => (
                        <Text key={col.key} style={[styles.th, styles.figure, { color: c.inkSoft }]}>
                          {col.label}
                        </Text>
                      ))}
                    </View>
                    {table.map((row) => (
                      <View key={row.team.id} style={[styles.cellRow, line]}>
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
              <Text style={[styles.note, { color: c.inkSoft, textAlign: 'center' }]}>
                Swipe the figures for{' '}
                {COLUMNS.slice(4)
                  .map((col) => `${col.label} (${col.meaning})`)
                  .join(', ')}
                .
              </Text>
            </>
          ) : null}
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
  section: { fontFamily: fonts.medium, fontSize: 19, marginTop: 8 },
  note: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, marginHorizontal: 4 },
  card: { borderRadius: 14, overflow: 'hidden' },
  form: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  result: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28, marginBottom: 4 },
  arrow: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  // A fixed height, the same with or without the date line.
  fixture: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 68 },
  club: { flex: 1, fontSize: 14 },
  middle: { width: 76, alignItems: 'center', justifyContent: 'center', gap: 3 },
  // The same box for a score and a kick-off, so every matchday is equally tall.
  score: { width: 60, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  th: { fontFamily: fonts.regular, fontSize: 13 },
  mark: { position: 'absolute', left: 0, width: 4, height: 24, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  table: { flexDirection: 'row' },
  cellRow: { height: ROW, flexDirection: 'row', alignItems: 'center' },
  figure: { width: COL, textAlign: 'center' },
});
