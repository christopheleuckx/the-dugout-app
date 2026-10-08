import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useData, type Team } from '../lib/data';
import { generateSelection, groupOf, NOT_SELECTED_REASONS, POSITION_GROUPS, type Draft } from '../lib/selection';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';

type Page = null | 'generate' | { player: string };

// A game's selection: every player by line, each set to a team or to a reason
// for not being selected. Nothing is written until "Save selection".
export default function GameSelectionScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ game: string }>();
  const { games, players, refresh } = useData();
  const game = games.find((g) => g.id === params.game);

  const [page, setPage] = useState<Page>(null);
  const [draft, setDraft] = useState<Draft>(() => ({ ...(game?.selection ?? {}) }));
  const [numTeams, setNumTeams] = useState(game?.numTeams ?? 2);
  const [perTeam, setPerTeam] = useState(11);
  const [rotation, setRotation] = useState(false);
  const [mixed, setMixed] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!game) {
    return (
      <View style={[styles.page, { backgroundColor: c.chalk, paddingTop: insets.top + 60, alignItems: 'center' }]}>
        <Text style={{ color: c.inkSoft, fontFamily: fonts.regular }}>This game no longer exists.</Text>
      </View>
    );
  }

  const teamName = (team: Team) => (numTeams === 1 ? 'FCV Dender' : `FCV Dender ${team === 'blue' ? 'Blue' : 'Red'}`);
  const teamColor = (team: Team) => (team === 'blue' ? c.teamBlue : c.teamRed);
  const selectedCount = (team: Team) => Object.values(draft).filter((x) => x.team === team).length;

  async function save() {
    if (saving) return;
    setSaving(true);
    setError('');
    const rows = Object.entries(draft).map(([playerId, choice]) => ({
      game_id: game!.id,
      player_id: playerId,
      team: choice.team,
      not_selected_reason: choice.team ? null : choice.reason,
    }));
    const saved = await supabase.from('game_squad').upsert(rows, { onConflict: 'game_id,player_id' });
    // Keep the game's own number of teams in step with the selection.
    const updated =
      !saved.error && numTeams !== game!.numTeams
        ? await supabase.from('games').update({ num_teams: numTeams }).eq('id', game!.id)
        : null;
    const failed = saved.error ?? updated?.error;
    if (failed) {
      setError(`Could not save the selection: ${failed.message}`);
      setSaving(false);
      return;
    }
    await refresh();
    router.back();
  }

  const choose = (playerId: string, choice: Draft[string]) => {
    setDraft({ ...draft, [playerId]: choice });
    setPage(null);
  };

  const stepper = (value: number, set: (n: number) => void, min: number, max: number) => (
    <View style={styles.stepper}>
      <Pressable style={[styles.step, { backgroundColor: c.surface2 }]} onPress={() => set(Math.max(min, value - 1))} hitSlop={6} accessibilityLabel="Less">
        <Ionicons name="remove" size={18} color={c.ink} />
      </Pressable>
      <Text style={[styles.stepValue, { color: c.ink }]}>{value}</Text>
      <Pressable style={[styles.step, { backgroundColor: c.surface2 }]} onPress={() => set(Math.min(max, value + 1))} hitSlop={6} accessibilityLabel="More">
        <Ionicons name="add" size={18} color={c.ink} />
      </Pressable>
    </View>
  );
  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };

  let title = 'Selection';
  let body: ReactNode;
  if (page === 'generate') {
    title = 'Generate selection';
    body = (
      <>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <View style={styles.row}>
            <Text style={[styles.label, { color: c.ink }]}>Players per selection</Text>
            {stepper(perTeam, setPerTeam, 1, 20)}
          </View>
          <View style={[styles.row, line]}>
            <Text style={[styles.label, { color: c.ink }]}>Number of teams</Text>
            {stepper(numTeams, setNumTeams, 1, 2)}
          </View>
          <View style={[styles.row, line]}>
            <Text style={[styles.label, { color: c.ink }]}>Take rotation into account</Text>
            <Switch value={rotation} onValueChange={setRotation} trackColor={{ true: c.pitch }} />
          </View>
          <View style={[styles.row, line]}>
            <Text style={[styles.label, { color: c.ink }]}>Mixed teams</Text>
            <Switch value={mixed} onValueChange={setMixed} trackColor={{ true: c.pitch }} />
          </View>
        </View>
        <Text style={[styles.hint, { color: c.inkSoft }]}>
          Rotation picks players with the fewest selections first. Mixed teams spreads quality evenly over the teams. Players
          you marked as injured, sick or otherwise unavailable are left out.
        </Text>
        <Pressable
          style={[styles.button, { backgroundColor: c.pitch }]}
          onPress={() => {
            // Anyone already marked unavailable for a reason other than rotation stays out.
            const unavailable = Object.fromEntries(Object.entries(draft).filter(([, x]) => !x.team && x.reason && x.reason !== 'Rotation'));
            setDraft(generateSelection(players, games, game.id, { playersPerTeam: perTeam, numTeams, rotation, mixedTeams: mixed }, unavailable));
            setPage(null);
          }}
        >
          <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>Generate selection</Text>
        </Pressable>
      </>
    );
  } else if (page) {
    const player = players.find((p) => p.id === page.player)!;
    const current = draft[player.id];
    title = `${player.firstName} ${player.lastName}`.trim();
    const teams: Team[] = numTeams === 1 ? ['blue'] : ['blue', 'red'];
    body = (
      <>
        <Text style={[styles.group, { color: c.inkSoft }]}>Team selection</Text>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          {teams.map((team, i) => (
            <Pressable key={team} style={[styles.row, i > 0 && line]} onPress={() => choose(player.id, { team, reason: null })}>
              <View style={[styles.dot, { backgroundColor: teamColor(team) }]} />
              <Text style={[styles.label, { color: c.ink }]}>{teamName(team)}</Text>
              {current?.team === team ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
            </Pressable>
          ))}
        </View>
        <Text style={[styles.group, { color: c.inkSoft }]}>Not selected</Text>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          {NOT_SELECTED_REASONS.map((reason, i) => (
            <Pressable key={reason} style={[styles.row, i > 0 && line]} onPress={() => choose(player.id, { team: null, reason })}>
              <Text style={[styles.label, { color: c.ink }]}>{reason}</Text>
              {!current?.team && current?.reason === reason ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
            </Pressable>
          ))}
        </View>
      </>
    );
  } else {
    const groups = [...POSITION_GROUPS.map((g) => g.label), 'Other']
      .map((label, i) => ({ label, players: players.filter((p) => groupOf(p.bestPosition) === i) }))
      .filter((g) => g.players.length);
    body = (
      <>
        <Pressable style={[styles.button, { backgroundColor: c.surface, flexDirection: 'row', gap: 8 }]} onPress={() => setPage('generate')}>
          <Ionicons name="sparkles-outline" size={18} color={c.pitch} />
          <Text style={{ color: c.pitch, fontFamily: fonts.medium, fontSize: 16 }}>Generate selection</Text>
        </Pressable>
        <Text style={[styles.hint, { color: c.inkSoft, textAlign: 'center', marginTop: 0 }]}>
          {numTeams === 1 ? `${selectedCount('blue')} selected` : `Blue ${selectedCount('blue')} · Red ${selectedCount('red')}`}
        </Text>

        {groups.map((g) => (
          <View key={g.label} style={{ gap: 8 }}>
            <Text style={[styles.group, { color: c.inkSoft }]}>{g.label}</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              {g.players.map((p, i) => {
                const choice = draft[p.id];
                return (
                  <Pressable key={p.id} style={[styles.row, i > 0 && line]} onPress={() => setPage({ player: p.id })}>
                    <View style={[styles.badge, { backgroundColor: c.surface2 }]}>
                      <Text style={{ color: c.ink, fontFamily: fonts.semi, fontSize: 13 }}>{p.bestPosition || '–'}</Text>
                    </View>
                    <Text style={[styles.label, { color: c.ink }]} numberOfLines={1}>
                      {p.firstName} {p.lastName}
                    </Text>
                    {choice?.team ? (
                      <View style={[styles.pill, { backgroundColor: teamColor(choice.team) }]}>
                        <Text style={{ color: '#fff', fontFamily: fonts.medium, fontSize: 12.5 }}>
                          {numTeams === 1 ? 'Selected' : choice.team === 'blue' ? 'Blue' : 'Red'}
                        </Text>
                      </View>
                    ) : (
                      <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 14 }}>{choice?.reason || 'Choose'}</Text>
                    )}
                    <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        {error ? <Text style={[styles.hint, { color: c.danger }]}>{error}</Text> : null}
        <Pressable style={[styles.button, { backgroundColor: c.pitch }]} onPress={save}>
          {saving ? <ActivityIndicator color={c.onPitch} /> : <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>Save selection</Text>}
        </Pressable>
      </>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: c.chalk }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable
          style={[styles.round, { backgroundColor: c.surface }]}
          onPress={() => (page ? setPage(null) : router.back())}
          accessibilityLabel={page ? 'Back' : 'Close'}
          hitSlop={8}
        >
          <Ionicons name={page ? 'chevron-back' : 'close'} size={20} color={c.ink} />
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>{body}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 17 },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  card: { borderRadius: 14, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingVertical: 9 },
  label: { flex: 1, fontFamily: fonts.regular, fontSize: 16 },
  group: { fontFamily: fonts.medium, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase', marginLeft: 12, marginTop: 4 },
  hint: { fontFamily: fonts.regular, fontSize: 13, marginHorizontal: 12, marginTop: -4 },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  button: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  step: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 24, textAlign: 'center', fontFamily: fonts.medium, fontSize: 16 },
});
