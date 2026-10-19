import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fmtDate, TEAM_RATING_LABELS, todayIso, type Game } from '../lib/data';
import { fonts, useColors } from '../lib/theme';
import { Crest, ResultBadge } from './MatchCard';

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// The games against the opponent of this game played before it, newest first:
// same club in the shared list (or the same name for games without one), not
// cancelled.
export function pastMeetings(games: Game[], game: Game) {
  const today = todayIso();
  return games
    .filter(
      (g) =>
        g.id !== game.id &&
        !!g.date &&
        !g.cancelStatus &&
        g.date < (game.date ?? today) &&
        g.date <= today &&
        (game.competitorId ? g.competitorId === game.competitorId : same(g.opponent, game.opponent)),
    )
    .sort((a, b) => (b.date! + (b.time ?? '')).localeCompare(a.date! + (a.time ?? '')));
}

// One earlier game: both clubs with the date like a fixture, then per team
// that played its score, result and how the team was rated.
export function HistoryCard({ game, clubName, clubLogoUrl, onPress }: { game: Game; clubName: string; clubLogoUrl: string | null; onPress: () => void }) {
  const c = useColors();
  const home = game.homeAway !== 'Away';
  const us = { name: clubName, url: clubLogoUrl };
  const them = { name: game.opponent || 'Opponent', url: game.opponentLogoUrl };
  const [left, right] = home ? [us, them] : [them, us];
  const resultColor = { W: c.win, D: c.amber, L: c.danger };
  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };

  return (
    <Pressable style={[styles.card, { backgroundColor: c.surface }]} onPress={onPress}>
      <View style={styles.head}>
        <Crest url={left.url} name={left.name} size={30} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 15 }} numberOfLines={1}>
            {left.name} <Text style={{ color: c.inkSoft, fontFamily: fonts.regular }}>–</Text> {right.name}
          </Text>
          <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>{[fmtDate(game.date), game.time].filter(Boolean).join(' · ')}</Text>
        </View>
        <Crest url={right.url} name={right.name} size={30} />
        <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
      </View>
      {game.scores.length === 0 ? (
        <View style={[styles.team, line]}>
          <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 14 }}>No score filled in</Text>
        </View>
      ) : (
        game.scores.map(({ team, score }) => {
          const rating = game.reports[team]?.score ?? null;
          return (
            <View key={team} style={[styles.team, line]}>
              {game.numTeams > 1 ? (
                <View style={styles.teamName}>
                  <View style={[styles.dot, { backgroundColor: team === 'blue' ? c.teamBlue : c.teamRed }]} />
                  <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 14 }}>{team === 'blue' ? 'Blue' : 'Red'}</Text>
                </View>
              ) : null}
              <Text style={{ color: c.ink, fontFamily: fonts.semi, fontSize: 16 }}>
                {score.home} - {score.away}
              </Text>
              <ResultBadge result={score.result} colors={resultColor} />
              <View style={{ flex: 1 }} />
              <View style={[styles.rating, { backgroundColor: rating ? c.rating[rating - 1] : c.surface2 }]}>
                <Text style={{ color: rating ? '#fff' : c.inkSoft, fontFamily: fonts.semi, fontSize: 12 }}>{rating ?? '–'}</Text>
              </View>
              <Text style={{ color: rating ? c.ink : c.inkSoft, fontFamily: fonts.regular, fontSize: 13, maxWidth: 150 }} numberOfLines={2}>
                {rating ? TEAM_RATING_LABELS[rating - 1] : 'Not rated'}
              </Text>
            </View>
          );
        })
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 62 },
  team: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
  teamName: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 52 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rating: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
});
