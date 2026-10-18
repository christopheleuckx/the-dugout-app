import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EditIcon } from '../components/Icons';
import {
  CRITERION_GUIDES,
  CRITERION_LABELS,
  fmtDate,
  OPPONENT_GUIDES,
  OPPONENT_LABELS,
  TEAM_CRITERIA,
  TEAM_RATING_GUIDES,
  TEAM_RATING_LABELS,
  useData,
  type Team,
} from '../lib/data';
import { goBack } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';

const VEO_LOGO = require('../../assets/veo.png');
const VEO_GREEN = '#0B3D18';

// A text part of the report: a field of its own, or the note of one quarter.
type Part = { key: string; title: string; text: string; field?: 'opponent' | 'summary' | 'wentWell' | 'toImprove'; quarter?: number };

// A 1-to-5 rating in the report, and where its score is kept.
type Scale = { kind: 'team' } | { kind: 'opponent' } | { kind: 'criterion'; key: string };

// The page on top of the report: choosing a rating, the match report with its
// summary and quarters, or writing one text (which returns to "back").
type Page = null | { scale: Scale } | { match: true } | { edit: Part; back: Page } | { veo: true };

type Stored = {
  score: number | null;
  criteria: Record<string, number | null>;
  opponentScore: number | null;
  opponent: string;
  summary: string;
  quarterNotes: string[];
  wentWell: string;
  toImprove: string;
};

