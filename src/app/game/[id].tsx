import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Crest, ResultBadge } from '../../components/MatchCard';
import { fmtDate, useData, type Game, type Profile, type Team } from '../../lib/data';
import { fonts, useColors } from '../../lib/theme';

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// The team a game opens on: the one the signed-in coach is assigned to in
// this game, else the team on their profile, else Blue before Red.
function defaultTeam(game: Game, me: Profile | null): Team {
  const teams = game.teams.map((t) => t.team);
  if (me) {
    const fullName = `${me.firstName} ${me.lastName}`;
    const mine = game.teams.find((t) => t.coaches.some((name) => same(name, fullName)));
    if (mine) return mine.team;
    if (me.preferredTeam && teams.includes(me.preferredTeam)) return me.preferredTeam;
  }
  return teams[0] ?? 'blue';
}

// Round jersey badge in the team's colour, like the profile badge in the tab bar.
function Jersey({ team, size = 36 }: { team: Team; size?: number }) {
  const c = useColors();
  return (
    <View style={[styles.round, { width: size, height: size, backgroundColor: team === 'blue' ? c.teamBlue : c.teamRed }]}>
      <Ionicons name="shirt-outline" size={size * 0.52} color="#fff" />
    </View>
  );
}

export default function GameScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { games, me, clubLogoUrl } = useData();
  const game = games.find((g) => g.id === id);
  const [picked, setPicked] = useState<Team | null>(null);
  const [choosing, setChoosing] = useState(false);

  if (!game) {
    return (
      <View style={[styles.page, { backgroundColor: c.chalk, paddingTop: insets.top + 60, alignItems: 'center' }]}>
        <Text style={{ color: c.inkSoft, fontFamily: fonts.regular }}>This game no longer exists.</Text>
      </View>
    );
  }

  const team = picked ?? defaultTeam(game, me);
  const tournament = game.competition === 'Tournament';
  const score = game.scores.find((s) => s.team === team)?.score;
  // Home team on the left, like the scoreline. With two teams our name says which one is open.
  const us = {
    name: game.teams.length > 1 ? `FCV Dender ${team === 'blue' ? 'Blue' : 'Red'}` : 'FCV Dender',
    url: clubLogoUrl,
  };
  const them = { name: game.opponent || 'TBD', url: game.opponentLogoUrl };
  const sides = game.homeAway === 'Away' ? [them, us] : [us, them];
  const quarters = game.quarters[team] ?? [];
  const place = game.records.find((r) => r.team === team)?.place;
  const teamSide = (side: { name: string; url: string | null }) => (
    <View style={styles.side}>
      <Crest url={side.url} name={side.name} size={72} />
      <Text style={[styles.sideName, { color: c.ink }]} numberOfLines={2}>
        {side.name}
      </Text>
    </View>
  );

  return (
    <View style={[styles.page, { backgroundColor: c.chalk }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable
          style={[styles.round, { backgroundColor: c.surface }]}
          onPress={() => router.back()}
          accessibilityLabel="Close"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>
            {tournament ? game.opponent || 'Tournament' : `vs ${game.opponent || 'TBD'}`}
          </Text>
          <Text style={[styles.sub, { color: c.inkSoft }]}>
            {fmtDate(game.date)} · {game.homeAway}
          </Text>
        </View>
        {game.teams.length > 1 ? (
          <Pressable onPress={() => setChoosing(true)} accessibilityLabel="Choose team" hitSlop={8}>
            <Jersey team={team} />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {tournament ? (
          <>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <Text style={[styles.sub, { color: c.inkSoft }]}>
                {game.type === 'Elite' || game.type === 'IP3' ? `${game.type} tournament` : 'Tournament'}
              </Text>
              <Text style={[styles.host, { color: c.ink }]}>{game.opponent || 'Tournament'}</Text>
              {place ? (
                <View style={[styles.place, { backgroundColor: c.amber + '2E' }]}>
                  <Ionicons name="trophy-outline" size={14} color={c.amber} />
                  <Text style={{ color: c.amber, fontFamily: fonts.medium, fontSize: 13 }}>{place}</Text>
                </View>
              ) : null}
            </View>
            {quarters.map((q, i) => {
              // Each quarter of a tournament is a match of its own: our goals first.
              const [us, opp] = game.homeAway === 'Away' ? [q.away, q.home] : [q.home, q.away];
              return (
                <View key={i} style={[styles.card, { backgroundColor: c.surface, gap: 8 }]}>
                  <View style={styles.matchHead}>
                    <Text style={[styles.matchName, { color: c.ink }]} numberOfLines={2}>
                      {q.label}
                    </Text>
                    {us !== null && opp !== null ? (
                      <>
                        <Text style={[styles.matchScore, { color: c.ink }]}>
                          {us} - {opp}
                        </Text>
                        <ResultBadge
                          result={us > opp ? 'W' : us < opp ? 'L' : 'D'}
                          colors={{ W: c.win, D: c.amber, L: c.danger }}
                        />
                      </>
                    ) : null}
                  </View>
                  {q.scorers.map((name, n) => (
                    <View key={n} style={styles.scorer}>
                      <Ionicons name="football-outline" size={14} color={c.inkSoft} />
                      <Text style={[styles.sub, { color: c.ink }]} numberOfLines={1}>
                        {name}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </>
        ) : score ? (
          <View style={[styles.card, styles.result, { backgroundColor: c.surface }]}>
            {teamSide(sides[0])}
            <View style={styles.middle}>
              <Text style={[styles.end, { color: c.inkSoft }]}>End</Text>
              <Text style={[styles.final, { color: c.ink }]}>
                {score.home} - {score.away}
              </Text>
            </View>
            {teamSide(sides[1])}
          </View>
        ) : (
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <Text style={[styles.sub, { color: c.inkSoft }]}>
            {game.teams.length > 1 ? `Team ${team === 'blue' ? 'Blue' : 'Red'}` : game.competition}
          </Text>
          <Text style={[styles.big, { color: c.ink }]}>
            {game.time ?? 'No time yet'}
          </Text>
          {game.location ? <Text style={[styles.sub, { color: c.inkSoft }]}>{game.location}</Text> : null}
        </View>
        )}

        {!tournament && quarters.some((q) => q.home !== null || q.away !== null || q.scorers.length) ? (
          <View style={[styles.card, { backgroundColor: c.surface, gap: 0, paddingVertical: 6 }]}>
            {quarters.map((q, i) => (
              <View key={i} style={[styles.quarter, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}>
                <Text style={[styles.quarterLabel, { color: c.inkSoft }]} numberOfLines={1}>
                  {q.label}
                </Text>
                <Text style={[styles.quarterScore, { color: c.ink }]}>
                  {q.home ?? '–'} - {q.away ?? '–'}
                </Text>
                <View style={{ flex: 1, gap: 2, marginTop: 1 }}>
                  {q.scorers.map((name, n) => (
                    <View key={n} style={styles.scorer}>
                      <Ionicons name="football-outline" size={14} color={c.inkSoft} />
                      <Text style={[styles.sub, { color: c.ink }]} numberOfLines={1}>
                        {name}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={choosing} transparent animationType="slide" onRequestClose={() => setChoosing(false)}>
        <Pressable style={styles.backdrop} onPress={() => setChoosing(false)} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 12 }]}>
          <View style={[styles.grabber, { backgroundColor: c.line }]} />
          {game.teams.map((t) => (
            <Pressable
              key={t.team}
              style={[styles.option, t.team === team && { backgroundColor: c.surface2 }]}
              onPress={() => {
                setPicked(t.team);
                setChoosing(false);
              }}
            >
              <Jersey team={t.team} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, { color: c.ink }]}>{t.team === 'blue' ? 'Blue' : 'Red'}</Text>
                {t.coaches.length ? (
                  <Text style={[styles.sub, { color: c.inkSoft }]} numberOfLines={1}>
                    {t.coaches.join(', ')}
                  </Text>
                ) : null}
              </View>
              {t.team === team ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
            </Pressable>
          ))}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.medium, fontSize: 17 },
  sub: { fontFamily: fonts.regular, fontSize: 13 },
  content: { padding: 16, gap: 10 },
  card: { borderRadius: 12, padding: 18, gap: 2 },
  big: { fontFamily: fonts.semi, fontSize: 30 },
  host: { fontFamily: fonts.semi, fontSize: 24 },
  place: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  matchHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  matchName: { flex: 1, fontFamily: fonts.medium, fontSize: 16 },
  matchScore: { fontFamily: fonts.semi, fontSize: 20 },
  quarter: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  quarterLabel: { width: 32, fontFamily: fonts.medium, fontSize: 13, marginTop: 2 },
  quarterScore: { width: 62, fontFamily: fonts.semi, fontSize: 17 },
  scorer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  result: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingVertical: 24 },
  side: { width: 96, alignItems: 'center', gap: 10 },
  sideName: { fontFamily: fonts.medium, fontSize: 14, textAlign: 'center' },
  middle: { height: 72, alignItems: 'center', justifyContent: 'center' },
  end: { fontFamily: fonts.regular, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  final: { fontFamily: fonts.semi, fontSize: 36 },
  backdrop: { flex: 1, backgroundColor: 'rgba(14,19,32,0.38)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 12, paddingTop: 8, gap: 4 },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 10 },
  optionTitle: { fontFamily: fonts.medium, fontSize: 15 },
});
