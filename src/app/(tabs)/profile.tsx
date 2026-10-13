import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '../../components/Avatar';
import { SwitchIcon } from '../../components/Icons';
import { Crest } from '../../components/MatchCard';
import { TeamSheet } from '../../components/TeamSwitch';
import { Screen } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useData } from '../../lib/data';
import { appVersion } from '../../lib/releaseNotes';
import { supabase } from '../../lib/supabase';
import { fonts, useColors } from '../../lib/theme';
import { STORAGE_WARNING, storageFill } from '../../lib/videos';

export default function Profile() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { me, refresh } = useData();
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // For the admin: how full the free video storage is, to warn in time.
  const [fill, setFill] = useState<number | null>(null);
  const isAdmin = !!me?.isAdmin;
  useEffect(() => {
    if (isAdmin) storageFill().then(setFill);
  }, [isAdmin]);
  const nearlyFull = fill !== null && fill >= STORAGE_WARNING;

  // Stores the new picture (or none, for initials) and removes the old file.
  async function setPicture(path: string | null) {
    const old = me!.avatarPath;
    const saved = await supabase.from('profiles').update({ avatar_path: path }).eq('id', me!.id);
    if (saved.error) throw saved.error;
    if (old && old !== path) await supabase.storage.from('avatars').remove([old]);
    await refresh();
  }

  // iOS can't open the photo library while the sheet is still sliding away:
  // the picker silently never appears. So choosing only closes the sheet, and
  // the picker opens once the sheet is gone (onDismiss, with a timer as backup).
  const pickPending = useRef(false);
  function choosePicture() {
    pickPending.current = true;
    setChoosing(false);
    setTimeout(openPicker, 700);
  }
  function openPicker() {
    if (!pickPending.current) return;
    pickPending.current = false;
    pick();
  }

  async function pick() {
    setError('');
    let result;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });
    } catch (e) {
      setError(`Could not open your photos: ${(e as { message?: string })?.message ?? 'unknown error'}`);
      return;
    }
    if (result.canceled || !me) return;
    setBusy(true);
    try {
      const base64 = result.assets[0].base64;
      if (!base64) throw new Error('the photo could not be read');
      const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0)).buffer;
      // Each user may only write inside their own folder.
      const path = `${me.id}/${Date.now()}.jpg`;
      const uploaded = await supabase.storage.from('avatars').upload(path, bytes, { contentType: 'image/jpeg' });
      if (uploaded.error) throw uploaded.error;
      await setPicture(path);
    } catch (e) {
      setError(`Could not save the picture: ${(e as { message?: string })?.message ?? 'unknown error'}`);
    }
    setBusy(false);
  }

  async function useInitials() {
    setChoosing(false);
    if (!me?.avatarPath) return;
    setBusy(true);
    setError('');
    try {
      await setPicture(null);
    } catch (e) {
      setError(`Could not remove the picture: ${(e as { message?: string })?.message ?? 'unknown error'}`);
    }
    setBusy(false);
  }

  // Switching team happens in the shared sheet.
  const canSwitch = (me?.ageGroups.length ?? 0) > 1;
  const [switching, setSwitching] = useState(false);

  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };

  return (
    <Screen title="Profile" team={false}>
      <View style={[styles.card, styles.person, { backgroundColor: c.surface }]}>
        <Pressable onPress={() => setChoosing(true)} accessibilityLabel="Change profile picture" hitSlop={6}>
          <Avatar profile={me} size={60} />
          <View style={[styles.edit, { backgroundColor: c.surface }]}>
            {busy ? <ActivityIndicator size="small" color={c.pitch} /> : <Ionicons name="camera-outline" size={14} color={c.ink} />}
          </View>
        </Pressable>
        {/* The name opens the account settings. */}
        <Pressable style={{ flex: 1 }} onPress={() => router.push('/account')} accessibilityLabel="Account settings">
          <Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>
            {me ? `${me.firstName} ${me.lastName}`.trim() || me.username : 'Unknown user'}
          </Text>
          <Text style={[styles.sub, { color: c.inkSoft }]} numberOfLines={1}>
            {me?.activeAgeGroup ? `Coach · ${me.activeAgeGroup.clubName}` : 'Coach'}
          </Text>
        </Pressable>
        {/* The club of the team on show; with more than one team it carries
            the same two-arrow badge as the jersey on a game, and switches. */}
        {me?.activeAgeGroup ? (
          <Pressable style={{ alignItems: 'center' }} onPress={() => canSwitch && setSwitching(true)} disabled={!canSwitch} accessibilityLabel="Switch team" hitSlop={6}>
            <View>
              <View style={[styles.ring, { borderColor: c.line }]}>
                <Crest url={me.activeAgeGroup.clubLogoUrl} name={me.activeAgeGroup.clubName} size={52} />
              </View>
              {canSwitch ? (
                <View style={[styles.switch, { backgroundColor: c.surface, borderColor: c.chalk }]}>
                  <SwitchIcon color={c.ink} />
                </View>
              ) : null}
            </View>
            {/* The logo says the club; the pill under it says the age group. */}
            <View style={[styles.pill, { backgroundColor: c.pitch, borderColor: c.surface }]}>
              <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 11 }} numberOfLines={1}>
                {me.activeAgeGroup.name}
              </Text>
            </View>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={[styles.sub, { color: c.danger, marginHorizontal: 12 }]}>{error}</Text> : null}

      <View style={[styles.card, { backgroundColor: c.surface }]}>
        {me?.isAdmin ? (
          <Pressable style={styles.row} onPress={() => router.push('/menu?section=tools')}>
            <Ionicons name="construct-outline" size={22} color={c.inkSoft} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: c.ink, flex: 0 }]}>Tools & costs</Text>
              <Text style={{ color: nearlyFull ? c.amber : c.inkSoft, fontFamily: nearlyFull ? fonts.medium : fonts.regular, fontSize: 13 }}>
                {nearlyFull ? `Video storage ${Math.min(100, Math.round(fill! * 100))}% full` : 'Cloudflare and Supabase'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
          </Pressable>
        ) : null}
        <Pressable style={[styles.row, me?.isAdmin && line]} onPress={() => router.push('/menu?section=manage')}>
          <Ionicons name="settings-outline" size={22} color={c.inkSoft} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: c.ink, flex: 0 }]}>Configure and manage</Text>
            <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>{me?.isAdmin ? 'Clubs, coaches and opponents' : 'Opponents'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: c.surface }]}>
        <Pressable style={styles.row} onPress={() => router.push('/about')}>
          <Ionicons name="information-circle-outline" size={22} color={c.inkSoft} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: c.ink, flex: 0 }]}>About this version</Text>
            <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>The Dugout {appVersion()}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: c.surface }]}>
        <Pressable style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]} onPress={signOut}>
          <Ionicons name="log-out-outline" size={22} color={c.inkSoft} />
          <Text style={[styles.label, { color: c.ink }]}>Sign out</Text>
        </Pressable>
      </View>

      <TeamSheet visible={switching} onClose={() => setSwitching(false)} />

      <Modal visible={choosing} transparent animationType="slide" onRequestClose={() => setChoosing(false)} onDismiss={openPicker}>
        <Pressable style={{ flex: 1 }} onPress={() => setChoosing(false)} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 12 }]}>
          <View style={[styles.grabber, { backgroundColor: c.line }]} />
          <Text style={[styles.sheetTitle, { color: c.ink }]}>Profile picture</Text>
          <Pressable style={styles.row} onPress={choosePicture}>
            <Ionicons name="image-outline" size={20} color={c.ink} />
            <Text style={[styles.label, { color: c.ink }]}>Choose from library</Text>
          </Pressable>
          <Pressable style={[styles.row, line]} onPress={useInitials}>
            <Ionicons name="person-circle-outline" size={20} color={c.ink} />
            <Text style={[styles.label, { color: c.ink }]}>Use initials</Text>
            {!me?.avatarPath ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
          </Pressable>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999 },
  pill: { marginTop: -7, borderRadius: 999, borderWidth: 2, paddingHorizontal: 8, paddingVertical: 1, maxWidth: 84 },
  switch: { position: 'absolute', right: -6, top: -4, width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 14, paddingHorizontal: 16 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  edit: { position: 'absolute', right: -4, bottom: -4, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.medium, fontSize: 18 },
  sub: { fontFamily: fonts.regular, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingVertical: 9 },
  label: { flex: 1, fontFamily: fonts.regular, fontSize: 16 },
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