// One team's post-match report: the team performance in general and per
// criterion, the opponent, the match report (a summary and notes per quarter),
// what went well and what to improve. Every part opens a page to fill it in or
// change it, and saves on its own.
export default function GameReportScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ game: string; team: Team }>();
  const { games, refresh } = useData();
  const game = games.find((g) => g.id === params.game);
  const team = params.team;

  const [page, setPage] = useState<Page>(null);
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
  const opponent: Part = { key: 'opponent', title: 'About the opponent', text: report?.opponent ?? '', field: 'opponent' };
  const summary: Part = { key: 'summary', title: 'Game summary', text: report?.summary ?? '', field: 'summary' };
  const quarters: Part[] = labels.map((label, i) => ({ key: `q${i}`, title: label, text: report?.quarterNotes[i]?.note ?? '', quarter: i }));
  const wentWell: Part = { key: 'wentWell', title: 'What went well', text: report?.wentWell ?? '', field: 'wentWell' };
  const toImprove: Part = { key: 'toImprove', title: 'What do we have to improve', text: report?.toImprove ?? '', field: 'toImprove' };
  // The match report as one text: the summary, then every quarter with a note.
  const matchParts = [summary, ...quarters].filter((part) => part.text);

  // The report lives inside the team's line-up record, next to the line-ups
  // themselves, so the latest record is read first and only the report changes.
  // The Veo link sits in the team's line-up record too, next to the report.
  const veoUrl = game.veoUrls[team] ?? '';
  async function saveVeo(url: string) {
    if (saving) return;
    const clean = url.trim();
    if (clean && !/^https?:\/\/\S+$/i.test(clean)) return setError('Paste the full link, starting with https://');
    setSaving(true);
    setError('');
    const fresh = await supabase.from('games').select('lineups').eq('id', game!.id).single();
    const record = { ...(fresh.data?.lineups?.[team] ?? {}) };
    if (clean) record.veoUrl = clean;
    else delete record.veoUrl;
    const saved = fresh.error ? fresh : await supabase.rpc('patch_game_team_lineup', { p_game_id: game!.id, p_team: team, p_value: record });
    if (saved.error) {
      setError(`Could not save the link: ${saved.error.message}`);
      setSaving(false);
      return;
    }
    await refresh();
    setSaving(false);
    setPage(null);
  }

  async function save(change: (report: Stored) => void, then: Page) {
    if (saving) return;
    setSaving(true);
    setError('');
    const fresh = await supabase.from('games').select('lineups').eq('id', game!.id).single();
    const record = fresh.data?.lineups?.[team] ?? {};
    const before = record.eval ?? {};
    const next: Stored = {
      score: before.score ?? null,
      criteria: { ...(before.criteria ?? {}) },
      opponentScore: before.opponentScore ?? null,
      opponent: before.opponent ?? '',
      summary: before.summary ?? '',
      quarterNotes: labels.map((_, i) => before.quarterNotes?.[i] ?? ''),
      wentWell: before.wentWell ?? '',
      toImprove: before.toImprove ?? '',
    };
    change(next);
    const saved = fresh.error
      ? fresh
      : await supabase.rpc('patch_game_team_lineup', { p_game_id: game!.id, p_team: team, p_value: { ...record, eval: { ...before, ...next } } });
    if (saved.error) {
      setError(`Could not save the report: ${saved.error.message}`);
      setSaving(false);
      return;
    }
    await refresh();
    setSaving(false);
    setPage(then);
  }

  const saveText = (part: Part, text: string, then: Page) =>
    save((r) => {
      if (part.field) r[part.field] = text;
      else r.quarterNotes[part.quarter!] = text;
    }, then);

  const scaleOf = (scale: Scale) => {
    if (scale.kind === 'team') return { title: 'Team performance', about: '', labels: TEAM_RATING_LABELS, guides: TEAM_RATING_GUIDES, score: report?.score ?? null };
    if (scale.kind === 'opponent') {
      return { title: 'Opponent strength', about: '', labels: OPPONENT_LABELS, guides: OPPONENT_GUIDES, score: report?.opponentScore ?? null };
    }
    const criterion = TEAM_CRITERIA.find((x) => x.key === scale.key)!;
    return { title: criterion.title, about: criterion.about, labels: CRITERION_LABELS, guides: CRITERION_GUIDES, score: report?.criteria[scale.key] ?? null };
  };
  const saveScore = (scale: Scale, score: number | null) =>
    save((r) => {
      if (scale.kind === 'team') r.score = score;
      else if (scale.kind === 'opponent') r.opponentScore = score;
      else r.criteria[scale.key] = score;
    }, null);

  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };
  const open = (part: Part, back: Page) => {
    setDraft(part.text);
    setPage({ edit: part, back });
  };
  const sub = `${game.opponent || 'TBD'} · ${fmtDate(game.date)}${game.teams.length > 1 ? ` · ${team === 'blue' ? 'Blue' : 'Red'}` : ''}`;
  const badge = (score: number | null, big = false) => (
    <View style={[big ? styles.score : styles.badge, { backgroundColor: score ? c.rating[score - 1] : c.surface2 }]}>
      <Text style={{ color: score ? '#fff' : c.inkSoft, fontFamily: fonts.semi, fontSize: big ? 24 : 15 }}>{score ?? '–'}</Text>
    </View>
  );

  // A title with, once something is written, the edit button next to it.
  const head = (title: string, filled: boolean, onEdit: () => void, icon?: { name: ComponentProps<typeof Ionicons>['name']; color: string }) => (
    <View style={styles.head}>
      {icon ? <Ionicons name={icon.name} size={22} color={icon.color} /> : null}
      <Text style={[styles.section, { color: c.ink, marginTop: 0, flex: 1 }]}>{title}</Text>
      {filled ? (
        <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={onEdit} accessibilityLabel={`Edit ${title}`} hitSlop={8}>
          <EditIcon color={c.ink} />
        </Pressable>
      ) : null}
    </View>
  );
  const write = (label: string, onPress: () => void) => (
    <Pressable style={[styles.write, { backgroundColor: c.surface }]} onPress={onPress}>
      <EditIcon color={c.pitch} size={18} />
      <Text style={{ color: c.pitch, fontFamily: fonts.medium, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
  // A text part: its title, then the text or the button to write it.
  const textPart = (part: Part, back: Page, icon?: { name: ComponentProps<typeof Ionicons>['name']; color: string }) => (
    <View key={part.key} style={{ gap: 10 }}>
      {head(part.title, !!part.text, () => open(part, back), icon)}
      {part.text ? (
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <Text style={[styles.text, { color: c.ink }]}>{part.text}</Text>
        </View>
      ) : (
        write('Write your report', () => open(part, back))
      )}
    </View>
  );

  let title = 'Game report';
  let body;
  if (page && 'veo' in page) {
    title = 'Veo';
    body = (
      <>
        <Image source={VEO_LOGO} style={styles.veoBig} accessibilityLabel="Veo" />
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <TextInput
            style={[styles.veoInput, { color: c.ink }]}
            value={draft}
            onChangeText={setDraft}
            placeholder="https://app.veo.co/matches/…"
            placeholderTextColor={c.inkSoft}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            autoFocus
          />
        </View>
        <Text style={[styles.guide, { color: c.inkSoft, marginHorizontal: 12 }]}>Paste the link of this game's recording on Veo. Tapping the Veo tag on the report then opens it.</Text>
        {error ? <Text style={[styles.guide, { color: c.danger, marginHorizontal: 12 }]}>{error}</Text> : null}
        <Pressable style={[styles.button, { backgroundColor: c.pitch }]} onPress={() => saveVeo(draft)}>
          {saving ? <ActivityIndicator color={c.onPitch} /> : <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>Save link</Text>}
        </Pressable>
        {veoUrl ? (
          <Pressable style={styles.button} onPress={() => saveVeo('')}>
            <Text style={{ color: c.danger, fontFamily: fonts.medium, fontSize: 16 }}>Remove link</Text>
          </Pressable>
        ) : null}
      </>
    );
  } else if (page && 'scale' in page) {
    const scale = scaleOf(page.scale);
    title = scale.title;
    body = (
      <>
        {scale.about ? <Text style={[styles.about, { color: c.inkSoft }]}>{scale.about}</Text> : null}
        <View style={[styles.card, { backgroundColor: c.surface, paddingVertical: 4 }]}>
          {[5, 4, 3, 2, 1].map((score, i) => (
            <Pressable key={score} style={[styles.option, i > 0 && line]} onPress={() => saveScore(page.scale, score)}>
              {badge(score)}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.label, { color: c.ink }]}>{scale.labels[score - 1]}</Text>
                <Text style={[styles.guide, { color: c.inkSoft }]}>{scale.guides[score - 1]}</Text>
              </View>
              {scale.score === score ? <Ionicons name="checkmark" size={20} color={c.pitch} style={{ marginTop: 6 }} /> : null}
            </Pressable>
          ))}
          <Pressable style={[styles.option, line, { alignItems: 'center' }]} onPress={() => saveScore(page.scale, null)}>
            {badge(null)}
            <Text style={[styles.label, { color: c.ink, flex: 1 }]}>Not rated</Text>
            {!scale.score ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
          </Pressable>
        </View>
      </>
    );
  } else if (page && 'edit' in page) {
    title = page.edit.title;
    body = (
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
        <Pressable style={[styles.button, { backgroundColor: c.pitch }]} onPress={() => saveText(page.edit, draft.trim(), page.back)}>
          {saving ? <ActivityIndicator color={c.onPitch} /> : <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>Save</Text>}
        </Pressable>
      </>
    );
  } else if (page && 'match' in page) {
    title = 'Match report';
    body = <>{[summary, ...quarters].map((part, i) => <View key={part.key} style={i === 0 && { marginTop: -12 }}>{textPart(part, page)}</View>)}</>;
  } else {
    body = (
      <>
        {/* The recording on Veo: tap to watch, or to add the link. */}
        <View style={styles.veoRow}>
          <Pressable
            style={({ pressed }) => [styles.veoTag, pressed && { opacity: 0.8 }]}
            onPress={() => (veoUrl ? Linking.openURL(veoUrl).catch(() => setError('Could not open the Veo link.')) : (setDraft(''), setError(''), setPage({ veo: true })))}
            accessibilityLabel={veoUrl ? 'Watch this game on Veo' : 'Add the Veo link'}
          >
            <Image source={VEO_LOGO} style={styles.veoLogo} />
            <Text style={styles.veoText}>{veoUrl ? 'Watch game' : 'Add link'}</Text>
            <Ionicons name={veoUrl ? 'open-outline' : 'add'} size={15} color="#fff" />
          </Pressable>
          {veoUrl ? (
            <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={() => (setDraft(veoUrl), setError(''), setPage({ veo: true }))} accessibilityLabel="Change the Veo link" hitSlop={8}>
              <EditIcon color={c.ink} />
            </Pressable>
          ) : null}
        </View>

        <Text style={[styles.section, { color: c.ink, marginTop: 0 }]}>Team performance</Text>
        <Pressable style={[styles.card, styles.row, { backgroundColor: c.surface }]} onPress={() => setPage({ scale: { kind: 'team' } })}>
          {badge(report?.score ?? null, true)}
          <Text style={[styles.label, { color: c.ink, flex: 1 }]}>{report?.score ? TEAM_RATING_LABELS[report.score - 1] : 'Not rated yet'}</Text>
          <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
        </Pressable>
        <View style={[styles.card, { backgroundColor: c.surface, paddingVertical: 4 }]}>
          {TEAM_CRITERIA.map((criterion, i) => {
            const score = report?.criteria[criterion.key] ?? null;
            return (
              <Pressable key={criterion.key} style={[styles.option, i > 0 && line]} onPress={() => setPage({ scale: { kind: 'criterion', key: criterion.key } })}>
                {badge(score)}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.label, { color: c.ink, fontSize: 15 }]}>{criterion.title}</Text>
                  {score ? (
                    <Text style={[styles.guide, { color: c.inkSoft }]}>
                      <Text style={{ color: c.ink, fontFamily: fonts.medium }}>{CRITERION_LABELS[score - 1]}</Text> · {CRITERION_GUIDES[score - 1]}
                    </Text>
                  ) : (
                    <Text style={[styles.guide, { color: c.inkSoft }]}>Not rated yet</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.inkSoft} style={{ marginTop: 8 }} />
              </Pressable>
            );
          })}
        </View>

        {head(opponent.title, !!opponent.text, () => open(opponent, null))}
        <Pressable style={[styles.card, styles.row, { backgroundColor: c.surface, paddingVertical: 14 }]} onPress={() => setPage({ scale: { kind: 'opponent' } })}>
          {badge(report?.opponentScore ?? null)}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.label, { color: c.ink, fontSize: 15 }]}>Opponent strength</Text>
            <Text style={[styles.guide, { color: c.inkSoft }]}>{report?.opponentScore ? OPPONENT_LABELS[report.opponentScore - 1] : 'Not rated yet'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
        </Pressable>
        {opponent.text ? (
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            <Text style={[styles.text, { color: c.ink }]}>{opponent.text}</Text>
          </View>
        ) : (
          write('Write your report', () => open(opponent, null))
        )}

        {head('Match report', matchParts.length > 0, () => setPage({ match: true }))}
        {matchParts.length ? (
          <View style={[styles.card, { backgroundColor: c.surface, gap: 14 }]}>
            {matchParts.map((part) => (
              <View key={part.key} style={{ gap: 3 }}>
                {part.field ? null : <Text style={{ color: c.inkSoft, fontFamily: fonts.medium, fontSize: 13 }}>{part.title}</Text>}
                <Text style={[styles.text, { color: c.ink }]}>{part.text}</Text>
              </View>
            ))}
          </View>
        ) : (
          write('Write match report', () => setPage({ match: true }))
        )}

        {textPart(wentWell, null, { name: 'thumbs-up-outline', color: c.win })}
        {textPart(toImprove, null, { name: 'trending-up-outline', color: c.amber })}
      </>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: c.chalk }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable
          style={[styles.round, { backgroundColor: c.surface }]}
          onPress={() => (!page ? goBack() : setPage('edit' in page ? page.back : null))}
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
            {sub}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <Text style={{ color: c.danger, fontFamily: fonts.regular, fontSize: 13 }}>{error}</Text> : null}
        {body}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  veoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  veoTag: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: VEO_GREEN, borderRadius: 999, paddingLeft: 4, paddingRight: 12, height: 34 },
  veoLogo: { width: 46, height: 26, borderRadius: 13 },
  veoText: { color: '#fff', fontFamily: fonts.medium, fontSize: 14 },
  veoBig: { width: 120, height: 66, borderRadius: 12, alignSelf: 'center', marginVertical: 8 },
  veoInput: { fontFamily: fonts.regular, fontSize: 16, paddingVertical: 14 },
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
  label: { fontFamily: fonts.medium, fontSize: 16 },
  guide: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  about: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, marginHorizontal: 4, marginBottom: 4 },
  section: { fontFamily: fonts.medium, fontSize: 19, marginTop: 12 },
  text: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  option: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 13 },
  badge: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  write: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14 },
  button: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
});
