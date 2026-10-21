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
  // Centred, so a card stretched next to the taller Next match block keeps even space above and below.
  return (
    <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border, justifyContent: 'center' }]}>
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

// A tournament has no single opponent: the host club leads. Next: the dark block.
// Upcoming: host, date, start and number of games in a pill. Played: a row per
// team with its place, wins, draws, losses and goals; the club's name when only one team played.
export function SportTournamentCard({ game, variant, today }: { game: Game; variant: 'next' | 'upcoming' | 'played'; today: string }) {
  const p = useSportColors();
  const { clubName } = useData();
  const host = game.opponent || 'Tournament';
  const level = game.type === 'Elite' || game.type === 'IP3' ? `${game.type} tournament` : 'Tournament';
  const games = `${game.matches} ${game.matches === 1 ? 'game' : 'games'}`;
  const status = game.cancelStatus;
  const tag = status ? status[0].toUpperCase() + status.slice(1) : game.date ? countdown(game.date, today) : 'No date';

  if (variant === 'next') {
    return (
      <View style={[styles.next, { backgroundColor: p.feature }]}>
        <View style={styles.between}>
          <Text style={[styles.small, { color: p.featureSoft }]}>
            {level} · {games}
          </Text>
          <View style={[styles.tag, { backgroundColor: p.countdown }]}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        </View>
        <Text style={[styles.hero, { color: '#fff' }]}>
          NEXT{'\n'}
          <Text style={{ color: p.featureAccent }}>TOURNAMENT</Text>
        </Text>
        <View style={[styles.between, { marginTop: 14, gap: 10 }]}>
          <View style={[styles.crests, { flex: 1 }]}>
            <Crest url={game.opponentLogoUrl} name={host} size={44} />
            <Text style={[styles.italic, { flex: 1, fontSize: 20, color: '#fff' }]} numberOfLines={2}>
              {host.toUpperCase()}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.italic, { fontSize: 20, color: '#fff' }]}>{fmtDate(game.date).toUpperCase()}</Text>
            <Text style={[styles.small, { color: p.featureSoft, fontSize: 14 }]}>{game.time ?? 'TBD'}</Text>
          </View>
        </View>
      </View>
    );
  }

  if (variant === 'upcoming') {
    return (
      <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border, justifyContent: 'center' }]}>
        <Text style={[styles.small, { textAlign: 'center', color: p.soft }]}>{level}</Text>
        <View style={[styles.pill, { backgroundColor: p.pill, gap: 12, paddingRight: 18 }]}>
          <Crest url={game.opponentLogoUrl} name={host} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.tiny, { color: p.soft }]}>{fmtDate(game.date)} · Host</Text>
            <Text style={[styles.italic, { fontSize: 22, color: p.ink }]} numberOfLines={1}>
              {host.toUpperCase()}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {status ? (
              <Text style={[styles.italic, { fontSize: 20, color: p.loss }]}>{status.toUpperCase()}</Text>
            ) : (
              <Text style={[styles.italic, { fontSize: 26, color: p.ink }]}>{game.time ?? 'TBD'}</Text>
            )}
            <Text style={[styles.tiny, { color: p.soft }]}>{games}</Text>
          </View>
        </View>
      </View>
    );
  }

  const multi = game.numTeams > 1 || game.records.length > 1;
  const chip = (label: string, color: string) => (
    <View style={[styles.stat, { backgroundColor: color + '22' }]}>
      <Text style={[styles.statText, { color }]}>{label}</Text>
    </View>
  );
  // "1st Place" as typed in the web app reads as "1st"; first place gets the gold chip.
  const place = (text: string | null) => {
    const first = !!text && /^(1|1st|first|winner)\b/i.test(text.trim());
    const label = text ? text.replace(/\s*place$/i, '').trim() : '–';
    return (
      <View style={[styles.place, { backgroundColor: first ? p.draw + '26' : p.pill }]}>
        <Ionicons name="trophy-outline" size={13} color={first ? p.draw : p.soft} />
        <Text style={[styles.statText, { color: first ? p.draw : p.soft }]}>{label}</Text>
      </View>
    );
  };
  return (
    <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
      <View style={styles.row}>
        <Crest url={game.opponentLogoUrl} name={host} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.italic, { fontSize: 20, color: p.ink }]} numberOfLines={1}>
            {host.toUpperCase()}
          </Text>
          <Text style={[styles.small, { color: p.soft }]}>{level} · Host</Text>
        </View>
      </View>
      {game.records.map((r) => (
        <View key={r.team} style={[styles.teamRow, { borderTopColor: p.border }]}>
          <View style={styles.row}>
            <View style={[styles.bar, { backgroundColor: r.team === 'blue' ? p.teamBlue : p.teamRed }]} />
            <Text style={[styles.italic, styles.rowName, { color: p.ink }]} numberOfLines={1}>
              {multi ? `TEAM ${r.team === 'blue' ? 'BLUE' : 'RED'}` : clubName.toUpperCase()}
            </Text>
            {place(r.place)}
          </View>
          <View style={styles.stats}>
            {chip(`W ${r.won}`, p.win)}
            {chip(`D ${r.drawn}`, p.draw)}
            {chip(`L ${r.lost}`, p.loss)}
            <Text style={[styles.italic, { marginLeft: 'auto', fontSize: 20, color: p.ink }]}>
              {r.goalsFor} - {r.goalsAgainst}
            </Text>
          </View>
        </View>
      ))}
      <View style={styles.footer}>
        {['Tournament', fmtDate(game.date), game.records.length ? games : status ? tag : 'No score'].map((t, i) => (
          <Text key={i} style={[styles.small, i > 0 && styles.sep, { color: p.soft, borderLeftColor: p.border }]}>
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
  stats: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingLeft: 13 },
  stat: { borderRadius: sportShape.pill, paddingHorizontal: 9, paddingVertical: 2 },
  statText: { fontFamily: fonts.medium, fontSize: 12 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: sportShape.pill, paddingHorizontal: 10, paddingVertical: 4 },
});
