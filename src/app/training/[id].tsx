import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fmtDate, injuryOn, useData, type Theme } from '../../lib/data';
import { groupOf, POSITION_GROUPS } from '../../lib/selection';
import { supabase } from '../../lib/supabase';
import { fonts, useColors } from '../../lib/theme';
import { goBack } from '../../lib/nav';
import { EditIcon } from '../../components/Icons';

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
const PITCHES = ['Walleken D', 'Gemeenteplein'];

// The attendance list can be narrowed to who comes or who doesn't.
type Filter = 'all' | 'attending' | 'absent';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'attending', label: 'Attending' },
  { key: 'absent', label: 'Absent' },
];

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
  const { trainings, players, teamTactics, basics, videos, videoEnabled, refresh } = useData();
  const training = trainings.find((t) => t.id === id);

  // Player id -> reason, for absent players only.
  const [absent, setAbsent] = useState<Record<string, string>>(() => ({ ...(training?.absences ?? {}) }));
  const [choosing, setChoosing] = useState<string | null>(null);
  // The themes (one major, one minor, any number of basics), and which one is being chosen.
  const [themes, setThemes] = useState({
    major: training?.majorTacticId ?? null,
    minor: training?.minorTacticId ?? null,
  });
  const [basicIds, setBasicIds] = useState<string[]>(training?.basicIds ?? []);
  const [choosingTheme, setChoosingTheme] = useState<ThemeKey | null>(null);
  const [pitch, setPitch] = useState(training?.location ?? '');
  const [choosingPitch, setChoosingPitch] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
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
    themes.major !== training.majorTacticId || themes.minor !== training.minorTacticId || basicIds.join() !== training.basicIds.join();
  const pitchChanged = pitch !== training.location;
  const changed = attendanceChanged || themesChanged || pitchChanged;
  const themeList = (key: ThemeKey) => (key === 'basic' ? basics : teamTactics);
  const chosen = (key: ThemeKey) => (key === 'basic' ? basicIds : [themes[key]].filter((x): x is string => !!x));
  const themeName = (key: ThemeKey) =>
    chosen(key)
      .map((themeId) => themeList(key).find((x) => x.id === themeId)?.name)
      .filter(Boolean)
      .join('\n') || 'Choose';

  function apply(playerId: string, reason: string | null) {
    setAbsent((now) => {
      const next = { ...now };
      if (reason === null) delete next[playerId];
      else next[playerId] = reason;
      return next;
    });
    setChoosing(null);
  }

  // Choosing for a player also keeps their injury in step: an injured player
  // set to anything else may be taken out of injury, and a player set to
  // 'Injured' without an injury may get one from this training's day on.
  function choose(playerId: string, reason: string | null) {
    const p = players.find((x) => x.id === playerId);
    const injury = p ? injuryOn(p, training!.date) : null;
    if (p && injury && reason !== 'Injured') {
      setChoosing(null);
      Alert.alert(`Take ${p.firstName} out of injury?`, `${p.firstName} is injured since ${fmtDate(injury.startDate)}. Yes marks the injury as recovered from ${fmtDate(training!.date)} on.`, [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            const endedOn = training!.date < injury.startDate ? injury.startDate : training!.date;
            const { error: failed } = await supabase.from('player_injuries').update({ ended_on: endedOn }).eq('id', injury.id);
            if (failed) return setError(`Could not end the injury: ${failed.message}`);
            apply(playerId, reason);
            refresh();
          },
        },
      ]);
      return;
    }
    if (p && !injury && reason === 'Injured') {
      setChoosing(null);
      Alert.alert(`Add an injury for ${p.firstName}?`, `${p.firstName} then counts as injured from ${fmtDate(training!.date)} on, in every training and game, until marked recovered on the player page.`, [
        { text: 'No', style: 'cancel', onPress: () => apply(playerId, reason) },
        {
          text: 'Yes',
          onPress: async () => {
            const { error: failed } = await supabase.from('player_injuries').insert({ player_id: playerId, start_date: training!.date });
            if (failed) return setError(`Could not add the injury: ${failed.message}`);
            apply(playerId, reason);
            refresh();
          },
        },
      ]);
      return;
    }
    apply(playerId, reason);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError('');
    // Injured players are absent by their injury and are not stored per training.
    const byInjury = (playerId: string, reason: string) => training!.injured.includes(playerId) && reason === 'Injured';
    const back = Object.keys(training!.absences).filter((playerId) => !training!.injured.includes(playerId) && !(playerId in absent));
    const rows = Object.entries(absent)
      .filter(([playerId, reason]) => !byInjury(playerId, reason))
      .map(([playerId, reason]) => ({ training_id: training!.id, player_id: playerId, reason }));
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
            .update({ major_tactic_id: themes.major, minor_tactic_id: themes.minor, basic_ids: basicIds, basic_id: basicIds[0] ?? null, location: pitch })
            .eq('id', training!.id)
        : null;
    const failed = upserted?.error ?? removed?.error ?? themed?.error;
    if (failed) {
      setError(`Could not save the training: ${failed.message}`);
      setSaving(false);
      return;
    }
    await refresh();
    goBack();
  }

  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };
  const player = choosing ? players.find((p) => p.id === choosing) : null;
  const groups = [...POSITION_GROUPS.map((g) => g.label), 'Other']
    .map((label, i) => ({
      label,
      players: players.filter(
        (p) => groupOf(p.bestPosition) === i && (filter === 'all' || (filter === 'absent') === p.id in absent),
      ),
    }))
    .filter((g) => g.players.length);

  return (
    <View style={[styles.page, { backgroundColor: c.chalk }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable
          style={[styles.round, { backgroundColor: c.surface }]}
          onPress={() => (choosingPitch ? setChoosingPitch(false) : choosingTheme ? setChoosingTheme(null) : player ? setChoosing(null) : goBack())}
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
        {player || choosingTheme || choosingPitch ? (
          <View style={{ width: 36 }} />
        ) : (
          <Pressable
            style={[styles.round, { backgroundColor: c.surface }]}
            onPress={() => router.push({ pathname: '/training-edit', params: { id: training.id } })}
            accessibilityLabel="Edit training"
            hitSlop={8}
          >
            <EditIcon color={c.ink} />
          </Pressable>
        )}
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
                  if (choosingTheme === 'basic') setBasicIds([]);
                  else setThemes({ ...themes, [choosingTheme]: null });
                  setChoosingTheme(null);
                }}
              >
                <Text style={[styles.label, { color: c.ink }]}>None</Text>
                {chosen(choosingTheme).length === 0 ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
              </Pressable>
            </View>
            {choosingTheme === 'basic' ? (
              <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13, marginHorizontal: 4 }}>Tap every basic this training works on, then go back.</Text>
            ) : null}
            {groupByCategory(themeList(choosingTheme)).map(([category, items]) => (
              <View key={category} style={{ gap: 8 }}>
                <Text style={[styles.group, { color: c.inkSoft }]}>{category || 'Other'}</Text>
                <View style={[styles.card, { backgroundColor: c.surface }]}>
                  {items.map((item, i) => (
                    <Pressable
                      key={item.id}
                      style={[styles.row, i > 0 && line]}
                      onPress={() => {
                        // Basics: several can be on; a tap switches one on or off.
                        if (choosingTheme === 'basic') {
                          setBasicIds(basicIds.includes(item.id) ? basicIds.filter((x) => x !== item.id) : [...basicIds, item.id]);
                          return;
                        }
                        setThemes({ ...themes, [choosingTheme]: item.id });
                        setChoosingTheme(null);
                      }}
                    >
                      <Text style={[styles.label, { color: c.ink }]}>{item.name}</Text>
                      {chosen(choosingTheme).includes(item.id) ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
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
              {/* The players divided into groups for the session. */}
              <Pressable style={[styles.row, line]} onPress={() => router.push({ pathname: '/training-groups', params: { id: training.id } })}>
                <Text style={[styles.label, { color: c.ink }]}>Training groups</Text>
                <Text style={{ color: training.groups ? c.ink : c.inkSoft, fontFamily: fonts.regular, fontSize: 15 }}>
                  {training.groups ? `${training.groups.groupIds.length} ${training.groups.groupIds.length === 1 ? 'group' : 'groups'}` : 'No groups created'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
              </Pressable>
            </View>

            <Text style={[styles.section, { color: c.ink }]}>Training themes</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              {(['major', 'minor', 'basic'] as ThemeKey[]).map((key, i) => (
                <Pressable key={key} style={[styles.row, i > 0 && line]} onPress={() => setChoosingTheme(key)}>
                  <Text style={{ width: 56, color: c.ink, fontFamily: fonts.regular, fontSize: 16 }}>{THEME_LABELS[key]}</Text>
                  <Text
                    style={{ flex: 1, textAlign: 'right', color: chosen(key).length ? c.ink : c.inkSoft, fontFamily: fonts.regular, fontSize: 15 }}
                    numberOfLines={key === 'basic' ? 8 : 2}
                  >
                    {themeName(key)}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
                </Pressable>
              ))}
            </View>

            {videoEnabled ? (
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <Pressable style={styles.row} onPress={() => router.push({ pathname: '/video-analysis', params: { training: training.id } })}>
                <Ionicons name="videocam-outline" size={20} color={c.ink} />
                <Text style={[styles.label, { color: c.ink }]}>
                  Videos <Text style={{ color: c.inkSoft }}>({videos.filter((v) => v.trainingId === training.id).length})</Text>
                </Text>
                <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
              </Pressable>
            </View>
            ) : null}

            <Text style={[styles.section, { color: c.ink }]}>Attendance</Text>
            <View style={[styles.toggle, { backgroundColor: c.surface2 }]}>
              {FILTERS.map((f) => (
                <Pressable key={f.key} style={[styles.toggleOption, f.key === filter && { backgroundColor: c.surface }]} onPress={() => setFilter(f.key)}>
                  <Text style={{ color: f.key === filter ? c.ink : c.inkSoft, fontFamily: fonts.medium, fontSize: 14 }}>
                    {f.label} {f.key === 'all' ? players.length : f.key === 'absent' ? absentCount : players.length - absentCount}
                  </Text>
                </Pressable>
              ))}
            </View>
            {groups.length === 0 ? (
              <Text style={[styles.sub, { color: c.inkSoft, textAlign: 'center', paddingVertical: 12 }]}>
                {filter === 'absent' ? 'No one is absent.' : 'No one is attending.'}
              </Text>
            ) : null}
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
  toggle: { flexDirection: 'row', alignSelf: 'center', borderRadius: 10, padding: 3 },
  toggleOption: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
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
