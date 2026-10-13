import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Crest } from '../components/MatchCard';
import { useData } from '../lib/data';
import { goBack } from '../lib/nav';
import { lookAlikes } from '../lib/opponents';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';

type Opponent = { id: string; name: string; logoPath: string | null; logoUrl: string | null };
// A photo chosen as the new logo, not stored yet.
type Picked = { uri: string; base64: string };

// The opponents, one list shared by every club: A to Z with their logo, a
// search box, and per opponent its name, its logo and merging it with a
// double.
export default function OpponentsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { competitors, refresh } = useData();
  const [search, setSearch] = useState('');
  // The opponent on show, or "new" for the form to add one.
  const [open, setOpen] = useState<Opponent | 'new' | null>(null);
  const [merging, setMerging] = useState(false);
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Other coaches add to this list too: fetch it fresh when the page opens.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const existing = open && open !== 'new' ? open : null;
  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };

  // A to Z, grouped under their first letter.
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byLetter = new Map<string, Opponent[]>();
    for (const o of competitors) {
      if (q && !o.name.toLowerCase().includes(q)) continue;
      const first = o.name.trim().charAt(0).toUpperCase();
      const letter = /[A-Z]/.test(first) ? first : '#';
      byLetter.set(letter, [...(byLetter.get(letter) ?? []), o]);
    }
    return [...byLetter.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [competitors, search]);

  const alikes = useMemo(() => (existing ? lookAlikes(existing, competitors) : []), [existing, competitors]);
  const others = useMemo(
    () => (existing ? competitors.filter((o) => o.id !== existing.id && !alikes.some((a) => a.id === o.id)) : []),
    [existing, competitors, alikes],
  );

  function show(opponent: Opponent | 'new') {
    setName(opponent === 'new' ? '' : opponent.name);
    setPicked(null);
    setError('');
    setMerging(false);
    setOpen(opponent);
  }

  function back() {
    if (merging) setMerging(false);
    else if (open) setOpen(null);
    else goBack();
  }

  async function pickLogo() {
    setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, base64: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.base64) throw new Error('the photo could not be read');
      setPicked({ uri: asset.uri, base64: asset.base64 });
    } catch (e) {
      setError(`Could not open your photos: ${(e as { message?: string })?.message ?? 'unknown error'}`);
    }
  }

  async function save() {
    if (saving || !open) return;
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean) return setError('Fill in the name.');
    const double = competitors.find((o) => o.id !== existing?.id && o.name.toLowerCase() === clean.toLowerCase());
    if (double) return setError(`${double.name} is already in the list.${existing ? ' Use Merge to make them one.' : ''}`);
    setSaving(true);
    setError('');
    try {
      let id = existing?.id ?? '';
      if (!existing) {
        const made = await supabase.from('competitors').insert({ name: clean }).select('id').single();
        if (made.error) throw made.error;
        id = made.data.id;
      } else if (clean !== existing.name) {
        const renamed = await supabase.from('competitors').update({ name: clean }).eq('id', id);
        if (renamed.error) throw renamed.error;
      }
      if (picked) {
        const bytes = Uint8Array.from(atob(picked.base64), (ch) => ch.charCodeAt(0)).buffer;
        const path = `${id}/${Date.now()}.jpg`;
        const uploaded = await supabase.storage.from('competitor-logos').upload(path, bytes, { contentType: 'image/jpeg' });
        if (uploaded.error) throw uploaded.error;
        const linked = await supabase.from('competitors').update({ logo_path: path }).eq('id', id);
        if (linked.error) throw linked.error;
        if (existing?.logoPath) await supabase.storage.from('competitor-logos').remove([existing.logoPath]);
      }
      await refresh();
      setOpen(null);
    } catch (e) {
      setError(`Could not save: ${(e as { message?: string })?.message ?? 'unknown error'}`);
    }
    setSaving(false);
  }

  // The opponent on show stays; the chosen one disappears into it, with all
  // its games, in every club.
  function askMerge(other: Opponent) {
    if (!existing) return;
    Alert.alert(
      `Merge into ${existing.name}?`,
      `${other.name} disappears from the list. All its games, in every club, become games against ${existing.name}. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Merge', style: 'destructive', onPress: () => merge(other) },
      ],
    );
  }

  async function merge(other: Opponent) {
    if (!existing || saving) return;
    setSaving(true);
    setError('');
    try {
      const done = await supabase.rpc('merge_competitors', { keep: existing.id, gone: other.id });
      if (done.error) throw done.error;
      if (done.data) await supabase.storage.from('competitor-logos').remove([done.data as string]);
      await refresh();
      setMerging(false);
      setOpen(null);
    } catch (e) {
      setError(`Could not merge: ${(e as { message?: string })?.message ?? 'unknown error'}`);
    }
    setSaving(false);
  }

  const opponentRow = (o: Opponent, first: boolean, onPress: () => void, hint?: string) => (
    <Pressable key={o.id} style={[styles.row, !first && line]} onPress={onPress}>
      <View style={[styles.ring, { borderColor: c.line }]}>
        <Crest url={o.logoUrl} name={o.name} size={38} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 15 }} numberOfLines={1}>
          {o.name}
        </Text>
        {hint ? <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>{hint}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
    </Pressable>
  );

  const title = merging ? 'Merge' : open === 'new' ? 'New opponent' : existing ? existing.name : 'Opponents';
  const shownLogo = picked?.uri ?? existing?.logoUrl ?? null;

  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: c.chalk }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={back} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>
          {title}
        </Text>
        {open ? (
          <View style={{ width: 36 }} />
        ) : (
          <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={() => show('new')} accessibilityLabel="New opponent" hitSlop={8}>
            <Ionicons name="add" size={22} color={c.ink} />
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {merging && existing ? (
          <>
            <Text style={[styles.note, { color: c.inkSoft }]}>
              Choose the opponent that is the same club as {existing.name}. It disappears, and its games become games against {existing.name}.
            </Text>
            {error ? <Text style={[styles.note, { color: c.danger }]}>{error}</Text> : null}
            {saving ? <ActivityIndicator color={c.pitch} style={{ marginTop: 12 }} /> : null}
            {alikes.length ? (
              <>
                <Text style={[styles.caption, { color: c.inkSoft }]}>Looks the same</Text>
                <View style={[styles.card, { backgroundColor: c.surface }]}>{alikes.map((o, i) => opponentRow(o, i === 0, () => askMerge(o)))}</View>
              </>
            ) : (
              <Text style={[styles.note, { color: c.inkSoft }]}>No opponent with a similar name was found. You can still choose one below.</Text>
            )}
            <Text style={[styles.caption, { color: c.inkSoft }]}>All other opponents</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>{others.map((o, i) => opponentRow(o, i === 0, () => askMerge(o)))}</View>
          </>
        ) : open ? (
          <>
            <Pressable style={styles.logo} onPress={pickLogo} accessibilityLabel="Change the logo">
              <View style={[styles.ring, { borderColor: c.line }]}>
                <Crest url={shownLogo} name={name || '?'} size={84} />
              </View>
              <Text style={{ color: c.pitch, fontFamily: fonts.regular, fontSize: 14 }}>{shownLogo ? 'Change logo' : 'Add logo'}</Text>
            </Pressable>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <View style={styles.row}>
                <Text style={[styles.label, { color: c.ink }]}>Name</Text>
                <TextInput
                  style={[styles.input, { color: c.ink }]}
                  value={name}
                  onChangeText={setName}
                  autoCorrect={false}
                  autoCapitalize="words"
                  placeholder="KAA Gent"
                  placeholderTextColor={c.inkSoft}
                />
              </View>
            </View>
            {existing ? (
              <Text style={[styles.note, { color: c.inkSoft }]}>The name and the logo change for every club, on all games against this opponent.</Text>
            ) : null}
            {error ? <Text style={[styles.note, { color: c.danger }]}>{error}</Text> : null}
            <Pressable style={[styles.button, { backgroundColor: c.pitch }]} onPress={save}>
              {saving ? <ActivityIndicator color={c.onPitch} /> : <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>{existing ? 'Save' : 'Add opponent'}</Text>}
            </Pressable>
            {existing ? (
              <>
                <Pressable style={[styles.button, { backgroundColor: c.surface }]} onPress={() => (setError(''), setMerging(true))}>
                  <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 16 }}>Merge with another opponent</Text>
                </Pressable>
                {alikes.length ? (
                  <Text style={[styles.note, { color: c.inkSoft, textAlign: 'center' }]}>
                    Looks the same as {alikes.map((o) => o.name).join(', ')}.
                  </Text>
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <>
            <View style={[styles.search, { backgroundColor: c.surface }]}>
              <Ionicons name="search" size={18} color={c.inkSoft} />
              <TextInput
                style={{ flex: 1, color: c.ink, fontFamily: fonts.regular, fontSize: 16, paddingVertical: 0 }}
                value={search}
                onChangeText={setSearch}
                placeholder={`Search ${competitors.length} opponents`}
                placeholderTextColor={c.inkSoft}
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
            </View>
            {groups.length === 0 ? <Text style={[styles.note, { color: c.inkSoft, marginTop: 12 }]}>No opponent found. Add it with the plus.</Text> : null}
            {groups.map(([letter, list]) => (
              <View key={letter} style={{ gap: 6 }}>
                <Text style={[styles.letter, { color: c.inkSoft }]}>{letter}</Text>
                <View style={[styles.card, { backgroundColor: c.surface }]}>{list.map((o, i) => opponentRow(o, i === 0, () => show(o)))}</View>
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
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 17 },
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, height: 44 },
  letter: { fontFamily: fonts.medium, fontSize: 13, marginLeft: 12, marginTop: 6 },
  caption: { fontFamily: fonts.regular, fontSize: 13, marginLeft: 12, marginTop: 8 },
  note: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, marginHorizontal: 12 },
  card: { borderRadius: 14, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingVertical: 9 },
  ring: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999 },
  logo: { alignItems: 'center', gap: 8, marginVertical: 8 },
  label: { flex: 1, fontFamily: fonts.regular, fontSize: 16 },
  input: { flex: 2, textAlign: 'right', fontFamily: fonts.regular, fontSize: 16, paddingVertical: 0 },
  button: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, marginTop: 6 },
});
