import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { sportFonts, sportShape, useSportColors } from '../lib/appTheme';
import { fmtDate, useData, type Game } from '../lib/data';
import { fonts } from '../lib/theme';
import { countdown, Crest } from './MatchCard';

// The game cards of the Sport theme (beta, chosen per phone in Profile): bold
// italic names and times, both crests in a pill, and results with only the final score.
const RESULT = { W: 'Win', D: 'Draw', L: 'Loss' } as const;

function sides(game: Game, us: { name: string; url: string | null }) {
  const them = { name: game.opponent || 'TBD', url: game.opponentLogoUrl };
  return game.homeAway === 'Away' ? [them, us] : [us, them];
}

// The very next game: a dark block that stands out in light and dark mode.
export function SportNextCard({ game, today }: { game: Game; today: string }) {
  const p = useSportColors();
  const { clubLogoUrl, clubName } = useData();
  const [home, away] = sides(game, { name: clubName, url: clubLogoUrl });
  const status = game.cancelStatus;
  const tag = status ? status[0].toUpperCase() + status.slice(1) : game.date ? countdown(game.date, today) : 'No date';
  return (
    <View style={[styles.next, { backgroundColor: p.feature }]}>
      <View style={styles.between}>
        <Text style={[styles.small, { color: p.featureSoft }]}>{game.competition}</Text>
        <View style={[styles.tag, { backgroundColor: p.countdown }]}>
          <Text style={styles.tagText}>{tag}</Text>
        </View>
      </View>
      <Text style={[styles.hero, { color: '#fff' }]}>
        NEXT{'\n'}
        <Text style={{ color: p.featureAccent }}>MATCH</Text>
      </Text>
      <View style={[styles.between, { marginTop: 14 }]}>
        <View style={styles.crests}>
          <Crest url={home.url} name={home.name} size={44} />
          <Text style={[styles.vs, { color: p.featureAccent }]}>V/S</Text>
          <Crest url={away.url} name={away.name} size={44} />
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.italic, { fontSize: 22, color: '#fff' }]}>{fmtDate(game.date).toUpperCase()}</Text>
          <Text style={[styles.small, { color: p.featureSoft, fontSize: 14 }]}>
            {game.time ?? 'TBD'} · {game.homeAway}
          </Text>
        </View>
      </View>
    </View>
  );
}

