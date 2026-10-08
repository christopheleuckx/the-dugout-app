import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const { games, me } = useData();
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
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <Text style={[styles.sub, { color: c.inkSoft }]}>
            {game.teams.length > 1 ? `Team ${team === 'blue' ? 'Blue' : 'Red'}` : game.competition}
          </Text>
          <Text style={[styles.big, { color: c.ink }]}>
            {score && !tournament ? `${score.home} : ${score.away}` : (game.time ?? 'No time yet')}
          </Text>
          {game.location ? <Text style={[styles.sub, { color: c.inkSoft }]}>{game.location}</Text> : null}
        </View>
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
  backdrop: { flex: 1, backgroundColor: 'rgba(14,19,32,0.38)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 12, paddingTop: 8, gap: 4 },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 10 },
  optionTitle: { fontFamily: fonts.medium, fontSize: 15 },
});
