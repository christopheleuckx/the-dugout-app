import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ResultBadge } from '../components/MatchCard';
import { fmtDate, useData, type Team } from '../lib/data';
import { goBack } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';

// A quarter as it is filled in here: our goals, theirs, and who scored each
// of ours (null while not chosen).
type Entry = { us: number; them: number; scorers: (string | null)[] };

// The goals and score of one team's game, filled in per quarter: tap a
// quarter, set both scores and choose who scored. Each quarter saves on its own.
export default function GameScoresScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ game: string; team: Team; quarter?: string }>();
  const { games, clubName, refresh } = useData();
  const game = games.find((g) => g.id === params.game);
  const team = params.team;

  // The quarter being filled in, its values, and which goal is choosing its scorer.
  const [open, setOpen] = useState<number | null>(params.quarter ? Number(params.quarter) : null);
  const [entry, setEntry] = useState<Entry>({ us: 0, them: 0, scorers: [] });
  const [choosing, setChoosing] = useState<number | null>(null);
  // Per quarter (1, 2, …): the scorers already stored for this team, in order.
  const [stored, setStored] = useState<Record<number, string[]> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const players = game?.teams.find((t) => t.team === team)?.players ?? [];
  const playerIds = players.map((p) => p.id).join(',');
  const gameId = game?.id;

  // A goal belongs to the team its scorer is selected in, so only this team's are read.
  async function loadGoals() {
    if (!gameId) return;
    const { data, error: failed } = await supabase.from('goals').select('quarter, scorer_id, created_at').eq('game_id', gameId).order('created_at');
    if (failed) {
      setError(`Could not load the goals: ${failed.message}`);
      setStored({});
      return;
    }
    const ids = new Set(playerIds.split(','));
    const byQuarter: Record<number, string[]> = {};
    for (const goal of data ?? []) {
      if (goal.scorer_id && ids.has(goal.scorer_id)) (byQuarter[goal.quarter] ??= []).push(goal.scorer_id);
    }
    setStored(byQuarter);
  }
  useEffect(() => {
    loadGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, playerIds]);

  const quarters = game?.quarters[team] ?? [];
  const away = game?.homeAway === 'Away';
  const scoreOf = (i: number) => {
    const q = quarters[i];
    return { us: away ? q.away : q.home, them: away ? q.home : q.away };
  };

  // Opening a quarter starts from what is stored: its scores and its scorers.
  useEffect(() => {
    if (open === null || !stored || !quarters[open]) return;
    const { us, them } = scoreOf(open);
    const known = stored[open + 1] ?? [];
    const goals = Math.max(us ?? 0, known.length);
    setEntry({ us: goals, them: them ?? 0, scorers: Array.from({ length: goals }, (_, n) => known[n] ?? null) });
    setChoosing(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stored]);

  if (!game) {
    return (
      <View style={[styles.page, { backgroundColor: c.chalk, paddingTop: insets.top + 60, alignItems: 'center' }]}>
        <Text style={{ color: c.inkSoft, fontFamily: fonts.regular }}>This game no longer exists.</Text>
      </View>
    );
  }

  const setUs = (us: number) => setEntry({ ...entry, us, scorers: Array.from({ length: us }, (_, n) => entry.scorers[n] ?? null) });
  const name = (id: string | null) => {
    const p = players.find((x) => x.id === id);
    return p ? `${p.firstName} ${p.lastName}`.trim() : null;
  };

  // Saves one quarter: its score in the team's record, and its scorers as goals.
  async function save(clear = false) {
    if (saving || open === null) return;
    setSaving(true);
    setError('');
    try {
      const fresh = await supabase.from('games').select('lineups').eq('id', game!.id).single();
      if (fresh.error) throw fresh.error;
      const record = fresh.data?.lineups?.[team] ?? {};
      const scores = Array.from({ length: quarters.length }, (_, i) => record.quarterScores?.[i] ?? { for: scoreOf(i).us, against: scoreOf(i).them });
      scores[open] = clear ? { for: null, against: null } : { for: entry.us, against: entry.them };
      const patched = await supabase.rpc('patch_game_team_lineup', { p_game_id: game!.id, p_team: team, p_value: { ...record, quarterScores: scores } });
      if (patched.error) throw patched.error;

      // This team's goals of the quarter are replaced by the chosen scorers.
      if (players.length) {
        const gone = await supabase.from('goals').delete().eq('game_id', game!.id).eq('quarter', open + 1).in('scorer_id', players.map((p) => p.id));
        if (gone.error) throw gone.error;
      }
      const scorers = clear ? [] : entry.scorers.filter((id): id is string => !!id);
      if (scorers.length) {
        // One after the other, so they keep the order they were scored in.
        const start = Date.now();
        const added = await supabase.from('goals').insert(
          scorers.map((id, n) => ({ game_id: game!.id, quarter: open + 1, scorer_id: id, created_at: new Date(start + n).toISOString() })),
        );
        if (added.error) throw added.error;
      }
      await Promise.all([refresh(), loadGoals()]);
      setSaving(false);
      setOpen(null);
    } catch (e) {
      setError(`Could not save: ${(e as { message?: string })?.message ?? 'unknown error'}`);
      setSaving(false);
    }
  }

  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };
  const ours = game.teams.length > 1 ? `${clubName} ${team === 'blue' ? 'Blue' : 'Red'}` : clubName;
  const stepper = (value: number, set: (n: number) => void) => (
    <View style={styles.stepper}>
      <Pressable style={[styles.step, { backgroundColor: c.surface2 }]} onPress={() => set(Math.max(0, value - 1))} hitSlop={6} accessibilityLabel="One less">
        <Ionicons name="remove" size={20} color={c.ink} />
      </Pressable>
      <Text style={[styles.stepValue, { color: c.ink }]}>{value}</Text>
      <Pressable style={[styles.step, { backgroundColor: c.surface2 }]} onPress={() => set(Math.min(30, value + 1))} hitSlop={6} accessibilityLabel="One more">
        <Ionicons name="add" size={20} color={c.ink} />
      </Pressable>
    </View>
  );

  const quarter = open !== null ? quarters[open] : null;
  const filled = open !== null && (scoreOf(open).us !== null || scoreOf(open).them !== null || (stored?.[open + 1]?.length ?? 0) > 0);
  let title = 'Goals and scores';
  let body;
  if (!stored) {
    body = <ActivityIndicator color={c.pitch} style={{ marginTop: 24 }} />;
  } else if (quarter && choosing !== null) {
    title = `Goal ${choosing + 1}`;
    const pick = (id: string | null) => {
      setEntry({ ...entry, scorers: entry.scorers.map((s, n) => (n === choosing ? id : s)) });
      setChoosing(null);
    };
    body = (
      <View style={[styles.card, { backgroundColor: c.surface }]}>
        {players.map((p, i) => (
          <Pressable key={p.id} style={[styles.row, i > 0 && line]} onPress={() => pick(p.id)}>
            <Text style={[styles.label, { color: c.ink }]}>{`${p.firstName} ${p.lastName}`.trim()}</Text>
            {entry.scorers[choosing] === p.id ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
          </Pressable>
        ))}
        <Pressable style={[styles.row, players.length > 0 && line]} onPress={() => pick(null)}>
          <Text style={[styles.label, { color: c.inkSoft }]}>Unknown or own goal</Text>
          {entry.scorers[choosing] === null ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
        </Pressable>
      </View>
    );
  } else if (quarter) {
    title = quarter.label;
    body = (
      <>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <View style={styles.row}>
            <Text style={[styles.label, { color: c.ink }]} numberOfLines={1}>
              {ours}
            </Text>
            {stepper(entry.us, setUs)}
          </View>
          <View style={[styles.row, line]}>
            <Text style={[styles.label, { color: c.ink }]} numberOfLines={1}>
              {game.opponent && !/tournament/i.test(game.competition) ? game.opponent : 'Opponent'}
            </Text>
            {stepper(entry.them, (them) => setEntry({ ...entry, them }))}
          </View>
        </View>

        {entry.us > 0 ? (
          <>
            <Text style={[styles.caption, { color: c.inkSoft }]}>Goal scorers</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              {entry.scorers.map((id, n) => (
                <Pressable key={n} style={[styles.row, n > 0 && line]} onPress={() => setChoosing(n)}>
                  <Ionicons name="football-outline" size={18} color={c.inkSoft} />
                  <Text style={[styles.label, { color: id ? c.ink : c.inkSoft }]}>{name(id) ?? 'Choose who scored'}</Text>
                  <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {error ? <Text style={[styles.note, { color: c.danger }]}>{error}</Text> : null}
        <Pressable style={[styles.button, { backgroundColor: c.pitch }]} onPress={() => save()}>
          {saving ? <ActivityIndicator color={c.onPitch} /> : <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>Save {quarter.label}</Text>}
        </Pressable>
        {filled ? (
          <Pressable style={styles.button} onPress={() => save(true)}>
            <Text style={{ color: c.danger, fontFamily: fonts.medium, fontSize: 16 }}>Clear {quarter.label}</Text>
          </Pressable>
        ) : null}
      </>
    );
  } else {
    body = (
      <>
        {error ? <Text style={[styles.note, { color: c.danger }]}>{error}</Text> : null}
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          {quarters.map((q, i) => {
            const { us, them } = scoreOf(i);
            const done = us !== null && them !== null;
            return (
              <Pressable key={i} style={[styles.row, { minHeight: 58 }, i > 0 && line]} onPress={() => setOpen(i)}>
                <Text style={[styles.quarterLabel, { color: c.ink }]} numberOfLines={2}>
                  {q.label}
                </Text>
                {done ? (
                  <>
                    <Text style={[styles.score, { color: c.ink }]}>
                      {q.home} - {q.away}
                    </Text>
                    <ResultBadge result={us > them ? 'W' : us < them ? 'L' : 'D'} colors={{ W: c.win, D: c.amber, L: c.danger }} />
                  </>
                ) : (
                  <Text style={{ color: c.pitch, fontFamily: fonts.medium, fontSize: 15 }}>Add score</Text>
                )}
                <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.note, { color: c.inkSoft }]}>Tap a {game.competition === 'Tournament' ? 'game' : 'quarter'} to fill in its score and who scored.</Text>
      </>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: c.chalk }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable
          style={[styles.round, { backgroundColor: c.surface }]}
          onPress={() => (choosing !== null ? setChoosing(null) : open !== null && !params.quarter ? setOpen(null) : goBack())}
          accessibilityLabel="Back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.sub, { color: c.inkSoft }]} numberOfLines={1}>
            {game.opponent || 'TBD'} · {fmtDate(game.date)}
            {game.teams.length > 1 ? ` · ${team === 'blue' ? 'Blue' : 'Red'}` : ''}
          </Text>
        </View>
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
  title: { fontFamily: fonts.medium, fontSize: 17 },
  sub: { fontFamily: fonts.regular, fontSize: 13 },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  card: { borderRadius: 14, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingVertical: 9 },
  label: { flex: 1, fontFamily: fonts.regular, fontSize: 16 },
  quarterLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 16 },
  score: { fontFamily: fonts.semi, fontSize: 17 },
  caption: { fontFamily: fonts.regular, fontSize: 13, marginLeft: 12, marginTop: 6, marginBottom: -4 },
  note: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, marginHorizontal: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  step: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 26, textAlign: 'center', fontFamily: fonts.semi, fontSize: 20 },
  button: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
});
