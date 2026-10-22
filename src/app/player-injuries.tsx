import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlayerCard, PlayerFrame, PlayerSection } from '../components/PlayerPage';
import { useLook } from '../lib/appTheme';
import { fmtDate, injuryOn, toIso, todayIso, useData, type Injury } from '../lib/data';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';

const day = (iso: string) => new Date(`${iso}T00:00:00`);

// A player's injuries: the current and coming ones, earlier ones, and adding or
// changing one. While injured he is absent in trainings and left out of selections.
export default function PlayerInjuriesScreen() {
  const c = useColors();
  const t = useLook();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { players, me, refresh } = useData();
  const player = players.find((p) => p.id === id);
  const [injury, setInjury] = useState<{ id?: string; start: Date; back: Date | null; text: string } | null>(null);
  const [picker, setPicker] = useState<'start' | 'back' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!player) {
    return (
      <PlayerFrame title="Injuries">
        <Text style={{ color: t.soft, fontFamily: fonts.regular, textAlign: 'center' }}>This player is not in the team on show.</Text>
      </PlayerFrame>
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
    <Pressable key={i.id} style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sport ? t.border : t.pill }]} onPress={() => openInjury(i)}>
      <View style={[styles.icon, { backgroundColor: active ? c.danger + '22' : t.pill }]}>
        <Ionicons name="medkit-outline" size={16} color={active ? c.danger : t.soft} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.ink, fontFamily: fonts.medium, fontSize: 15 }} numberOfLines={1}>
          {i.note || 'Injury'}
        </Text>
        <Text style={{ color: t.soft, fontFamily: fonts.regular, fontSize: 13 }}>{period(i)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={t.soft} />
    </Pressable>
  );

  return (
    <PlayerFrame
      title="Injuries"
      sub={`${player.firstName} ${player.lastName}${me?.activeAgeGroup ? ` · ${me.activeAgeGroup.name}` : ''}`}
      after={
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
                <View style={[styles.box, { backgroundColor: c.surface2 }]}>
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
                    : 'Without a return date the player stays injured until you mark the player recovered.'}
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
      }
    >
      {current || upcoming.length ? (
        <PlayerCard style={{ paddingHorizontal: 0 }}>{[...(current ? [current] : []), ...upcoming].map((i, n) => injuryRow(i, n, true))}</PlayerCard>
      ) : (
        <Text style={{ color: t.soft, fontFamily: fonts.regular, fontSize: 14, marginHorizontal: 4 }}>Not injured.</Text>
      )}
      <Pressable style={[styles.button, { backgroundColor: t.card }]} onPress={() => openInjury()}>
        <Ionicons name="add" size={20} color={t.accent} />
        <Text style={{ color: t.accent, fontFamily: fonts.medium, fontSize: 16 }}>Add injury</Text>
      </Pressable>
      {past.length ? (
        <>
          <PlayerSection>Earlier injuries</PlayerSection>
          <PlayerCard style={{ paddingHorizontal: 0 }}>{past.map((i, n) => injuryRow(i, n, false))}</PlayerCard>
        </>
      ) : null}
      {error && !injury ? <Text style={{ color: c.danger, fontFamily: fonts.regular, fontSize: 13 }}>{error}</Text> : null}
    </PlayerFrame>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.medium, fontSize: 17 },
  box: { borderRadius: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingHorizontal: 16 },
  label: { flex: 1, fontFamily: fonts.regular, fontSize: 16 },
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
  input: { height: 48, borderRadius: 12, paddingHorizontal: 14, fontFamily: fonts.regular, fontSize: 15 },
});
