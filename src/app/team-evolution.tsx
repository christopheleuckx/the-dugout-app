import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { Crest } from '../components/MatchCard';
import { PlayerCard, PlayerFrame, PlayerSection } from '../components/PlayerPage';
import { useLook } from '../lib/appTheme';
import { fmtDate, useData, type Team } from '../lib/data';
import { PARTS, teamEvolution, teamGames } from '../lib/teamEvolution';
import { fonts, useColors } from '../lib/theme';

// The colour of a game's dot: the opponent strength the team gave it.
const strengthColor = (s: number | null) => (s === null ? '#B4B2A9' : s >= 4 ? '#534AB7' : s === 3 ? '#378ADD' : '#888780');
const strengthName = (s: number | null) => (s === null ? 'No strength' : s >= 5 ? 'High Elite' : s === 4 ? 'Elite' : s === 3 ? 'IP3' : s === 2 ? 'Below IP3' : 'Development');
const monthName = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long' });
const one = (x: number | null) => (x === null ? '–' : x.toFixed(1));
const resultWord = { W: 'Won', D: 'Drew', L: 'Lost' } as const;

// How the team is getting on: one team score out of 10 from the team
// performance, the players, the game criteria and the results, each corrected
// for the opponent strength; the form per game, the criteria and every game.
export default function TeamEvolutionScreen() {
  const t = useLook();
  const c = useColors();
  const { games, me } = useData();
  const teams = (me?.activeAgeGroup?.teams.map((x) => x.key) ?? ['blue']) as Team[];
  const [pick, setPick] = useState<'both' | Team>('both');
  const shown: Team[] = pick === 'both' ? teams : [pick];
  const list = useMemo(() => teamGames(games, shown), [games, pick]); // eslint-disable-line react-hooks/exhaustive-deps
  const e = useMemo(() => teamEvolution(list), [list]);
  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sport ? t.border : t.pill };
  const big = { fontFamily: t.display, color: t.ink };

  // The form chart: the index per game (5 to 10 on the axis) and the three-game line.
  const W = 300;
  const H = 120;
  const x = (i: number) => (list.length < 2 ? W / 2 : 14 + (i * (W - 28)) / (list.length - 1));
  const y = (v: number) => 10 + ((10 - Math.min(10, Math.max(5, v))) / 5) * (H - 20);

  return (
    <PlayerFrame title="Team statistics" sub={me?.activeAgeGroup?.name}>
      {teams.length > 1 ? (
        <View style={[styles.segment, { backgroundColor: t.pill }]}>
          {(['both', ...teams] as const).map((k) => {
            const on = pick === k;
            const tint = k === 'blue' ? t.teamBlue : k === 'red' ? t.teamRed : t.feature;
            return (
              <Pressable key={k} style={[styles.segItem, on && { backgroundColor: tint }]} onPress={() => setPick(k)} accessibilityState={{ selected: on }}>
                <Text style={{ color: on ? '#fff' : t.ink, fontFamily: on ? fonts.medium : fonts.regular, fontSize: 13 }}>{k === 'both' ? 'Both' : k === 'blue' ? 'Blue' : 'Red'}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {list.length === 0 ? (
        <Text style={{ color: t.soft, fontFamily: fonts.regular, fontSize: 14 }}>No rated games yet. Fill in the team report or rate the players after a game.</Text>
      ) : (
        <>
          <View style={[styles.feature, { backgroundColor: t.feature, borderRadius: t.radius + 2 }]}>
            <View style={styles.between}>
              <Text style={{ color: t.featureSoft, fontFamily: fonts.regular, fontSize: 12.5 }}>
                Team score · {list.length} {list.length === 1 ? 'game' : 'games'}
              </Text>
              {e.change !== null && e.beforeMonth ? (
                <View style={styles.chip}>
                  <Ionicons name={e.change >= 0 ? 'trending-up' : 'trending-down'} size={13} color={e.change >= 0 ? '#7CD99B' : '#F5C26B'} />
                  <Text style={{ color: e.change >= 0 ? '#7CD99B' : '#F5C26B', fontFamily: fonts.medium, fontSize: 12 }}>
                    {e.change >= 0 ? '+' : ''}
                    {e.change.toFixed(1)} vs {monthName(e.beforeMonth)}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={[styles.row, { alignItems: 'flex-end', gap: 6, marginTop: 4 }]}>
              <Text style={{ color: '#fff', fontFamily: t.display, fontSize: 60, lineHeight: 62 }}>{one(e.score)}</Text>
              <Text style={{ color: t.featureSoft, fontFamily: fonts.regular, fontSize: 16, marginBottom: 10 }}>/ 10</Text>
            </View>
            <View style={[styles.row, { gap: 22, marginTop: 6 }]}>
              {(
                [
                  [one(e.form), 'Form · last 3'],
                  [`${e.won}W${e.drawn ? ` · ${e.drawn}D` : ''} · ${e.lost}L`, 'Results'],
                  [one(e.best?.index ?? null), e.best ? `Best · ${e.best.game.opponent}` : 'Best'],
                ] as [string, string][]
              ).map(([value, label]) => (
                <View key={label} style={{ flexShrink: 1 }}>
                  <Text style={{ color: '#fff', fontFamily: t.display, fontSize: 22 }} numberOfLines={1}>
                    {value}
                  </Text>
                  <Text style={{ color: t.featureSoft, fontFamily: fonts.regular, fontSize: 12 }} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <PlayerCard style={{ paddingVertical: 12 }}>
            <Text style={{ color: t.soft, fontFamily: fonts.medium, fontSize: 12.5, marginBottom: 4 }}>How the team score is made</Text>
            {PARTS.map((p) => {
              const v = e.partAverages[p.key];
              return (
                <View key={p.key} style={[styles.row, { gap: 10, paddingVertical: 6 }]}>
                  <Text style={{ width: 124, color: t.ink, fontFamily: fonts.regular, fontSize: 14 }}>{p.label}</Text>
                  <View style={[styles.track, { backgroundColor: t.pill }]}>
                    {v !== null ? <View style={{ width: `${v * 10}%`, height: '100%', borderRadius: 4, backgroundColor: t.accent }} /> : null}
                  </View>
                  <Text style={[big, { width: 30, textAlign: 'right', fontSize: 18 }]}>{one(v)}</Text>
                  <Text style={{ width: 32, textAlign: 'right', color: t.soft, fontFamily: fonts.regular, fontSize: 12 }}>{Math.round(p.weight * 100)}%</Text>
                </View>
              );
            })}
            {e.criteriaGames < list.length ? (
              <View style={styles.notice}>
                <Ionicons name="information-circle" size={15} color={c.amber} />
                <Text style={{ flex: 1, color: c.amber, fontFamily: fonts.medium, fontSize: 12.5 }}>
                  Game criteria filled in for {e.criteriaGames} of {list.length} games
                </Text>
              </View>
            ) : null}
          </PlayerCard>

          <PlayerSection>Form</PlayerSection>
          <PlayerCard style={{ paddingVertical: 12, paddingHorizontal: 12 }}>
            <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
              {[10, 7.5, 5].map((v) => (
                <Line key={v} x1={0} x2={W} y1={y(v)} y2={y(v)} stroke={t.pill} strokeWidth={1} />
              ))}
              <Polyline points={list.map((g, i) => `${x(i)},${y(g.index)}`).join(' ')} fill="none" stroke={t.soft} strokeWidth={1} />
              <Polyline
                points={e.rolling.map((v, i) => (v === null ? '' : `${x(i)},${y(v)}`)).filter(Boolean).join(' ')}
                fill="none"
                stroke="#D85A30"
                strokeWidth={3}
              />
              {list.map((g, i) => (
                <Circle key={`${g.game.id}-${g.team}`} cx={x(i)} cy={y(g.index)} r={4.5} fill={strengthColor(g.strength)} />
              ))}
            </Svg>
            <View style={[styles.row, { flexWrap: 'wrap', gap: 12, marginTop: 6 }]}>
              <View style={[styles.row, { gap: 4 }]}>
                <View style={{ width: 12, height: 3, backgroundColor: '#D85A30' }} />
                <Text style={styles.legend}>Last 3</Text>
              </View>
              {[4, 3, 2].map((s) => (
                <View key={s} style={[styles.row, { gap: 4 }]}>
                  <View style={[styles.dot, { backgroundColor: strengthColor(s) }]} />
                  <Text style={styles.legend}>{strengthName(s)}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.legend, { marginTop: 4 }]}>Scale from 5 to 10</Text>
          </PlayerCard>

          <PlayerSection>Game criteria</PlayerSection>
          <PlayerCard>
            {e.criteria.map((cr, i) => {
              const diff = cr.first !== null && cr.last !== null ? cr.last - cr.first : null;
              const color = diff === null || diff === 0 ? t.soft : diff > 0 ? c.win : c.danger;
              return (
                <View key={cr.key} style={[styles.row, { gap: 10, paddingVertical: 10 }, i > 0 && line]}>
                  <Text style={{ flex: 1, color: t.ink, fontFamily: fonts.regular, fontSize: 14 }} numberOfLines={1}>
                    {cr.title}
                  </Text>
                  <Text style={{ color: t.soft, fontFamily: fonts.regular, fontSize: 12.5 }}>
                    {cr.count ? (cr.count > 1 ? `${cr.first} → ${cr.last}` : `${cr.last}`) : 'Not rated'}
                  </Text>
                  <Text style={{ width: 36, textAlign: 'right', color, fontFamily: fonts.medium, fontSize: 13 }}>
                    {diff === null || cr.count < 2 ? '' : diff === 0 ? '=' : `${diff > 0 ? '+' : ''}${diff}`}
                  </Text>
                </View>
              );
            })}
          </PlayerCard>

          <PlayerSection>Every game</PlayerSection>
          <PlayerCard>
            {list
              .slice()
              .reverse()
              .map((g, i) => (
                <Pressable key={`${g.game.id}-${g.team}`} style={[styles.row, { gap: 10, paddingVertical: 10 }, i > 0 && line]} onPress={() => router.push(`/game/${g.game.id}`)}>
                  <Crest url={g.game.opponentLogoUrl} name={g.game.opponent || 'TBD'} size={30} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: t.ink, fontFamily: t.sport ? t.display : fonts.medium, fontSize: t.sport ? 17 : 15 }} numberOfLines={1}>
                      {t.sport ? (g.game.opponent || 'TBD').toUpperCase() : g.game.opponent || 'TBD'}
                    </Text>
                    <Text style={{ color: t.soft, fontFamily: fonts.regular, fontSize: 12 }} numberOfLines={1}>
                      {[
                        fmtDate(g.game.date),
                        pick === 'both' ? (g.team === 'blue' ? 'Blue' : 'Red') : null,
                        g.result ? `${resultWord[g.result.result]} ${g.game.homeAway === 'Away' ? `${g.result.away}-${g.result.home}` : `${g.result.home}-${g.result.away}`}` : null,
                        g.teamRating ? `team ${g.teamRating}` : null,
                        g.playersAverage !== null ? `players ${g.playersAverage.toFixed(2)}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <View style={[styles.dot, { backgroundColor: strengthColor(g.strength) }]} />
                  <Text style={[big, { fontSize: 22, minWidth: 34, textAlign: 'right' }]}>{g.index.toFixed(1)}</Text>
                </Pressable>
              ))}
          </PlayerCard>
          <Text style={{ color: t.soft, fontFamily: fonts.regular, fontSize: 12, marginHorizontal: 4 }}>
            Each part on the 10-point scale (a 3 is a 7), corrected for the opponent strength of the team report. Tournaments are left out.
          </Text>
        </>
      )}
    </PlayerFrame>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  segment: { flexDirection: 'row', borderRadius: 999, padding: 3, gap: 2 },
  segItem: { flex: 1, alignItems: 'center', borderRadius: 999, paddingVertical: 7 },
  feature: { padding: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: 'rgba(255,255,255,0.12)' },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: 'rgba(184,114,42,0.10)' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legend: { color: '#888780', fontFamily: fonts.regular, fontSize: 11.5 },
});
