import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { fmtDate, useData } from '../lib/data';
import { currentMatchday, loadLeagues, standings, type League, type Match } from '../lib/leagues';
import { brand, fonts, useColors } from '../lib/theme';
import { Crest } from './MatchCard';
import { Swimlane } from './Swimlane';
import { SectionTitle } from './ui';

// On Home: the competitions of the team on show. Per competition the matchday
// of the moment and the table under it.
export function LeagueHome() {
  const c = useColors();
  const { me, competitors, clubName, clubLogoUrl, games } = useData();
  const groupId = me?.activeAgeGroup?.id;
  const [leagues, setLeagues] = useState<League[]>([]);

  const load = useCallback(async () => {
    if (!groupId) return setLeagues([]);
    const found = await loadLeagues(groupId, competitors, clubName, clubLogoUrl);
    if (found) setLeagues(found);
  }, [groupId, competitors, clubName, clubLogoUrl]);
  // Fresh whenever Home comes back on show, after a team switch or an edit.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };
  const { width } = useWindowDimensions();
  const cardWidth = Math.round(width * 0.66);

  return (
    <>
      {leagues
        .filter((l) => l.days.some((d) => d.matches.length))
        .map((league) => {
          const teamOf = new Map(league.teams.map((t) => [t.id, t]));
          const days = league.days.filter((d) => d.matches.length);
          const shown = days[currentMatchday(days)];
          const isOurs = (m: Match) => !!(teamOf.get(m.home)?.own || teamOf.get(m.away)?.own);
          const table = standings(league);
          const side = (id: string, goals: number | null, won: boolean) => {
            const team = teamOf.get(id);
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
            <View key={league.id} style={{ gap: 10 }}>
              <Pressable style={styles.title} onPress={() => router.push({ pathname: '/league-view', params: { id: league.id } })} accessibilityLabel={`Open ${league.name}`}>
                <SectionTitle>{league.name}</SectionTitle>
                <View style={{ flex: 1 }} />
                <Text style={{ color: c.pitch, fontFamily: fonts.medium, fontSize: 14 }}>All games</Text>
                <Ionicons name="chevron-forward" size={16} color={c.pitch} />
              </Pressable>
              {/* One card per match, our own first. */}
              <Swimlane
                cardWidth={cardWidth}
                leadWidth={76}
                lead={
                  <View style={[styles.day, { backgroundColor: brand.navy }]}>
                    <Text style={styles.dayLabel}>Matchday</Text>
                    <Text style={styles.dayNumber}>{shown.number}</Text>
                  </View>
                }
              >
                {shown.matches
                  .slice()
                  .sort((x, y) => Number(isOurs(y)) - Number(isOurs(x)))
                  .map((m) => {
                    const played = m.homeGoals !== null && m.awayGoals !== null;
                    const ours = isOurs(m);
                    const game = ours ? games.find((g) => g.leagueMatchId === m.id) : undefined;
                    return (
                      <Pressable
                        key={m.id}
                        style={[styles.card, styles.match, { backgroundColor: c.surface }]}
                        disabled={!game}
                        onPress={() => game && router.push(`/game/${game.id}`)}
                      >
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
              </Swimlane>

              <View style={[styles.card, { backgroundColor: c.surface }]}>
                <View style={[styles.head, { backgroundColor: brand.navy }]}>
                  <Text style={styles.headText}>Standings</Text>
                </View>
                {table.map((row, i) => (
                  <View key={row.team.id} style={[styles.tableRow, i > 0 && line, row.team.own && { backgroundColor: c.surface2 }]}>
                    <Text style={[styles.pos, { color: c.ink }]}>{i + 1}</Text>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Crest url={row.team.logoUrl} name={row.team.name} size={22} />
                      <Text style={{ flex: 1, color: c.ink, fontFamily: row.team.own ? fonts.semi : fonts.regular, fontSize: 14 }} numberOfLines={1}>
                        {row.team.name}
                      </Text>
                    </View>
                    <Text style={[styles.cell, { color: c.ink }]}>{row.played}</Text>
                    <Text style={[styles.cell, { color: c.ink, fontFamily: fonts.semi }]}>{row.points}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
    </>
  );
}

const styles = StyleSheet.create({
  title: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  card: { borderRadius: 14, overflow: 'hidden' },
  day: { flex: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dayLabel: { color: '#B5C7EA', fontFamily: fonts.regular, fontSize: 12 },
  dayNumber: { color: '#fff', fontFamily: fonts.semi, fontSize: 30, lineHeight: 34 },
  head: { paddingHorizontal: 16, paddingVertical: 10 },
  headText: { color: '#fff', fontFamily: fonts.semi, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase' },
  match: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  side: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  when: { width: 74, alignItems: 'center', gap: 2, borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: 10 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, gap: 4 },
  pos: { width: 20, fontFamily: fonts.medium, fontSize: 13, textAlign: 'center' },
  cell: { width: 40, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center' },
});
