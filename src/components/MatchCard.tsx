import { Image, StyleSheet, Text, View } from 'react-native';

import { fmtDate, useData, type Game } from '../lib/data';
import { brand, fonts, useColors } from '../lib/theme';

// Same fixed club name as CLUB_NAME in the web app; it is not stored in the database.
const CLUB = 'FCV Dender';
const NOTCH = 26;
const day = (iso: string) => new Date(iso + 'T00:00:00');

function countdown(iso: string, today: string) {
  const days = Math.round((day(iso).getTime() - day(today).getTime()) / 86400000);
  return days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();

// A club logo on a white disc, or the club's initials when it has no logo.
export function Crest({ url, name, size }: { url: string | null; name: string; size: number }) {
  return (
    <View style={[styles.crest, { width: size, height: size, borderRadius: size / 2 }]}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: size * 0.72, height: size * 0.72 }} resizeMode="contain" />
      ) : (
        <Text style={{ fontFamily: fonts.semi, fontSize: size * 0.28, color: brand.navy }}>{initials(name)}</Text>
      )}
    </View>
  );
}

// W / D / L in a small tinted disc.
export function ResultBadge({ result, colors }: { result: 'W' | 'D' | 'L'; colors: Record<'W' | 'D' | 'L', string> }) {
  return (
    <View style={[styles.badge, { backgroundColor: colors[result] + '2E' }]}>
      <Text style={{ color: colors[result], fontFamily: fonts.semi, fontSize: 12 }}>{result}</Text>
    </View>
  );
}

// Cuts the top-right and bottom-left corners off a card by covering them
// with triangles in the page colour.
function Notches({ color }: { color: string }) {
  const corner = { position: 'absolute', width: NOTCH * 2, height: NOTCH * 2, backgroundColor: color } as const;
  return (
    <>
      <View style={[corner, { top: -NOTCH, right: -NOTCH, transform: [{ rotate: '45deg' }] }]} />
      <View style={[corner, { bottom: -NOTCH, left: -NOTCH, transform: [{ rotate: '45deg' }] }]} />
    </>
  );
}

// A game is played once its day has passed, or today as soon as it has a score.
export function isPlayed(game: Game, today: string) {
  return !!game.date && !game.cancelStatus && (game.date < today || (game.date === today && game.scores.length > 0));
}

// One game as a card with both crests, home team on the left like the scoreline.
// `next` is the filled card for the very next game, `upcoming` the light blue
// one, and `played` shows the score per team (Blue and Red each play their
// own match) with W / D / L in place of the kick-off time. `notched` cuts the
// top-right and bottom-left corners off; otherwise all four keep the card radius.
export function MatchCard({
  game,
  variant,
  today,
  notched = false,
}: {
  game: Game;
  variant: 'next' | 'upcoming' | 'played';
  today: string;
  notched?: boolean;
}) {
  const c = useColors();
  const { clubLogoUrl } = useData();
  const us = { name: CLUB, url: clubLogoUrl };
  const them = { name: game.opponent || 'TBD', url: game.opponentLogoUrl };
  const [home, away] = game.homeAway === 'Away' ? [them, us] : [us, them];

  const next = variant === 'next';
  const fg = next ? '#fff' : c.ink;
  const soft = next ? 'rgba(255,255,255,0.7)' : c.inkSoft;
  const bg = next ? brand.navy : variant === 'upcoming' ? c.calGameBg : c.surface;
  const resultColors = { W: c.win, D: c.amber, L: c.danger };

  let centre;
  if (game.cancelStatus) {
    centre = (
      <View style={[styles.pill, { backgroundColor: c.danger + '24' }]}>
        <Text style={[styles.pillText, { color: c.danger, textTransform: 'capitalize' }]}>{game.cancelStatus}</Text>
      </View>
    );
  } else if (variant === 'played' && game.scores.length) {
    const multi = game.scores.length > 1;
    centre = game.scores.map(({ team, score }) => (
      <View key={team} style={styles.scoreLine}>
        {multi ? <View style={[styles.teamDot, { backgroundColor: team === 'blue' ? c.teamBlue : c.teamRed }]} /> : null}
        <Text style={[multi ? styles.score : styles.time, { color: fg }]}>
          {score.home} : {score.away}
        </Text>
        <ResultBadge result={score.result} colors={resultColors} />
      </View>
    ));
  } else if (variant === 'played') {
    centre = (
      <View style={[styles.pill, { backgroundColor: c.surface2 }]}>
        <Text style={[styles.pillText, { color: c.inkSoft }]}>No score</Text>
      </View>
    );
  } else {
    centre = (
      <>
        <View style={[styles.pill, { backgroundColor: next ? brand.red : c.surface }]}>
          <Text style={[styles.pillText, { color: next ? '#fff' : c.inkSoft }]}>
            {game.date ? countdown(game.date, today) : 'No date'}
          </Text>
        </View>
        <Text style={[styles.time, { color: fg }]}>{game.time ?? 'TBD'}</Text>
      </>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: bg }]}>
      <Text style={[styles.title, { color: fg }]}>{game.competition}</Text>
      <Text style={[styles.sub, { color: soft }]}>
        {fmtDate(game.date)} · {game.homeAway}
      </Text>
      <View style={styles.row}>
        <View style={styles.side}>
          <Crest url={home.url} name={home.name} size={54} />
          <Text style={[styles.sideName, { color: fg }]} numberOfLines={2}>
            {home.name}
          </Text>
        </View>
        <View style={styles.centre}>{centre}</View>
        <View style={styles.side}>
          <Crest url={away.url} name={away.name} size={54} />
          <Text style={[styles.sideName, { color: fg }]} numberOfLines={2}>
            {away.name}
          </Text>
        </View>
      </View>
      {notched ? <Notches color={c.chalk} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  crest: { backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  badge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  card: { flex: 1, borderRadius: 12, paddingVertical: 18, paddingHorizontal: 20, overflow: 'hidden' },
  title: { fontFamily: fonts.medium, fontSize: 15 },
  sub: { fontFamily: fonts.regular, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 18 },
  side: { width: 84, alignItems: 'center', gap: 8 },
  sideName: { fontFamily: fonts.regular, fontSize: 13, textAlign: 'center' },
  centre: { alignItems: 'center', gap: 4 },
  time: { fontFamily: fonts.semi, fontSize: 30 },
  score: { fontFamily: fonts.semi, fontSize: 22 },
  scoreLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamDot: { width: 8, height: 8, borderRadius: 4 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontFamily: fonts.medium, fontSize: 11.5 },
});
