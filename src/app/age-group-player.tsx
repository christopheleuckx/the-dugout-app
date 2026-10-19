import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useData } from '../lib/data';
import { goBack } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';
import type { BasePlayer } from './age-group-players';

// The positions as the rest of the app knows them: keeper, then the numbers.
const POSITIONS = ['K', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
const FEET = ['Right', 'Left', 'Both'];
// The fields chosen from a list, each opening its own list of options.
type Choice = 'preferred_position_1' | 'best_position' | 'developing_position' | 'preferred_foot';
const CHOICES: { key: Choice; label: string; options: string[] }[] = [
  { key: 'preferred_position_1', label: 'Preferred position', options: POSITIONS },
  { key: 'best_position', label: 'Best position', options: POSITIONS },
  { key: 'developing_position', label: 'Developing position', options: POSITIONS },
  { key: 'preferred_foot', label: 'Preferred foot', options: FEET },
];
const positionName = (p: string) => (p === 'K' ? 'K (keeper)' : p);
const EMPTY = { first_name: '', last_name: '', preferred_position_1: '', best_position: '', developing_position: '', preferred_foot: '', strengths: '', primary_focus: '', remarks: '' };
type Form = typeof EMPTY;

// The basic information of one player of an age group: new, or one to change.
// Only first and last name are required.
export default function AgeGroupPlayerScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { group, name, id } = useLocalSearchParams<{ group: string; name: string; id?: string }>();
  const { refresh } = useData();
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [choosing, setChoosing] = useState<Choice | null>(null);
  // The photo: the stored one, and a new pick or a removal that waits for Save.
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [pending, setPending] = useState<{ uri: string; base64: string } | 'remove' | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase.rpc('age_group_players', { p_group: group }).then(({ data, error: failed }) => {
      const found = ((data ?? []) as BasePlayer[]).find((p) => p.id === id);
      if (failed || !found) setError(failed ? `Could not load the player: ${failed.message}` : 'This player no longer exists.');
      else {
        setForm(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, (found as Record<string, string>)[k] ?? ''])) as Form);
        const path = (found as BasePlayer & { photo_path: string | null }).photo_path;
        setPhotoPath(path);
        // The photos are private: a link that works for an hour.
        if (path) supabase.storage.from('player-photos').createSignedUrl(path, 3600).then(({ data: signed }) => setPhotoUrl(signed?.signedUrl ?? null));
      }
      setLoading(false);
    });
  }, [group, id]);

  const set = (key: keyof Form, value: string) => setForm({ ...form, [key]: value });

  async function pickPhoto() {
    setError('');
    try {
      // Square, so the face fits the round photo everywhere in the app.
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true });
      if (result.canceled || !result.assets[0].base64) return;
      setPending({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
    } catch (e) {
      setError(`Could not open your photos: ${(e as { message?: string })?.message ?? 'unknown error'}`);
    }
  }
  const shown = pending === 'remove' ? null : pending ? pending.uri : photoUrl;
  function photoMenu() {
    if (!shown) return pickPhoto();
    Alert.alert('Photo', undefined, [
      { text: 'Choose another photo', onPress: pickPhoto },
      { text: 'Remove photo', style: 'destructive', onPress: () => setPending(photoPath ? 'remove' : null) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }
  const initials = `${form.first_name.trim()[0] ?? ''}${form.last_name.trim()[0] ?? ''}`.toUpperCase();
  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };

  async function save() {
    if (saving) return;
    if (!form.first_name.trim() || !form.last_name.trim()) return setError('First and last name are required.');
    setSaving(true);
    setError('');
    const { data: savedId, error: failed } = await supabase.rpc('save_age_group_player', { p_group: group, p_id: id ?? null, p: form });
    if (failed) {
      setSaving(false);
      return setError(`Could not save the player: ${failed.message}`);
    }
    if (pending) {
      try {
        let path = '';
        if (pending !== 'remove') {
          const bytes = Uint8Array.from(atob(pending.base64), (ch) => ch.charCodeAt(0)).buffer;
          path = `${savedId}-${new Date().getTime()}.jpg`;
          const uploaded = await supabase.storage.from('player-photos').upload(path, bytes, { contentType: 'image/jpeg' });
          if (uploaded.error) throw uploaded.error;
        }
        const { data: old, error: photoFailed } = await supabase.rpc('set_age_group_player_photo', { p_group: group, p_id: savedId, p_path: path });
        if (photoFailed) throw photoFailed;
        if (old && old !== path) await supabase.storage.from('player-photos').remove([old as string]);
      } catch (e) {
        setSaving(false);
        // The player itself is saved; only the photo failed.
        return setError(`The player is saved, but the photo could not be: ${(e as { message?: string })?.message ?? 'unknown error'}`);
      }
    }
    setSaving(false);
    // The squad, selections and trainings of the team on show may use this player.
    refresh();
    goBack();
  }

  function remove() {
    Alert.alert(
      'Remove this player?',
      `${form.first_name} ${form.last_name} is removed from ${name}, together with their selections, ratings and training attendance. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const { error: failed } = await supabase.rpc('delete_age_group_player', { p_group: group, p_id: id });
            if (failed) return setError(`Could not remove the player: ${failed.message}`);
            if (photoPath) await supabase.storage.from('player-photos').remove([photoPath]);
            refresh();
            goBack();
          },
        },
      ],
    );
  }

  const text = (label: string, key: keyof Form, placeholder: string, first = false) => (
    <View style={[styles.field, !first && line]}>
      <Text style={[styles.label, { color: c.ink }]}>{label}</Text>
      <TextInput
        value={form[key]}
        onChangeText={(v) => set(key, v)}
        placeholder={placeholder}
        placeholderTextColor={c.inkSoft}
        autoCapitalize="words"
        style={[styles.input, { color: c.ink }]}
      />
    </View>
  );
  const long = (label: string, key: keyof Form, placeholder: string) => (
    <View style={{ gap: 8 }}>
      <Text style={[styles.caption, { color: c.inkSoft }]}>{label}</Text>
      <TextInput
        value={form[key]}
        onChangeText={(v) => set(key, v)}
        placeholder={placeholder}
        placeholderTextColor={c.inkSoft}
        multiline
        style={[styles.card, styles.area, { backgroundColor: c.surface, color: c.ink }]}
      />
    </View>
  );
  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: c.chalk }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={() => (choosing ? setChoosing(null) : goBack())} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>
            {choosing ? CHOICES.find((x) => x.key === choosing)!.label : id ? `${form.first_name} ${form.last_name}`.trim() || 'Player' : 'New player'}
          </Text>
          <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>{name}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={c.pitch} style={{ marginTop: 24 }} />
      ) : choosing ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            {['', ...CHOICES.find((x) => x.key === choosing)!.options].map((o, i) => (
              <Pressable
                key={o || 'none'}
                style={[styles.field, i > 0 && line]}
                onPress={() => {
                  set(choosing, o);
                  setChoosing(null);
                }}
              >
                <Text style={[styles.label, { flex: 1, width: undefined, color: o ? c.ink : c.inkSoft }]}>
                  {o ? (choosing === 'preferred_foot' ? o : positionName(o)) : 'None'}
                </Text>
                {form[choosing] === o ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* The photo in a circle, or the initials; tap to add or change it. */}
          <Pressable style={styles.photoWrap} onPress={photoMenu} accessibilityLabel={shown ? 'Change photo' : 'Add photo'}>
            <View>
              <View style={[styles.photo, { backgroundColor: shown ? c.surface2 : c.pitch }]}>
                {shown ? (
                  <Image source={{ uri: shown }} style={styles.photoImage} />
                ) : initials ? (
                  <Text style={{ color: c.onPitch, fontFamily: fonts.semi, fontSize: 32 }}>{initials}</Text>
                ) : (
                  <Ionicons name="person" size={40} color={c.onPitch} />
                )}
              </View>
              <View style={[styles.camera, { backgroundColor: c.surface, borderColor: c.chalk }]}>
                <Ionicons name="camera-outline" size={16} color={c.ink} />
              </View>
            </View>
            <Text style={{ color: c.pitch, fontFamily: fonts.medium, fontSize: 14 }}>{shown ? 'Change photo' : 'Add photo'}</Text>
          </Pressable>
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            {text('First name', 'first_name', 'Required', true)}
            {text('Last name', 'last_name', 'Required')}
          </View>
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            {CHOICES.map((choice, i) => (
              <Pressable key={choice.key} style={[styles.field, i > 0 && line]} onPress={() => setChoosing(choice.key)}>
                <Text style={[styles.label, { flex: 1, width: undefined, color: c.ink }]}>{choice.label}</Text>
                <Text style={{ color: form[choice.key] ? c.ink : c.inkSoft, fontFamily: fonts.regular, fontSize: 16 }}>
                  {form[choice.key] ? (choice.key === 'preferred_foot' ? form[choice.key] : positionName(form[choice.key])) : 'Choose'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
              </Pressable>
            ))}
          </View>
          {long('Strengths', 'strengths', 'What the player is good at')}
          {long('Primary focus for improvement', 'primary_focus', 'What to work on first')}
          {long('Remarks', 'remarks', 'Anything else')}
          {error ? <Text style={{ color: c.danger, fontFamily: fonts.regular, fontSize: 13 }}>{error}</Text> : null}
          <Pressable style={[styles.button, { backgroundColor: c.pitch }, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={c.onPitch} /> : <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>{id ? 'Save' : 'Add player'}</Text>}
          </Pressable>
          {id ? (
            <Pressable style={[styles.button, { backgroundColor: c.surface }]} onPress={remove}>
              <Text style={{ color: c.danger, fontFamily: fonts.medium, fontSize: 16 }}>Remove player</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.medium, fontSize: 17 },
  content: { padding: 16, gap: 14, paddingBottom: 60 },
  card: { borderRadius: 14 },
  photoWrap: { alignItems: 'center', gap: 8, marginBottom: 4 },
  photo: { width: 104, height: 104, borderRadius: 52, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  // Zoomed in on the face, like the small photos elsewhere in the app.
  photoImage: { position: 'absolute', width: 140, height: 140, left: -18, top: -5 },
  camera: { position: 'absolute', right: 0, bottom: 2, width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  field: { flexDirection: 'row', alignItems: 'center', minHeight: 54, paddingHorizontal: 16, gap: 12 },
  label: { width: 96, fontFamily: fonts.regular, fontSize: 16 },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, textAlign: 'right', paddingVertical: 12 },
  caption: { fontFamily: fonts.medium, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, marginHorizontal: 4 },
  area: { minHeight: 84, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, fontFamily: fonts.regular, fontSize: 15, textAlignVertical: 'top' },
  button: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
