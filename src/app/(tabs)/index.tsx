import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Swimlane } from '../../components/Swimlane';
import { Card, Empty, Screen, SectionTitle } from '../../components/ui';
import { currentWeek, fmtDate, todayIso, useData, type Game } from '../../lib/data';
import { fonts, radius, useColors, type Colors } from '../../lib/theme';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const day = (iso: string) => new Date(iso + 'T00:00:00');

function greeting(firstName?: string) {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return firstName ? `${part} ${firstName}` : part;
}

function UpcomingCard({ game, next }: { game: Game; next: boolean }) {
  const c = useColors();
  // Only the very next game gets the filled card and the "Next game" label.
  const fg = next ? '#fff' : c.ink;

  return (
    <View style={[styles.gameCard, { backgroundColor: next ? c.pitch : c.calGameBg }]}>
      <Text style={[styles.eyebrow, { color: fg, opacity: next ? 0.8 : 0 }]}>Next game</Text>
      <Text style={[styles.opponent, { color: fg }]} numberOfLines={2}>
        {game.opponent || 'TBD'}
      </Text>
      <Text style={{ color: fg, fontWeight: '600' }}>
        {fmtDate(game.date)}
        {game.time ? ` · ${game.time}` : ''}
      </Text>
      <View style={[styles.pill, { backgroundColor: next ? 'rgba(255,255,255,0.16)' : c.surface }]}>
        <Text style={[styles.pillText, { color: next ? '#fff' : c.inkSoft }]}>{game.homeAway}</Text>
      </View>
    </View>
  );
}

