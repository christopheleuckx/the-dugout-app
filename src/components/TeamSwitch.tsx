import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useData, type AgeGroup } from '../lib/data';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';
import { Crest } from './MatchCard';

// The sheet to switch team: the coach's age groups with their club logo.
// Choosing one makes the whole app show that age group, because the database
// only returns its players, games and trainings.
export function TeamSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { me, refresh } = useData();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function choose(group: AgeGroup) {
    if (busy || !me) return;
    if (group.id === me.activeAgeGroup?.id) return onClose();
    setBusy(group.id);
    setError('');
    const saved = await supabase.from('profiles').update({ active_age_group_id: group.id }).eq('id', me.id);
    if (saved.error) {
      setError(`Could not switch: ${saved.error.message}`);
      setBusy(null);
      return;
    }
    await refresh();
    setBusy(null);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 12 }]}>
        <View style={[styles.grabber, { backgroundColor: c.line }]} />
        <Text style={[styles.sheetTitle, { color: c.ink }]}>Switch team</Text>
        {error ? <Text style={{ color: c.danger, fontFamily: fonts.regular, fontSize: 13 }}>{error}</Text> : null}
        {(me?.ageGroups ?? []).map((group, i) => (
          <Pressable
            key={group.id}
            style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}
            onPress={() => choose(group)}
          >
            <View style={[styles.ring, { borderColor: c.line }]}>
              <Crest url={group.clubLogoUrl} name={group.clubName} size={38} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 16 }}>{group.name}</Text>
              <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>{[group.clubName, group.format].join(' · ')}</Text>
            </View>
            {busy === group.id ? (
              <ActivityIndicator size="small" color={c.pitch} />
            ) : me?.activeAgeGroup?.id === group.id ? (
              <Ionicons name="checkmark" size={20} color={c.pitch} />
            ) : null}
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

// In the title bar of every tab: the club logo with the age group under it,
// so it is always clear which team is on show. With more than one team,
// tapping it switches.
export function HeaderTeam() {
  const c = useColors();
  const { me } = useData();
  const [open, setOpen] = useState(false);
  const group = me?.activeAgeGroup;
  if (!group) return <View style={{ width: 40 }} />;
  const canSwitch = (me?.ageGroups.length ?? 0) > 1;

  return (
    <>
      <Pressable
        style={styles.header}
        onPress={() => canSwitch && setOpen(true)}
        disabled={!canSwitch}
        accessibilityLabel={`${group.name}, ${group.clubName}${canSwitch ? '. Switch team' : ''}`}
        hitSlop={8}
      >
        <View style={[styles.ring, { borderColor: c.line }]}>
          <Crest url={group.clubLogoUrl} name={group.clubName} size={34} />
        </View>
        <View style={[styles.pill, { backgroundColor: c.pitch, borderColor: c.chalk }]}>
          <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 10 }} numberOfLines={1}>
            {group.name}
          </Text>
        </View>
      </Pressable>
      <TeamSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  // As wide as the app logo on the left, so the title stays centred; a long
  // age group name may stick out on both sides.
  header: { width: 40, alignItems: 'center', overflow: 'visible' },
  ring: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999 },
  pill: { marginTop: -7, borderRadius: 999, borderWidth: 1.5, paddingHorizontal: 6, paddingVertical: 0.5, maxWidth: 66 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingVertical: 9 },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    shadowColor: '#0E1320',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 8 },
  sheetTitle: { fontFamily: fonts.medium, fontSize: 17, marginBottom: 4 },
});
