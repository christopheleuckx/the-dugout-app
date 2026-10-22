import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Crest } from '../components/MatchCard';
import { PlayerCard, PlayerFrame, PlayerSection } from '../components/PlayerPage';
import { useLook } from '../lib/appTheme';
import { fmtDate, useData } from '../lib/data';
import { playerGames } from '../lib/playerProfile';
import { fonts, useColors } from '../lib/theme';

// A player's games: how many he played, his ratings, Blue and Red, and every
// game with his rating or why he was not selected. A game opens its own page.
export default function PlayerGamesScreen() {
  const t = useLook();
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { players, games, me } = useData();
  const player = players.find((p) => p.id === id);
  if (!player) {
    return (
      <PlayerFrame title="Games">
        <Text style={{ color: t.soft, fontFamily: fonts.regular, textAlign: 'center' }}>This player is not in the team on show.</Text>
      </PlayerFrame>
    );
  }
  const g = playerGames(player, games);
  const most = Math.max(1, ...g.distribution);
  const twoTeams = (me?.activeAgeGroup?.teams.length ?? 1) > 1;
  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sport ? t.border : t.pill };
  const big = { fontFamily: t.display, color: t.ink };

  return (
    <PlayerFrame title="Games" sub={`${player.firstName} ${player.lastName}${me?.activeAgeGroup ? ` · ${me.activeAgeGroup.name}` : ''}`}>
      <PlayerCard style={{ paddingVertical: 14 }}>
        <View style={styles.head}>
          <Text style={[big, { fontSize: 40, lineHeight: 42 }]}>{g.played}</Text>
          <Text style={{ color: t.soft, fontFamily: fonts.regular, fontSize: 13 }}>
            of {g.counted} games played{'\n'}
            {g.notSelected} not selected
          </Text>
        </View>

        <Text style={[styles.caption, { color: t.soft }]}>Rating distribution{g.average !== null ? ` · score ${g.average.toFixed(1)} / 10` : ''}</Text>
        {g.rated ? (
          [5, 4, 3, 2, 1].map((n) => (
            <View key={n} style={styles.barRow}>
              <View style={[styles.score, { backgroundColor: c.rating[n - 1] }]}>
                <Text style={styles.scoreText}>{n}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={[styles.bar, { width: `${(g.distribution[n - 1] / most) * 100}%`, backgroundColor: c.rating[n - 1], minWidth: g.distribution[n - 1] ? 6 : 0 }]} />
              </View>
              <Text style={{ width: 22, textAlign: 'right', color: t.soft, fontFamily: fonts.regular, fontSize: 13 }}>{g.distribution[n - 1]}</Text>
            </View>
          ))
        ) : (
          <Text style={{ color: t.soft, fontFamily: fonts.regular, fontSize: 13 }}>No ratings yet.</Text>
        )}

        {twoTeams && g.played ? (
          <>
            <Text style={[styles.caption, { color: t.soft, marginTop: 14 }]}>Team Blue / Team Red</Text>
            <View style={styles.split}>
              {g.blue ? <View style={{ flex: g.blue, backgroundColor: t.teamBlue }} /> : null}
              {g.red ? <View style={{ flex: g.red, backgroundColor: t.teamRed }} /> : null}
            </View>
            <View style={[styles.head, { justifyContent: 'space-between', marginTop: 4 }]}>
              <Text style={{ color: t.teamBlue, fontFamily: fonts.medium, fontSize: 13 }}>Blue {g.blue}</Text>
              <Text style={{ color: t.teamRed, fontFamily: fonts.medium, fontSize: 13 }}>Red {g.red}</Text>
            </View>
          </>
        ) : null}
      </PlayerCard>

      <PlayerSection>Every game</PlayerSection>
      {g.rows.length ? (
        <PlayerCard>
          {g.rows.map((r, i) => (
            <Pressable key={r.game.id} style={[styles.game, i > 0 && line]} onPress={() => router.push(`/game/${r.game.id}`)}>
              <Crest url={r.game.opponentLogoUrl} name={r.game.opponent || 'TBD'} size={30} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: t.ink, fontFamily: t.sport ? t.display : fonts.medium, fontSize: t.sport ? 17 : 15 }} numberOfLines={1}>
                  {t.sport ? (r.game.opponent || 'TBD').toUpperCase() : r.game.opponent || 'TBD'}
                </Text>
                <Text style={{ color: t.soft, fontFamily: fonts.regular, fontSize: 12.5 }}>
                  {fmtDate(r.game.date)} · {r.team ? `Team ${r.team === 'blue' ? 'Blue' : 'Red'}` : 'Not selected'}
                </Text>
              </View>
              {r.team ? (
                r.rating !== null ? (
                  <View style={[styles.score, { width: 28, height: 28, backgroundColor: c.rating[Math.round(r.rating) - 1] }]}>
                    <Text style={styles.scoreText}>{r.rating}</Text>
                  </View>
                ) : (
                  <Text style={{ color: t.soft, fontFamily: fonts.regular, fontSize: 12 }}>Not rated</Text>
                )
              ) : (
                <View style={[styles.chip, { backgroundColor: r.reason === 'Rotation' ? t.pill : c.danger + '1F' }]}>
                  <Text style={{ color: r.reason === 'Rotation' ? t.soft : c.danger, fontFamily: fonts.medium, fontSize: 11.5 }}>{r.reason}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </PlayerCard>
      ) : (
        <Text style={{ color: t.soft, fontFamily: fonts.regular, fontSize: 14, marginHorizontal: 4 }}>No games with a selection yet.</Text>
      )}
    </PlayerFrame>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  caption: { fontFamily: fonts.medium, fontSize: 12.5, marginTop: 12, marginBottom: 2 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  bar: { height: 10, borderRadius: 5 },
  score: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  scoreText: { color: '#fff', fontFamily: fonts.medium, fontSize: 12.5 },
  split: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', marginTop: 6 },
  game: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  chip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
});
