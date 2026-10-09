import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fmtDate, useData, type Theme } from '../../lib/data';
import { groupOf, POSITION_GROUPS } from '../../lib/selection';
import { supabase } from '../../lib/supabase';
import { fonts, useColors } from '../../lib/theme';

// Shown label -> the value the web app stores (its ABSENCE_REASONS), so both
// apps and the attendance percentage read the same reasons.
const REASONS = [
  { label: 'Injured', value: 'Injured' },
  { label: 'Sick', value: 'Sick' },
  { label: 'School', value: 'School' },
  { label: 'GK training', value: 'GK Training' },
  { label: 'Training other team', value: 'Training with another team' },
  { label: 'Other', value: 'Other' },
];
const reasonLabel = (value: string) => REASONS.find((r) => r.value === value)?.label ?? (value || 'Absent');

// The pitches the team trains on.
const PITCHES = ['Walleke D', 'Gemeenteplein'];

type ThemeKey = 'major' | 'minor' | 'basic';
const THEME_LABELS: Record<ThemeKey, string> = { major: 'Major', minor: 'Minor', basic: 'Basics' };

// Themes under their category, both in the order the web app lists them.
function groupByCategory(items: Theme[]) {
  const groups = new Map<string, Theme[]>();
  for (const item of items) groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
  return [...groups];
}