// A game still to play: crests at both ends of a pill, date and kick-off in the middle.
export function SportUpcomingCard({ game }: { game: Game }) {
  const p = useSportColors();
  const { clubLogoUrl, clubName } = useData();
  const [home, away] = sides(game, { name: clubName, url: clubLogoUrl });
  return (
    <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
      <Text style={[styles.small, { textAlign: 'center', color: game.competition === 'Cup' ? p.cup : p.soft }]}>
        {game.competition}
      </Text>
      <View style={[styles.pill, { backgroundColor: p.pill }]}>
        <Crest url={home.url} name={home.name} size={52} />
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.tiny, { color: p.soft }]}>{fmtDate(game.date)}</Text>
          {game.cancelStatus ? (
            <Text style={[styles.italic, { fontSize: 22, color: p.loss }]}>{game.cancelStatus.toUpperCase()}</Text>
          ) : (
            <Text style={[styles.italic, { fontSize: 30, color: p.ink }]}>{game.time ?? 'TBD'}</Text>
          )}
          <Text style={[styles.tiny, { color: p.soft }]}>
            <Ionicons name="location-outline" size={11} color={p.soft} /> {game.homeAway}
          </Text>
        </View>
        <Crest url={away.url} name={away.name} size={52} />
      </View>
      <View style={styles.names}>
        <Text style={[styles.italic, styles.name, { color: p.ink, textAlign: 'right' }]} numberOfLines={1}>
          {home.name.toUpperCase()}
        </Text>
        <Text style={[styles.vs, { color: p.faint }]}>V/S</Text>
        <Text style={[styles.italic, styles.name, { color: p.ink }]} numberOfLines={1}>
          {away.name.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

// A played game with only the final score: both clubs on top (home first, like
// the score), then a row per team. Blue and Red each get their own row.
export function SportResultCard({ game }: { game: Game }) {
  const p = useSportColors();
  const { clubLogoUrl, clubName } = useData();
  const colorOf = { W: p.win, D: p.draw, L: p.loss };
  const multi = game.numTeams > 1 || game.scores.length > 1;
  const [home, away] = sides(game, { name: clubName, url: clubLogoUrl });
  const club = (c: { name: string; url: string | null }, right = false) => (
    <View style={[styles.club, right && { flexDirection: 'row-reverse' }]}>
      <Crest url={c.url} name={c.name} size={34} />
      <Text style={[styles.italic, styles.clubName, { color: p.ink, textAlign: right ? 'right' : 'left' }]} numberOfLines={2}>
        {c.name.toUpperCase()}
      </Text>
    </View>
  );
  const rows = multi
    ? game.scores.map(({ team, score }) => ({ key: team, label: `TEAM ${team === 'blue' ? 'BLUE' : 'RED'}`, color: team === 'blue' ? p.teamBlue : p.teamRed, score }))
    : [{ key: 'blue', label: 'FINAL SCORE', color: p.teamBlue, score: game.scores[0]?.score }];

  return (
    <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
      <View style={styles.row}>
        {club(home)}
        <Text style={[styles.vs, { color: p.faint }]}>V/S</Text>
        {club(away, true)}
      </View>
      {rows.map((r) => (
        <View key={r.key} style={[styles.row, styles.teamRow, { borderTopColor: p.border }]}>
          <View style={[styles.bar, { backgroundColor: r.color }]} />
          <Text style={[styles.italic, styles.rowName, { color: p.ink }]}>{r.label}</Text>
          <Text style={[styles.italic, styles.goals, { color: p.ink }]}>{r.score ? `${r.score.home} - ${r.score.away}` : '–'}</Text>
          <Text style={[styles.result, { color: r.score ? colorOf[r.score.result] : p.soft }]}>{r.score ? RESULT[r.score.result] : ''}</Text>
        </View>
      ))}
      <View style={styles.footer}>
        {[game.competition, game.scores.length ? 'Full time' : 'No score', game.homeAway].map((t, i) => (
          <Text key={i} style={[styles.small, i > 0 && styles.sep, { color: i === 0 && t === 'Cup' ? p.cup : p.soft, borderLeftColor: p.border }]}>
            {t}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  italic: { fontFamily: sportFonts.display },
  next: { flex: 1, borderRadius: sportShape.feature, paddingVertical: 16, paddingHorizontal: 16 },
  card: { flex: 1, borderRadius: sportShape.card, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 16 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  small: { fontFamily: fonts.regular, fontSize: 12.5 },
  tiny: { fontFamily: fonts.regular, fontSize: 11 },
  tag: { borderRadius: sportShape.pill, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { color: '#fff', fontFamily: fonts.medium, fontSize: 12 },
  hero: { fontFamily: sportFonts.display, fontSize: 42, lineHeight: 40, marginTop: 10 },
  crests: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vs: { fontFamily: sportFonts.display, fontSize: 15 },
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: sportShape.pill, padding: 6, marginTop: 10 },
  names: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12 },
  name: { flex: 1, fontSize: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  club: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  clubName: { flex: 1, fontSize: 18, lineHeight: 19 },
  teamRow: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 12 },
  bar: { width: 3, height: 26, borderRadius: 2 },
  rowName: { flex: 1, fontSize: 20 },
  goals: { fontSize: 24, minWidth: 18, textAlign: 'right' },
  result: { fontFamily: fonts.medium, fontSize: 12, width: 36, textAlign: 'right' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  sep: { borderLeftWidth: 1, paddingLeft: 10 },
});