// One scoreline per team that played: Blue and Red each have their own match.
function ResultCard({ game }: { game: Game }) {
  const c = useColors();
  const resultColor = { W: c.win, D: c.amber, L: c.danger };

  return (
    <Card>
      <View>
        <Text style={[styles.itemTitle, { color: c.ink }]} numberOfLines={1}>
          {game.opponent || 'TBD'}
        </Text>
        <Text style={[styles.meta, { color: c.inkSoft }]}>
          {fmtDate(game.date)} · {game.homeAway}
        </Text>
      </View>
      <View style={[styles.scoreLines, { borderTopColor: c.line }]}>
        {game.scores.map(({ team, score }) => (
          <View key={team} style={styles.scoreLine}>
            <Text style={[styles.teamTag, { color: team === 'blue' ? c.teamBlue : c.teamRed }]}>
              {team === 'blue' ? 'Blue' : 'Red'}
            </Text>
            <Text style={[styles.score, { color: c.ink }]}>
              {score.home}–{score.away}
            </Text>
            <View style={[styles.result, { backgroundColor: resultColor[score.result] + '24' }]}>
              <Text style={{ color: resultColor[score.result], fontWeight: '700', fontSize: 12 }}>{score.result}</Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

function StatTile({ label, value, note, c }: { label: string; value: number; note: string; c: Colors }) {
  return (
    <View style={[styles.tile, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text style={[styles.eyebrow, { color: c.inkSoft }]}>{label}</Text>
      <Text style={[styles.tileValue, { color: c.ink }]}>{value}</Text>
      <Text style={[styles.meta, { color: c.inkSoft }]}>{note}</Text>
    </View>
  );
}

export default function Dashboard() {
  const c = useColors();
  const { width } = useWindowDimensions();
  const { games, trainings, players, me, clubLogoUrl } = useData();
  const today = todayIso();
  const week = currentWeek();
  const inWeek = (d: string | null) => !!d && d >= week[0] && d <= week[6];

  const upcoming = games
    .filter((g) => g.date && !g.cancelStatus && (g.date > today || (g.date === today && !g.scores.length)))
    .sort((a, b) => (a.date! + (a.time ?? '')).localeCompare(b.date! + (b.time ?? '')))
    .slice(0, 3);
  const results = games
    .filter((g) => g.date && g.date <= today && !g.cancelStatus && g.scores.length)
    .sort((a, b) => b.date!.localeCompare(a.date!))
    .slice(0, 5);

  const weekTrainings = trainings.filter((t) => inWeek(t.date) && !t.cancelStatus);
  const weekGames = games.filter((g) => inWeek(g.date) && !g.cancelStatus);
  const done = weekTrainings.filter((t) => t.date <= today);
  const possible = done.length * players.length;
  const missed = done.reduce((n, t) => n + t.unexcusedCount, 0);
  const attendance = possible ? `${Math.round(((possible - missed) / possible) * 100)}% attendance` : 'no session yet';

  // Everything this week as one chronological list, grouped per day.
  const agenda = week
    .map((date) => ({
      date,
      items: [
        ...games
          .filter((g) => g.date === date && !g.hiddenFromCalendar)
          .map((g) => ({
            key: g.id,
            sort: g.time ?? '99:99',
            title: `U12 · ${g.opponent || 'TBD'}`,
            meta: g.cancelStatus ?? [g.time, g.competition, g.homeAway].filter(Boolean).join(' · '),
            kind: 'Game' as const,
          })),
        ...trainings
          .filter((t) => t.date === date && !t.hiddenFromCalendar)
          .map((t) => ({
            key: t.id,
            sort: t.startTime ?? '99:99',
            title: t.label,
            meta: t.cancelStatus ?? [t.startTime, t.location].filter(Boolean).join(' · '),
            kind: 'Training' as const,
          })),
      ].sort((a, b) => a.sort.localeCompare(b.sort)),
    }))
    .filter((group) => group.items.length);

  return (
    <Screen
      title="The Dugout"
      right={clubLogoUrl ? <Image source={{ uri: clubLogoUrl }} style={styles.clubLogo} resizeMode="contain" /> : null}
    >
      <View style={{ marginBottom: 4 }}>
        <Text style={[styles.greeting, { color: c.ink }]}>{greeting(me?.firstName)}</Text>
        <Text style={{ color: c.inkSoft, fontWeight: '500', marginTop: 4 }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · FCV Dender U12
        </Text>
      </View>

      <SectionTitle>Upcoming games</SectionTitle>
      {upcoming.length ? (
        <Swimlane cardWidth={upcoming.length > 1 ? Math.round(width * 0.72) : width - 32}>
          {upcoming.map((g, i) => (
            <UpcomingCard key={g.id} game={g} next={i === 0} />
          ))}
        </Swimlane>
      ) : (
        <Empty>No games planned.</Empty>
      )}

      <SectionTitle>This week</SectionTitle>
      <View style={styles.tiles}>
        <StatTile label="Trainings" value={weekTrainings.length} note={attendance} c={c} />
        <StatTile label="Games" value={weekGames.length} note="scheduled" c={c} />
      </View>
      <Card>
        {agenda.length === 0 ? <Empty>Nothing scheduled this week.</Empty> : null}
        {agenda.map((group) => {
          const isToday = group.date === today;
          return (
            <View key={group.date} style={styles.agendaDay}>
              <View style={[styles.dateBadge, { backgroundColor: isToday ? c.pitch : c.surface2 }]}>
                <Text style={[styles.dateNumber, { color: isToday ? '#fff' : c.ink }]}>{day(group.date).getDate()}</Text>
                <Text style={[styles.dateWeekday, { color: isToday ? '#fff' : c.inkSoft }]}>
                  {WEEKDAYS[day(group.date).getDay()]}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 10 }}>
                {group.items.map((it) => {
                  const tint = it.kind === 'Game' ? c.pitch : c.training;
                  return (
                    <View key={it.key} style={styles.agendaItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemTitle, { color: c.ink }]} numberOfLines={1}>
                          {it.title}
                        </Text>
                        <Text style={[styles.meta, { color: c.inkSoft, textTransform: 'capitalize' }]} numberOfLines={1}>
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
          );
        })}
      </Card>

      <SectionTitle>Recent results</SectionTitle>
      {results.length ? (
        <Swimlane cardWidth={206}>
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
  clubLogo: { width: 30, height: 30 },
  greeting: { fontFamily: fonts.display, fontSize: 36, lineHeight: 38, textTransform: 'uppercase' },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  gameCard: { borderRadius: radius, paddingVertical: 18, paddingHorizontal: 20, gap: 6, flex: 1 },
  opponent: { fontFamily: fonts.display, fontSize: 32, lineHeight: 35, textTransform: 'uppercase' },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  pillText: { fontSize: 11.5, fontWeight: '700' },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, borderRadius: radius, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 12, paddingHorizontal: 14 },
  tileValue: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40 },
  agendaDay: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  dateBadge: { width: 44, borderRadius: 10, alignItems: 'center', paddingVertical: 4 },
  dateNumber: { fontFamily: fonts.display, fontSize: 21, lineHeight: 23 },
  dateWeekday: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  agendaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTitle: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12 },
  scoreLines: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 8 },
  scoreLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamTag: { width: 38, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  score: { flex: 1, fontFamily: fonts.display, fontSize: 30, lineHeight: 32 },
  result: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
