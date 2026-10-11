import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fmtDate, TEAM_RATING_GUIDES, TEAM_RATING_LABELS, useData, type Team } from '../lib/data';
import { goBack } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';
import { EditIcon } from '../components/Icons';

// A text part of the report: a field of its own, or the note of one quarter.
type Part = { key: string; title: string; text: string; field?: 'opponent' | 'wentWell' | 'toImprove'; quarter?: number };

// One team's post-match report: the team performance, the opponent, notes per
// quarter, what went well and what to improve. Every part opens a page to
// write or change it, and saves on its own.
export default function GameReportScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ game: string; team: Team }>();
  const { games, refresh } = useData();
  const game = games.find((g) => g.id === params.game);
  const team = params.team;

  const [rating, setRating] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!game) {
    return (
      <View style={[styles.page, { backgroundColor: c.chalk, paddingTop: insets.top + 60, alignItems: 'center' }]}>
        <Text style={{ color: c.inkSoft, fontFamily: fonts.regular }}>This game no longer exists.</Text>
      </View>
    );
  }

  const report = game.reports[team];
  const labels = game.quarters[team]?.map((q) => q.label) ?? report?.quarterNotes.map((q) => q.label) ?? ['Q1', 'Q2', 'Q3', 'Q4'];
  const parts: Part[] = [
    { key: 'opponent', title: 'About the opponent', text: report?.opponent ?? '', field: 'opponent' },
    ...labels.map((label, i) => ({ key: `q${i}`, title: label, text: report?.quarterNotes[i]?.note ?? '', quarter: i })),
    { key: 'wentWell', title: 'What went well', text: report?.wentWell ?? '', field: 'wentWell' },
    { key: 'toImprove', title: 'What do we have to improve', text: report?.toImprove ?? '', field: 'toImprove' },
  ];

  // The report lives inside the team's line-up record, next to the line-ups
  // themselves, so the latest record is read first and only the report changes.
  async function save(change: { score: number | null } | { part: Part; text: string }) {
    if (saving) return;
    setSaving(true);
    setError('');
    const fresh = await supabase.from('games').select('lineups').eq('id', game!.id).single();
    const record = fresh.data?.lineups?.[team] ?? {};
    const before = record.eval ?? {};
    const report = {
      score: before.score ?? null,
      opponent: before.opponent ?? '',
      quarterNotes: labels.map((_, i) => before.quarterNotes?.[i] ?? ''),
      wentWell: before.wentWell ?? '',
      toImprove: before.toImprove ?? '',
    };
    if ('score' in change) report.score = change.score;
    else if (change.part.field) report[change.part.field] = change.text;
    else report.quarterNotes[change.part.quarter!] = change.text;
    const saved = fresh.error
      ? fresh
      : await supabase.rpc('patch_game_team_lineup', { p_game_id: game!.id, p_team: team, p_value: { ...record, eval: { ...before, ...report } } });
    if (saved.error) {
      setError(`Could not save the report: ${saved.error.message}`);
      setSaving(false);
      return;
    }
    await refresh();
    setSaving(false);
    setRating(false);
    setEditing(null);
  }

  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };
  const open = (part: Part) => {
    setDraft(part.text);
    setEditing(part);
  };
  const sub = `${game.opponent || 'TBD'} · ${fmtDate(game.date)}${game.teams.length > 1 ? ` · ${team === 'blue' ? 'Blue' : 'Red'}` : ''}`;

  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: c.chalk }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable
          style={[styles.round, { backgroundColor: c.surface }]}
          onPress={() => (rating ? setRating(false) : editing ? setEditing(null) : goBack())}
          accessibilityLabel="Back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>
            {rating ? 'Team performance' : editing ? editing.title : 'Game report'}
          </Text>
          <Text style={[styles.sub, { color: c.inkSoft }]} numberOfLines={1}>
            {sub}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <Text style={{ color: c.danger, fontFamily: fonts.regular, fontSize: 13 }}>{error}</Text> : null}
        {rating ? (
          <View style={[styles.card, { backgroundColor: c.surface, paddingVertical: 4 }]}>
            {[5, 4, 3, 2, 1].map((score, i) => (
              <Pressable key={score} style={[styles.option, { alignItems: 'flex-start', paddingVertical: 13 }, i > 0 && line]} onPress={() => save({ score })}>
                <View style={[styles.badge, { backgroundColor: c.rating[score - 1] }]}>
                  <Text style={{ color: '#fff', fontFamily: fonts.semi, fontSize: 15 }}>{score}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.label, { color: c.ink }]}>{TEAM_RATING_LABELS[score - 1]}</Text>
                  <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 }}>{TEAM_RATING_GUIDES[score - 1]}</Text>
                </View>
                {report?.score === score ? <Ionicons name="checkmark" size={20} color={c.pitch} style={{ marginTop: 6 }} /> : null}
              </Pressable>
            ))}
            <Pressable style={[styles.option, line]} onPress={() => save({ score: null })}>
              <View style={[styles.badge, { backgroundColor: c.surface2 }]}>
                <Text style={{ color: c.inkSoft, fontFamily: fonts.semi, fontSize: 15 }}>–</Text>
              </View>
              <Text style={[styles.label, { color: c.ink, flex: 1 }]}>Not rated</Text>
              {!report?.score ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
            </Pressable>
          </View>
        ) : editing ? (
          <>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <TextInput
                style={[styles.text, { color: c.ink, minHeight: 180, textAlignVertical: 'top', paddingVertical: 0 }]}
                value={draft}
                onChangeText={setDraft}
                placeholder="Write your report"
                placeholderTextColor={c.inkSoft}
                multiline
                autoFocus
              />
            </View>
            <Pressable style={[styles.button, { backgroundColor: c.pitch }]} onPress={() => save({ part: editing, text: draft.trim() })}>
              {saving ? <ActivityIndicator color={c.onPitch} /> : <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>Save</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.section, { color: c.ink, marginTop: 0 }]}>Team performance</Text>
            <Pressable style={[styles.card, styles.row, { backgroundColor: c.surface }]} onPress={() => setRating(true)}>
              <View style={[styles.score, { backgroundColor: report?.score ? c.rating[report.score - 1] : c.surface2 }]}>
                <Text style={[styles.scoreText, { color: report?.score ? '#fff' : c.inkSoft }]}>{report?.score ?? '–'}</Text>
              </View>
              <Text style={[styles.label, { color: c.ink, flex: 1 }]}>{report?.score ? TEAM_RATING_LABELS[report.score - 1] : 'Not rated yet'}</Text>
              <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
            </Pressable>

            {parts.map((part) => (
              <View key={part.key} style={{ gap: 10 }}>
                <View style={styles.head}>
                  <Text style={[styles.section, { color: c.ink, marginTop: 0, flex: 1 }]}>{part.title}</Text>
                  {part.text ? (
                    <Pressable
                      style={[styles.round, { backgroundColor: c.surface }]}
                      onPress={() => open(part)}
                      accessibilityLabel={`Edit ${part.title}`}
                      hitSlop={8}
                    >
                      <EditIcon color={c.ink} />
                    </Pressable>
                  ) : null}
                </View>
                {part.text ? (
                  <View style={[styles.card, { backgroundColor: c.surface }]}>
                    <Text style={[styles.text, { color: c.ink }]}>{part.text}</Text>
                  </View>
                ) : (
                  <Pressable style={[styles.write, { backgroundColor: c.surface }]} onPress={() => open(part)}>
                    <EditIcon color={c.pitch} />
                    <Text style={{ color: c.pitch, fontFamily: fonts.medium, fontSize: 15 }}>Write your report</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.medium, fontSize: 17 },
  sub: { fontFamily: fonts.regular, fontSize: 13 },
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  card: { borderRadius: 12, padding: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36, marginTop: 12 },
  score: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  scoreText: { fontFamily: fonts.semi, fontSize: 24 },
  label: { fontFamily: fonts.medium, fontSize: 16 },
  section: { fontFamily: fonts.medium, fontSize: 19, marginTop: 12 },
  text: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 8 },
  badge: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  write: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14 },
  button: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
});
