import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Swimlane } from '../../components/Swimlane';
import { Empty, Screen, SectionTitle } from '../../components/ui';
import { currentWeek, fmtDate, todayIso, useData, type Game } from '../../lib/data';
import { brand, fonts, useColors } from '../../lib/theme';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Same fixed club name as CLUB_NAME in the web app; it is not stored in the database.
const CLUB = 'FCV Dender';
const NOTCH = 26;
const day = (iso: string) => new Date(iso + 'T00:00:00');

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

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
function Crest({ url, name, size }: { url: string | null; name: string; size: number }) {
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

// Home team on the left, like the scoreline.
function sides(game: Game, clubLogoUrl: string | null) {
  const us = { name: CLUB, url: clubLogoUrl };
  const them = { name: game.opponent || 'TBD', url: game.opponentLogoUrl };
  return game.homeAway === 'Away' ? [them, us] : [us, them];
}

function UpcomingCard({ game, next, today }: { game: Game; next: boolean; today: string }) {
  const c = useColors();
  const { clubLogoUrl } = useData();
  const [home, away] = sides(game, clubLogoUrl);
  // Only the very next game gets the filled card; the rest are light blue.
  const fg = next ? '#fff' : c.ink;
  const soft = next ? 'rgba(255,255,255,0.7)' : c.inkSoft;

  return (
    <View style={[styles.hero, { backgroundColor: next ? brand.navy : c.calGameBg }]}>
      <Text style={[styles.heroTitle, { color: fg }]}>{game.competition}</Text>
      <Text style={[styles.heroSub, { color: soft }]}>
        {fmtDate(game.date)} · {game.homeAway}
      </Text>
      <View style={styles.heroRow}>
        <View style={styles.side}>
          <Crest url={home.url} name={home.name} size={54} />
          <Text style={[styles.sideName, { color: fg }]} numberOfLines={2}>
            {home.name}
          </Text>
        </View>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <View style={[styles.pill, { backgroundColor: next ? brand.red : c.surface }]}>
            <Text style={[styles.pillText, { color: next ? '#fff' : c.inkSoft }]}>{countdown(game.date!, today)}</Text>
          </View>
          <Text style={[styles.heroTime, { color: fg }]}>{game.time ?? 'TBD'}</Text>
        </View>
        <View style={styles.side}>
          <Crest url={away.url} name={away.name} size={54} />
          <Text style={[styles.sideName, { color: fg }]} numberOfLines={2}>
            {away.name}
          </Text>
        </View>
      </View>
      <Notches color={c.chalk} />
    </View>
  );
}

// Tall card per game: opponent and logo up top, one scoreline per team
// (Blue and Red each play their own match) at the bottom.
function ResultCard({ game }: { game: Game }) {
  const resultColor = { W: '#5CC58A', D: '#E8A054', L: '#F08A80' };
  const resultLabel = { W: 'Win', D: 'Draw', L: 'Loss' };

  return (
    <View style={[styles.result, { backgroundColor: brand.navy }]}>
      <View style={styles.resultTop}>
        <Text style={styles.resultName} numberOfLines={2}>
          {game.opponent || 'TBD'}
        </Text>
        <Text style={styles.resultDate}>{fmtDate(game.date).slice(4)}</Text>
      </View>
      <Text style={styles.heroSub}>{game.homeAway}</Text>

      <View style={styles.resultCrest}>
        <Crest url={game.opponentLogoUrl} name={game.opponent || 'TBD'} size={112} />
      </View>

      <View style={{ gap: 6 }}>
        {game.scores.map(({ team, score }) => (
          <View key={team} style={styles.scoreLine}>
            <View style={[styles.teamDot, { backgroundColor: team === 'blue' ? '#5CA8F2' : '#F0626E' }]} />
            <Text style={styles.teamTag}>{team === 'blue' ? 'Blue' : 'Red'}</Text>
            <Text style={styles.score}>
              {score.home} : {score.away}
            </Text>
            <Text style={[styles.resultWord, { color: resultColor[score.result] }]}>{resultLabel[score.result]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function Dashboard() {
  const c = useColors();
  const { width } = useWindowDimensions();
  const { games, trainings, u15Fixtures, me, clubLogoUrl } = useData();
  const today = todayIso();
  const [weekOffset, setWeekOffset] = useState(0);
  const week = currentWeek(weekOffset);
  const weekLabel =
    weekOffset === 0 ? 'This week' : `${fmtDate(week[0]).slice(4)} – ${fmtDate(week[6]).slice(4)}`;
  const inWeek = (d: string | null) => !!d && d >= week[0] && d <= week[6];

  const upcoming = games
    .filter((g) => g.date && !g.cancelStatus && (g.date > today || (g.date === today && !g.scores.length)))
    .sort((a, b) => (a.date! + (a.time ?? '')).localeCompare(b.date! + (b.time ?? '')))
    .slice(0, 3);
  const results = games
    .filter((g) => g.date && g.date <= today && !g.cancelStatus && g.scores.length)
    .sort((a, b) => b.date!.localeCompare(a.date!))
    .slice(0, 5);

  // Everything in the shown week as one chronological list.
  const agenda = [
    ...games
      .filter((g) => inWeek(g.date) && !g.hiddenFromCalendar)
      .map((g) => ({
        key: g.id,
        date: g.date!,
        sort: g.time ?? '99:99',
        title: `U12 · ${g.opponent || 'TBD'}`,
        crestName: g.opponent || 'TBD',
        meta: g.cancelStatus ?? [g.time, g.homeAway].filter(Boolean).join(' · '),
        logoUrl: g.opponentLogoUrl,
        kind: 'Game' as const,
      })),
    ...u15Fixtures
      .filter((f) => inWeek(f.date))
      .map((f) => ({
        key: f.id,
        date: f.date,
        sort: f.time ?? '99:99',
        title: `U15 · ${f.opponent}`,
        crestName: f.opponent,
        meta: f.cancelStatus ?? [f.time, f.homeAway].filter(Boolean).join(' · '),
        logoUrl: f.opponentLogoUrl,
        kind: 'Game' as const,
      })),
    ...trainings
      .filter((t) => inWeek(t.date) && !t.hiddenFromCalendar)
      .map((t) => ({
        key: t.id,
        date: t.date,
        sort: t.startTime ?? '99:99',
        title: t.label,
        crestName: '',
        meta: t.cancelStatus ?? [t.startTime, t.location].filter(Boolean).join(' · '),
        logoUrl: null,
        kind: 'Training' as const,
      })),
  ].sort((a, b) => (a.date + a.sort).localeCompare(b.date + b.sort));
  // One card per day, so a game and a training on the same day sit together.
  const days = week
    .map((date) => ({ date, items: agenda.filter((it) => it.date === date) }))
    .filter((group) => group.items.length);

  return (
    <Screen title="The Dugout" left={<Crest url={clubLogoUrl} name="FCV" size={36} />}>
      <View>
        <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 14 }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
        <Text style={[styles.greeting, { color: c.ink }]}>{greeting()},</Text>
        {me?.firstName ? (
          <Text style={[styles.greeting, { color: c.pitch, fontFamily: fonts.semi }]}>{me.firstName}</Text>
        ) : null}
      </View>

      <SectionTitle>Upcoming games</SectionTitle>
      {upcoming.length ? (
        <Swimlane cardWidth={upcoming.length > 1 ? Math.round(width * 0.78) : width - 32}>
          {upcoming.map((g, i) => (
            <UpcomingCard key={g.id} game={g} next={i === 0} today={today} />
          ))}
        </Swimlane>
      ) : (
        <Empty>No games planned.</Empty>
      )}

      <View style={styles.weekHead}>
        <Text style={[styles.weekTitle, { color: c.ink }]}>{weekLabel}</Text>
        {weekOffset !== 0 ? (
          <Pressable style={[styles.weekButton, { backgroundColor: c.surface }]} onPress={() => setWeekOffset(0)}>
            <Text style={[styles.pillText, { color: c.ink, paddingHorizontal: 6 }]}>Today</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.weekButton, { backgroundColor: c.surface }]}
          onPress={() => setWeekOffset(weekOffset - 1)}
          accessibilityLabel="Previous week"
          hitSlop={6}
        >
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <Pressable
          style={[styles.weekButton, { backgroundColor: c.surface }]}
          onPress={() => setWeekOffset(weekOffset + 1)}
          accessibilityLabel="Next week"
          hitSlop={6}
        >
          <Ionicons name="chevron-forward" size={18} color={c.ink} />
        </Pressable>
      </View>
      {agenda.length === 0 ? <Empty>Nothing scheduled this week.</Empty> : null}
      {days.map((group) => (
        <View key={group.date} style={[styles.row, { backgroundColor: c.surface }]}>
          <View style={styles.rowDate}>
            <Text style={[styles.rowDay, { color: group.date === today ? c.pitch : c.ink }]}>
              {day(group.date).getDate()}
            </Text>
            <Text style={[styles.rowMeta, { color: c.inkSoft }]}>{WEEKDAYS[day(group.date).getDay()]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            {group.items.map((it, i) => {
              const tint = it.kind === 'Game' ? c.pitch : c.training;
              return (
                <View key={it.key} style={[styles.rowItem, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}>
                  {it.kind === 'Game' ? <Crest url={it.logoUrl} name={it.crestName} size={36} /> : null}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: c.ink }]} numberOfLines={1}>
                      {it.title}
                    </Text>
                    <Text style={[styles.rowMeta, { color: c.inkSoft, textTransform: 'capitalize' }]} numberOfLines={1}>
                      {it.meta}
                    </Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: tint + '24' }]}>
                    <Text style={[styles.pillText, { color: it.kind === 'Game' ? c.pitchStrong : c.training }]}>
                      {it.kind}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ))}

      <SectionTitle>Recent results</SectionTitle>
      {results.length ? (
        <Swimlane cardWidth={Math.round(width * 0.62)}>
          {results.map((g) => (
            <ResultCard key={g.id} game={g} />
          ))}
        </Swimlane>
      ) : (
        <Empty>No results yet.</Empty>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  crest: { backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  greeting: { fontFamily: fonts.medium, fontSize: 28, lineHeight: 33 },

  hero: { flex: 1, borderRadius: 12, paddingVertical: 18, paddingHorizontal: 20, overflow: 'hidden' },
  heroTitle: { color: '#fff', fontFamily: fonts.medium, fontSize: 15 },
  heroSub: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.regular, fontSize: 13 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 18 },
  heroTime: { color: '#fff', fontFamily: fonts.semi, fontSize: 30 },
  side: { width: 84, alignItems: 'center', gap: 8 },
  sideName: { color: '#fff', fontFamily: fonts.regular, fontSize: 13, textAlign: 'center' },

  weekHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  weekTitle: { flex: 1, fontFamily: fonts.medium, fontSize: 19 },
  weekButton: { minWidth: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontFamily: fonts.medium, fontSize: 11.5 },

  row: { flexDirection: 'row', gap: 12, borderRadius: 14, paddingVertical: 4, paddingHorizontal: 14 },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowDate: { width: 40, alignItems: 'center', paddingTop: 8 },
  rowDay: { fontFamily: fonts.semi, fontSize: 20, lineHeight: 23 },
  rowTitle: { fontFamily: fonts.medium, fontSize: 15 },
  rowMeta: { fontFamily: fonts.regular, fontSize: 12.5 },

  result: { height: 330, borderRadius: 18, padding: 18 },
  resultTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  resultName: { flex: 1, color: '#fff', fontFamily: fonts.semi, fontSize: 21, lineHeight: 25 },
  resultDate: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.regular, fontSize: 13, marginTop: 4 },
  resultCrest: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scoreLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamDot: { width: 8, height: 8, borderRadius: 4 },
  teamTag: { width: 36, color: 'rgba(255,255,255,0.8)', fontFamily: fonts.medium, fontSize: 13 },
  score: { flex: 1, color: '#fff', fontFamily: fonts.semi, fontSize: 24 },
  resultWord: { fontFamily: fonts.medium, fontSize: 13 },
});