// A training: its themes and its attendance, where everyone is present unless
// marked absent with a reason. Nothing is written until "Save".
export default function TrainingScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trainings, players, teamTactics, basics, refresh } = useData();
  const training = trainings.find((t) => t.id === id);

  // Player id -> reason, for absent players only.
  const [absent, setAbsent] = useState<Record<string, string>>(() => ({ ...(training?.absences ?? {}) }));
  const [choosing, setChoosing] = useState<string | null>(null);
  // The three themes, and which one is being chosen.
  const [themes, setThemes] = useState({
    major: training?.majorTacticId ?? null,
    minor: training?.minorTacticId ?? null,
    basic: training?.basicId ?? null,
  });
  const [choosingTheme, setChoosingTheme] = useState<ThemeKey | null>(null);
  const [pitch, setPitch] = useState(training?.location ?? '');
  const [choosingPitch, setChoosingPitch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!training) {
    return (
      <View style={[styles.page, { backgroundColor: c.chalk, paddingTop: insets.top + 60, alignItems: 'center' }]}>
        <Text style={{ color: c.inkSoft, fontFamily: fonts.regular }}>This training no longer exists.</Text>
      </View>
    );
  }

  const time = [training.startTime, training.endTime].filter(Boolean).join(' – ');
  const absentCount = players.filter((p) => p.id in absent).length;
  // Present players, split into keepers and field players.
  const present = players.filter((p) => !(p.id in absent));
  const keepersPresent = present.filter((p) => groupOf(p.bestPosition) === 0).length;
  const fieldPresent = present.length - keepersPresent;
  const attendanceChanged =
    Object.keys(absent).length !== Object.keys(training.absences).length ||
    Object.entries(absent).some(([playerId, reason]) => training.absences[playerId] !== reason);
  const themesChanged =
    themes.major !== training.majorTacticId || themes.minor !== training.minorTacticId || themes.basic !== training.basicId;
  const pitchChanged = pitch !== training.location;
  const changed = attendanceChanged || themesChanged || pitchChanged;
  const themeList = (key: ThemeKey) => (key === 'basic' ? basics : teamTactics);
  const themeName = (key: ThemeKey) => themeList(key).find((x) => x.id === themes[key])?.name ?? 'Choose';

  function choose(playerId: string, reason: string | null) {
    const next = { ...absent };
    if (reason === null) delete next[playerId];
    else next[playerId] = reason;
    setAbsent(next);
    setChoosing(null);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError('');
    const back = Object.keys(training!.absences).filter((playerId) => !(playerId in absent));
    const rows = Object.entries(absent).map(([playerId, reason]) => ({ training_id: training!.id, player_id: playerId, reason }));
    const upserted = rows.length
      ? await supabase.from('training_absences').upsert(rows, { onConflict: 'training_id,player_id' })
      : null;
    // Players marked present again lose their absence record.
    const removed =
      !upserted?.error && back.length
        ? await supabase.from('training_absences').delete().eq('training_id', training!.id).in('player_id', back)
        : null;
    const themed =
      !upserted?.error && !removed?.error && (themesChanged || pitchChanged)
        ? await supabase
            .from('trainings')
            .update({ major_tactic_id: themes.major, minor_tactic_id: themes.minor, basic_id: themes.basic, location: pitch })
            .eq('id', training!.id)
        : null;
    const failed = upserted?.error ?? removed?.error ?? themed?.error;
    if (failed) {
      setError(`Could not save the training: ${failed.message}`);
      setSaving(false);
      return;
    }
    await refresh();
    router.back();
  }

  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };
  const player = choosing ? players.find((p) => p.id === choosing) : null;
  const groups = [...POSITION_GROUPS.map((g) => g.label), 'Other']
    .map((label, i) => ({ label, players: players.filter((p) => groupOf(p.bestPosition) === i) }))
    .filter((g) => g.players.length);

  return (
    <View style={[styles.page, { backgroundColor: c.chalk }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable
          style={[styles.round, { backgroundColor: c.surface }]}
          onPress={() => (choosingPitch ? setChoosingPitch(false) : choosingTheme ? setChoosingTheme(null) : player ? setChoosing(null) : router.back())}
          accessibilityLabel={player || choosingTheme || choosingPitch ? 'Back' : 'Close'}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>
            {choosingPitch ? 'Pitch' : choosingTheme ? THEME_LABELS[choosingTheme] : player ? `${player.firstName} ${player.lastName}`.trim() : training.label}
          </Text>
          {player || choosingTheme || choosingPitch ? null : (
            <Text style={[styles.sub, { color: c.inkSoft }]} numberOfLines={1}>
              {fmtDate(training.date)}
              {time ? ` · ${time}` : ''}
              {pitch ? ` · ${pitch}` : ''}
            </Text>
          )}
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {choosingPitch ? (
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            {PITCHES.map((name, i) => (
              <Pressable
                key={name}
                style={[styles.row, i > 0 && line]}
                onPress={() => {
                  setPitch(name);
                  setChoosingPitch(false);
                }}
              >
                <Text style={[styles.label, { color: c.ink }]}>{name}</Text>
                {pitch === name ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
              </Pressable>
            ))}
          </View>
        ) : choosingTheme ? (
          <>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <Pressable
                style={styles.row}
                onPress={() => {
                  setThemes({ ...themes, [choosingTheme]: null });
                  setChoosingTheme(null);
                }}
              >
                <Text style={[styles.label, { color: c.ink }]}>None</Text>
                {themes[choosingTheme] === null ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
              </Pressable>
            </View>
            {groupByCategory(themeList(choosingTheme)).map(([category, items]) => (
              <View key={category} style={{ gap: 8 }}>
                <Text style={[styles.group, { color: c.inkSoft }]}>{category || 'Other'}</Text>
                <View style={[styles.card, { backgroundColor: c.surface }]}>
                  {items.map((item, i) => (
                    <Pressable
                      key={item.id}
                      style={[styles.row, i > 0 && line]}
                      onPress={() => {
                        setThemes({ ...themes, [choosingTheme]: item.id });
                        setChoosingTheme(null);
                      }}
                    >
                      <Text style={[styles.label, { color: c.ink }]}>{item.name}</Text>
                      {themes[choosingTheme] === item.id ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </>
        ) : player ? (
          <>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <Pressable style={styles.row} onPress={() => choose(player.id, null)}>
                <Text style={[styles.label, { color: c.ink }]}>Present</Text>
                {!(player.id in absent) ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
              </Pressable>
            </View>
            <Text style={[styles.group, { color: c.inkSoft }]}>Absent</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              {REASONS.map((reason, i) => (
                <Pressable key={reason.value} style={[styles.row, i > 0 && line]} onPress={() => choose(player.id, reason.value)}>
                  <Text style={[styles.label, { color: c.ink }]}>{reason.label}</Text>
                  {absent[player.id] === reason.value ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <>
            <View style={styles.tiles}>
              {[
                { label: 'Players', value: String(fieldPresent) },
                { label: 'Goalkeepers', value: String(keepersPresent) },
                { label: 'Absent', value: String(absentCount) },
              ].map((tile) => (
                <View key={tile.label} style={[styles.tile, { backgroundColor: c.surface }]}>
                  <Text style={[styles.tileValue, { color: c.ink }]}>{tile.value}</Text>
                  <Text style={[styles.tileLabel, { color: c.inkSoft }]} numberOfLines={1}>
                    {tile.label}
                  </Text>
                </View>
              ))}
            </View>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <Pressable style={styles.row} onPress={() => setChoosingPitch(true)}>
                <Text style={[styles.label, { color: c.ink }]}>Pitch</Text>
                <Text style={{ color: pitch ? c.ink : c.inkSoft, fontFamily: fonts.regular, fontSize: 15 }}>{pitch || 'Choose'}</Text>
                <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
              </Pressable>
            </View>

            <Text style={[styles.section, { color: c.ink }]}>Training themes</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              {(['major', 'minor', 'basic'] as ThemeKey[]).map((key, i) => (
                <Pressable key={key} style={[styles.row, i > 0 && line]} onPress={() => setChoosingTheme(key)}>
                  <Text style={{ width: 56, color: c.ink, fontFamily: fonts.regular, fontSize: 16 }}>{THEME_LABELS[key]}</Text>
                  <Text
                    style={{ flex: 1, textAlign: 'right', color: themes[key] ? c.ink : c.inkSoft, fontFamily: fonts.regular, fontSize: 15 }}
                    numberOfLines={2}
                  >
                    {themeName(key)}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
                </Pressable>
              ))}
            </View>

            <Text style={[styles.section, { color: c.ink }]}>Attendance</Text>
            {groups.map((g) => (
              <View key={g.label} style={{ gap: 8 }}>
                <Text style={[styles.group, { color: c.inkSoft }]}>{g.label}</Text>
                <View style={[styles.card, { backgroundColor: c.surface }]}>
                  {g.players.map((p, i) => {
                    const away = p.id in absent;
                    return (
                      <Pressable key={p.id} style={[styles.row, i > 0 && line]} onPress={() => setChoosing(p.id)}>
                        <View style={[styles.badge, { backgroundColor: c.surface2 }]}>
                          <Text style={{ color: c.ink, fontFamily: fonts.semi, fontSize: 13 }}>{p.bestPosition || '–'}</Text>
                        </View>
                        <Text style={[styles.label, { color: c.ink }]} numberOfLines={1}>
                          {p.firstName} {p.lastName}
                        </Text>
                        <View style={[styles.pill, { backgroundColor: (away ? c.danger : c.win) + '24' }]}>
                          <Text style={{ color: away ? c.danger : c.win, fontFamily: fonts.medium, fontSize: 12.5 }}>
                            {away ? reasonLabel(absent[p.id]) : 'Present'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            {error ? <Text style={[styles.sub, { color: c.danger, marginHorizontal: 12 }]}>{error}</Text> : null}
            {changed ? (
              <Pressable style={[styles.button, { backgroundColor: c.pitch }]} onPress={save}>
                {saving ? <ActivityIndicator color={c.onPitch} /> : <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>Save</Text>}
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.medium, fontSize: 17 },
  sub: { fontFamily: fonts.regular, fontSize: 13 },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  card: { borderRadius: 14, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingVertical: 9 },
  label: { flex: 1, fontFamily: fonts.regular, fontSize: 16 },
  section: { fontFamily: fonts.medium, fontSize: 19, marginTop: 6 },
  group: { fontFamily: fonts.medium, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase', marginLeft: 12, marginTop: 4 },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 2 },
  tileValue: { fontFamily: fonts.semi, fontSize: 22 },
  tileLabel: { fontFamily: fonts.regular, fontSize: 12 },
  button: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
});
