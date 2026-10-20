import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EditIcon } from '../components/Icons';
import { fmtDate, injuryOn, toIso, todayIso, useData, type Injury } from '../lib/data';
import { goBack } from '../lib/nav';
import { attendanceOf, playerStats } from '../lib/playerStats';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';

type Note = 'strengths' | 'primaryFocus' | 'remarks';
const NOTES: { key: Note; label: string; empty: string }[] = [
  { key: 'strengths', label: 'Strengths', empty: 'What the player is good at' },
  { key: 'primaryFocus', label: 'Focus for development', empty: 'What to work on first' },
  { key: 'remarks', label: 'Remarks', empty: 'Anything else' },
];
const day = (iso: string) => new Date(`${iso}T00:00:00`);
const positionName = (p: string) => (p ? (p === 'K' ? 'K (keeper)' : p) : '–');

// A player as the coaches of the team see them from the Squad: the basic
// information (name and positions are kept in Club management), the notes
// every coach can write, and the injuries.
export default function SquadPlayerScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { players, games, goals, trainings, me, refresh } = useData();
  const player = players.find((p) => p.id === id);
  // His numbers, counted the same way as in Player statistics.
  const stat = useMemo(() => {
    if (!player) return null;
    const { stats, gameCount } = playerStats([player], games, goals, trainings);
    return { ...stats[0], gameCount };
  }, [player, games, goals, trainings]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState('');
  // The note being written, and the injury being added (no id) or changed.
  const [note, setNote] = useState<{ key: Note; text: string } | null>(null);
  const [injury, setInjury] = useState<{ id?: string; start: Date; back: Date | null; text: string } | null>(null);
  const [picker, setPicker] = useState<'start' | 'back' | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!player?.photoPath) return;
    supabase.storage
      .from('player-photos')
      .createSignedUrl(player.photoPath, 3600)
      .then(({ data }) => setPhoto(data?.signedUrl ?? null));
  }, [player?.photoPath]);

  if (!player) {
    return (
      <View style={[styles.page, { backgroundColor: c.chalk, paddingTop: insets.top + 60, alignItems: 'center' }]}>
        <Text style={{ color: c.inkSoft, fontFamily: fonts.regular }}>This player is not in the team on show.</Text>
      </View>
    );
  }

  const today = todayIso();
  const current = injuryOn(player, today);
  // Injuries still to start count as current too, so they can be changed.
  const upcoming = player.injuries.filter((i) => i.startDate > today && !i.endedOn);
  const past = player.injuries.filter((i) => i !== current && !upcoming.includes(i));
  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };

  const period = (i: Injury) => {
    const end = i.endedOn ? `back ${fmtDate(i.endedOn)}` : i.expectedReturn ? `expected back ${fmtDate(i.expectedReturn)}` : 'until recovered';
    return `${i.startDate > today ? 'From' : 'Since'} ${fmtDate(i.startDate)} · ${end}`;
  };

  async function saveNote() {
    if (!note || !player) return;
    setSaving(true);
    setError('');
    const next = { strengths: player.strengths, primaryFocus: player.primaryFocus, remarks: player.remarks, [note.key]: note.text.trim() };
    const { error: failed } = await supabase.rpc('update_player_notes', {
      p_id: player.id,
      p_strengths: next.strengths,
      p_primary_focus: next.primaryFocus,
      p_remarks: next.remarks,
    });
    setSaving(false);
    if (failed) return setError(`Could not save: ${failed.message}`);
    setNote(null);
    refresh();
  }

  function openInjury(i?: Injury) {
    setError('');
    setPicker(null);
    setInjury(
      i
        ? { id: i.id, start: day(i.startDate), back: i.expectedReturn ? day(i.expectedReturn) : null, text: i.note }
        : { start: new Date(), back: null, text: '' },
    );
  }

  async function saveInjury(extra: { ended_on?: string } = {}) {
    if (!injury || !player) return;
    const start = toIso(injury.start);
    const back = injury.back ? toIso(injury.back) : null;
    if (back && back <= start) return setError('The expected return is after the start of the injury.');
    setSaving(true);
    setError('');
    const row = { player_id: player.id, start_date: start, expected_return: back, note: injury.text.trim(), ...extra };
    const { error: failed } = injury.id
      ? await supabase.from('player_injuries').update(row).eq('id', injury.id)
      : await supabase.from('player_injuries').insert(row);
    setSaving(false);
    if (failed) return setError(`Could not save the injury: ${failed.message}`);
    setInjury(null);
    refresh();
  }

  function recovered() {
    if (!injury?.id) return;
    // Recovered today: available again from today on. An injury that only
    // started today ends on its start day.
    const start = toIso(injury.start);
    saveInjury({ ended_on: today < start ? start : today });
  }

  function removeInjury() {
    if (!injury?.id) return;
    Alert.alert('Delete this injury?', 'It is removed from the player, as if it was never entered.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error: failed } = await supabase.from('player_injuries').delete().eq('id', injury.id!);
          if (failed) return setError(`Could not delete the injury: ${failed.message}`);
          setInjury(null);
          refresh();
        },
      },
    ]);
  }

  const injuryRow = (i: Injury, index: number, active: boolean) => (
    <Pressable key={i.id} style={[styles.row, index > 0 && line]} onPress={() => openInjury(i)}>
      <View style={[styles.icon, { backgroundColor: active ? c.danger + '22' : c.surface2 }]}>
        <Ionicons name="medkit-outline" size={16} color={active ? c.danger : c.inkSoft} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 15 }} numberOfLines={1}>
          {i.note || 'Injury'}
        </Text>
        <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>{period(i)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
    </Pressable>
  );

  return (
    <View style={[styles.page, { backgroundColor: c.chalk }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={goBack} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>
            {player.firstName} {player.lastName}
          </Text>
          {me?.activeAgeGroup ? <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>{me.activeAgeGroup.name}</Text> : null}
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <View style={[styles.photo, { backgroundColor: photo ? c.surface2 : c.pitch }]}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photoImage} />
            ) : (
              <Text style={{ color: c.onPitch, fontFamily: fonts.semi, fontSize: 30 }}>
                {`${player.firstName.trim()[0] ?? ''}${player.lastName.trim()[0] ?? ''}`.toUpperCase()}
              </Text>
            )}
          </View>
          {current ? (
            <View style={[styles.pill, { backgroundColor: c.danger }]}>
              <Ionicons name="medkit" size={12} color="#fff" />
              <Text style={{ color: '#fff', fontFamily: fonts.medium, fontSize: 13 }}>Injured</Text>
            </View>
          ) : null}
        </View>

        {/* Games played, training attendance and goals, as in Player statistics. */}
        {stat ? (
          <View style={styles.tiles}>
            {(
              [
                [String(stat.games), 'Games played', `of ${stat.gameCount}`],
                [`${attendanceOf(stat)}%`, 'Trainings', `${stat.attended} of ${stat.trainings}`],
                [String(stat.goals), 'Goals', stat.games ? `${(stat.goals / stat.games).toFixed(2)} per game` : '–'],
              ] as [string, string, string][]
            ).map(([value, label, sub]) => (
              <View key={label} style={[styles.tile, { backgroundColor: c.surface }]}>
                <Text style={[styles.tileValue, { color: c.ink }]}>{value}</Text>
                <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 12.5 }} numberOfLines={1}>
                  {label}
                </Text>
                <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 11.5 }} numberOfLines={1}>
                  {sub}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: c.surface }]}>
          {(
            [
              ['Preferred position', positionName(player.preferredPosition)],
              ['Best position', positionName(player.bestPosition)],
              ['Developing position', positionName(player.developingPosition)],
              ['Preferred foot', player.preferredFoot || '–'],
            ] as [string, string][]
          ).map(([label, value], i) => (
            <View key={label} style={[styles.row, i > 0 && line]}>
              <Text style={[styles.label, { color: c.ink }]}>{label}</Text>
              <Text style={{ color: c.ink, fontFamily: fonts.regular, fontSize: 16 }}>{value}</Text>
            </View>
          ))}
        </View>

        {NOTES.map((n) => (
          <View key={n.key} style={[styles.card, styles.note, { backgroundColor: c.surface }]}>
            <View style={styles.noteHead}>
              <Text style={[styles.label, { color: c.ink, fontFamily: fonts.medium }]}>{n.label}</Text>
              <Pressable
                style={[styles.edit, { backgroundColor: c.surface2 }]}
                onPress={() => (setError(''), setNote({ key: n.key, text: player[n.key] }))}
                accessibilityLabel={`Edit ${n.label.toLowerCase()}`}
                hitSlop={6}
              >
                <EditIcon size={16} color={c.ink} />
              </Pressable>
            </View>
            <Text style={{ color: player[n.key] ? c.ink : c.inkSoft, fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 }}>
              {player[n.key] || n.empty}
            </Text>
          </View>
        ))}

        <Text style={[styles.section, { color: c.ink }]}>Injuries</Text>
        {current || upcoming.length ? (
          <View style={[styles.card, { backgroundColor: c.surface }]}>{[...(current ? [current] : []), ...upcoming].map((i, n) => injuryRow(i, n, true))}</View>
        ) : (
          <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 14, marginHorizontal: 4 }}>Not injured.</Text>
        )}
        <Pressable style={[styles.button, { backgroundColor: c.surface }]} onPress={() => openInjury()}>
          <Ionicons name="add" size={20} color={c.pitch} />
          <Text style={{ color: c.pitch, fontFamily: fonts.medium, fontSize: 16 }}>Add injury</Text>
        </Pressable>
        {past.length ? (
          <>
            <Text style={[styles.caption, { color: c.inkSoft }]}>Earlier injuries</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>{past.map((i, n) => injuryRow(i, n, false))}</View>
          </>
        ) : null}
        {error && !note && !injury ? <Text style={{ color: c.danger, fontFamily: fonts.regular, fontSize: 13 }}>{error}</Text> : null}
      </ScrollView>

      {/* Writing one of the notes. */}
      <Modal visible={!!note} transparent animationType="slide" onRequestClose={() => setNote(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={{ flex: 1 }} onPress={() => setNote(null)} accessibilityLabel="Close" />
          <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.grabber, { backgroundColor: c.line }]} />
            <Text style={[styles.title, { color: c.ink }]}>{NOTES.find((n) => n.key === note?.key)?.label}</Text>
            <TextInput
              value={note?.text ?? ''}
              onChangeText={(text) => note && setNote({ ...note, text })}
              placeholder={NOTES.find((n) => n.key === note?.key)?.empty}
              placeholderTextColor={c.inkSoft}
              multiline
              autoFocus
              style={[styles.area, { backgroundColor: c.surface2, color: c.ink }]}
            />
            {error ? <Text style={{ color: c.danger, fontFamily: fonts.regular, fontSize: 13 }}>{error}</Text> : null}
            <Pressable style={[styles.button, { backgroundColor: c.pitch }, saving && { opacity: 0.6 }]} onPress={saveNote} disabled={saving}>
              {saving ? <ActivityIndicator color={c.onPitch} /> : <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>Save</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Adding or changing an injury. */}
      <Modal visible={!!injury} transparent animationType="slide" onRequestClose={() => setInjury(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={{ flex: 1 }} onPress={() => setInjury(null)} accessibilityLabel="Close" />
          {injury ? (
            <ScrollView style={{ flexGrow: 0, maxHeight: '88%' }} contentContainerStyle={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 16 }]}>
              <View style={[styles.grabber, { backgroundColor: c.line }]} />
              <Text style={[styles.title, { color: c.ink }]}>{injury.id ? 'Injury' : 'Add injury'}</Text>
              <TextInput
                value={injury.text}
                onChangeText={(text) => setInjury({ ...injury, text })}
                placeholder="What is injured, for example ankle"
                placeholderTextColor={c.inkSoft}
                style={[styles.input, { backgroundColor: c.surface2, color: c.ink }]}
              />
              <View style={[styles.card, { backgroundColor: c.surface2 }]}>
                <Pressable style={styles.row} onPress={() => setPicker(picker === 'start' ? null : 'start')}>
                  <Text style={[styles.label, { color: c.ink }]}>Start</Text>
                  <Text style={{ color: c.pitch, fontFamily: fonts.regular, fontSize: 16 }}>{fmtDate(toIso(injury.start))}</Text>
                </Pressable>
                {picker === 'start' ? (
                  <DateTimePicker mode="date" display="inline" value={injury.start} accentColor={c.pitch} onChange={(_, d) => d && setInjury({ ...injury, start: d })} />
                ) : null}
                <View style={[styles.row, line]}>
                  <Text style={[styles.label, { color: c.ink }]}>Expected return</Text>
                  <Switch
                    value={!!injury.back}
                    onValueChange={(on) => {
                      const next = new Date(injury.start);
                      next.setDate(next.getDate() + 7);
                      setInjury({ ...injury, back: on ? next : null });
                      setPicker(on ? 'back' : null);
                    }}
                    trackColor={{ true: c.pitch }}
                  />
                </View>
                {injury.back ? (
                  <Pressable style={[styles.row, line]} onPress={() => setPicker(picker === 'back' ? null : 'back')}>
                    <Text style={[styles.label, { color: c.inkSoft }]}>Back on</Text>
                    <Text style={{ color: c.pitch, fontFamily: fonts.regular, fontSize: 16 }}>{fmtDate(toIso(injury.back))}</Text>
                  </Pressable>
                ) : null}
                {picker === 'back' && injury.back ? (
                  <DateTimePicker mode="date" display="inline" value={injury.back} minimumDate={injury.start} accentColor={c.pitch} onChange={(_, d) => d && setInjury({ ...injury, back: d })} />
                ) : null}
              </View>
              <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>
                {injury.back
                  ? `Absent in trainings and unavailable for games until ${fmtDate(toIso(injury.back))}.`
                  : 'Without a return date the player stays injured until you mark him recovered.'}
              </Text>
              {error ? <Text style={{ color: c.danger, fontFamily: fonts.regular, fontSize: 13 }}>{error}</Text> : null}
              <Pressable style={[styles.button, { backgroundColor: c.pitch }, saving && { opacity: 0.6 }]} onPress={() => saveInjury()} disabled={saving}>
                {saving ? <ActivityIndicator color={c.onPitch} /> : <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>Save</Text>}
              </Pressable>
              {injury.id && player.injuries.find((i) => i.id === injury.id && !i.endedOn) ? (
                <Pressable style={[styles.button, { backgroundColor: c.surface2 }]} onPress={recovered} disabled={saving}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={c.win} />
                  <Text style={{ color: c.win, fontFamily: fonts.medium, fontSize: 16 }}>Recovered</Text>
                </Pressable>
              ) : null}
              {injury.id ? (
                <Pressable style={styles.clear} onPress={removeInjury}>
                  <Text style={{ color: c.danger, fontFamily: fonts.medium, fontSize: 15 }}>Delete injury</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          ) : null}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.medium, fontSize: 17 },
  content: { padding: 16, gap: 12, paddingBottom: 60 },
  photo: { width: 96, height: 96, borderRadius: 48, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  // Zoomed in on the face, like the small photos in the Squad.
  photoImage: { position: 'absolute', width: 130, height: 130, left: -17, top: -5 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  card: { borderRadius: 14 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 1 },
  tileValue: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingHorizontal: 16 },
  label: { flex: 1, fontFamily: fonts.regular, fontSize: 16 },
  note: { padding: 16, gap: 8 },
  noteHead: { flexDirection: 'row', alignItems: 'center' },
  edit: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  section: { fontFamily: fonts.medium, fontSize: 19, marginTop: 8 },
  caption: { fontFamily: fonts.medium, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, marginHorizontal: 4, marginTop: 4 },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  button: { height: 50, borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  clear: { height: 44, alignItems: 'center', justifyContent: 'center' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
    shadowColor: '#0E1320',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 4 },
  area: { minHeight: 120, borderRadius: 12, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, fontFamily: fonts.regular, fontSize: 15, textAlignVertical: 'top' },
  input: { height: 48, borderRadius: 12, paddingHorizontal: 14, fontFamily: fonts.regular, fontSize: 15 },
});
