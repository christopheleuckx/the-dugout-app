import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { fmtDate, toIso, useData } from '../lib/data';
import { supabase } from '../lib/supabase';
import { brand, fonts, useColors } from '../lib/theme';
import { Crest } from './MatchCard';
import { Swimlane } from './Swimlane';
import { SectionTitle } from './ui';

type Team = { id: string; own: boolean; name: string; logoUrl: string | null };
type Match = { id: string; home: string; away: string; date: string | null; time: string | null; homeGoals: number | null; awayGoals: number | null };
type Matchday = { id: string; number: number; matches: Match[] };
type League = { id: string; name: string; win: number; draw: number; loss: number; ranking: string[]; teams: Team[]; days: Matchday[] };
type Row = { team: Team; played: number; wins: number; draws: number; losses: number; goals_for: number; goals_against: number; goal_difference: number; points: number };

// The table: every played match counts for both clubs, and the clubs are
// ordered by the competition's own rules, first line first.
function standings(league: League): Row[] {
  const rows = new Map<string, Row>(
    league.teams.map((team) => [team.id, { team, played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, goal_difference: 0, points: 0 }]),
  );
  for (const day of league.days) {
    for (const m of day.matches) {
      if (m.homeGoals === null || m.awayGoals === null) continue;
      for (const [id, scored, conceded] of [
        [m.home, m.homeGoals, m.awayGoals],
        [m.away, m.awayGoals, m.homeGoals],
      ] as [string, number, number][]) {
        const row = rows.get(id);
        if (!row) continue;
        row.played += 1;
        row.goals_for += scored;
        row.goals_against += conceded;
        if (scored > conceded) row.wins += 1;
        else if (scored === conceded) row.draws += 1;
        else row.losses += 1;
      }
    }
  }
  for (const row of rows.values()) {
    row.goal_difference = row.goals_for - row.goals_against;
    row.points = row.wins * league.win + row.draws * league.draw + row.losses * league.loss;
  }
  // Higher is better for everything except goals conceded.
  const value = (row: Row, key: string) => (key === 'goals_against' ? -row.goals_against : ((row as unknown as Record<string, number>)[key] ?? 0));
  return [...rows.values()].sort((a, b) => {
    for (const key of league.ranking) {
      const diff = value(b, key) - value(a, key);
      if (diff) return diff;
    }
    return a.team.name.localeCompare(b.team.name);
  });
}

// The matchday on show changes on Wednesday: until then the weekend that was
// just played (its results), from Wednesday on the next one to be played.
function lastWednesday() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 4) % 7));
  return toIso(d);
}

// On Home: the competitions of the team on show. Per competition the matchday
// of the moment and the table under it.
export function LeagueHome() {
  const c = useColors();
  const { me, competitors, clubName, clubLogoUrl, games } = useData();
  const groupId = me?.activeAgeGroup?.id;
  const [leagues, setLeagues] = useState<League[]>([]);

  const load = useCallback(async () => {
    if (!groupId) return setLeagues([]);
    const { data, error } = await supabase
      .from('leagues')
      .select(
        'id, name, points_win, points_draw, points_loss, ranking, league_teams(id, competitor_id, is_own_team), league_matchdays(id, number, league_matches(id, home_team_id, away_team_id, match_date, kickoff, home_goals, away_goals, position))',
      )
      .eq('age_group_id', groupId)
      .order('name');
    if (error) return;
    setLeagues(
      (data ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        win: l.points_win,
        draw: l.points_draw,
        loss: l.points_loss,
        ranking: Array.isArray(l.ranking) ? (l.ranking as string[]) : ['points'],
        teams: (l.league_teams ?? []).map((t) => {
          const opponent = competitors.find((x) => x.id === t.competitor_id);
          return { id: t.id, own: t.is_own_team, name: t.is_own_team ? clubName : (opponent?.name ?? 'Unknown'), logoUrl: t.is_own_team ? clubLogoUrl : (opponent?.logoUrl ?? null) };
        }),
        days: (l.league_matchdays ?? [])
          .slice()
          .sort((a, b) => a.number - b.number)
          .map((d) => ({
            id: d.id,
            number: d.number,
            matches: (d.league_matches ?? [])
              .slice()
              .sort((a, b) => ((a.match_date ?? '') + (a.kickoff ?? '')).localeCompare((b.match_date ?? '') + (b.kickoff ?? '')) || a.position - b.position)
              .map((m) => ({
                id: m.id,
                home: m.home_team_id,
                away: m.away_team_id,
                date: m.match_date ?? null,
                time: m.kickoff ? String(m.kickoff).slice(0, 5) : null,
                homeGoals: m.home_goals ?? null,
                awayGoals: m.away_goals ?? null,
              })),
          })),
      })),
    );
  }, [groupId, competitors, clubName, clubLogoUrl]);
  // Fresh whenever Home comes back on show, after a team switch or an edit.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };
  const { width } = useWindowDimensions();
  const cardWidth = Math.round(width * 0.7);

  return (
    <>
      {leagues
        .filter((l) => l.days.some((d) => d.matches.length))
        .map((league) => {
          const teamOf = new Map(league.teams.map((t) => [t.id, t]));
          const days = league.days.filter((d) => d.matches.length);
          // The first matchday that ends on or after the last Wednesday; when
          // the season is over, the last one. Matchdays without dates count as still to come.
          const since = lastWednesday();
          const lastDate = (d: Matchday) => d.matches.reduce((max, m) => (m.date && m.date > max ? m.date : max), '') || '9999';
          const shown = days.find((d) => lastDate(d) >= since) ?? days[days.length - 1];
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
              <SectionTitle>{league.name}</SectionTitle>
              <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 14, marginTop: -6 }}>Matchday {shown.number}</Text>
              {/* One card per match, our own first. */}
              <Swimlane cardWidth={cardWidth}>
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
                        style={[styles.card, styles.match, { backgroundColor: c.surface }, ours && { borderWidth: 1.5, borderColor: c.pitch }]}
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
  card: { borderRadius: 14, overflow: 'hidden' },
  head: { paddingHorizontal: 16, paddingVertical: 10 },
  headText: { color: '#fff', fontFamily: fonts.semi, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase' },
  match: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  side: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  when: { width: 74, alignItems: 'center', gap: 2, borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: 10 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, gap: 4 },
  pos: { width: 20, fontFamily: fonts.medium, fontSize: 13, textAlign: 'center' },
  cell: { width: 40, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center' },
});
