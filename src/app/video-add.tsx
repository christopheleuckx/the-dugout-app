import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useData } from '../lib/data';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';
import { fileName, fmtDay, fmtSize, folderName, listStoredVideos, type StoredVideo } from '../lib/videos';

// Add a video to a game or training: a title, and either a file picked from
// the club's video storage or a pasted link. With "edit" it renames a video.
export default function VideoAddScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ game?: string; team?: string; training?: string; mode?: string; edit?: string }>();
  const { videos, refresh } = useData();
  const editing = videos.find((v) => v.id === params.edit);
  const linkMode = params.mode === 'link';

  const [title, setTitle] = useState(editing?.title ?? '');
  const [link, setLink] = useState('');
  const [files, setFiles] = useState<StoredVideo[] | null>(null);
  const [picked, setPicked] = useState<StoredVideo | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const listing = !editing && !linkMode;
  useEffect(() => {
    if (!listing) return;
    listStoredVideos()
      .then(setFiles)
      .catch((e) => {
        setFiles([]);
        setError(`Could not load your videos: ${(e as Error).message}`);
      });
  }, [listing]);

  // Files already on this game or training are not offered twice.
  const used = new Set(
    videos
      .filter((v) => (params.game ? v.gameId === params.game && v.team === params.team : v.trainingId === params.training))
      .map((v) => v.storageKey),
  );
  const offered = (files ?? []).filter((f) => !used.has(f.key));

  async function save() {
    if (saving) return;
    const name = title.trim();
    const url = link.trim();
    if (!name) return setError('Give the video a title.');
    if (listing && !picked) return setError('Choose a video.');
    if (linkMode && !editing && !/^https?:\/\/\S+\.\S+/i.test(url)) return setError('Paste the full link, starting with https://');
    setSaving(true);
    setError('');
    const saved = editing
      ? await supabase.from('videos').update({ title: name }).eq('id', editing.id)
      : await supabase.from('videos').insert({
          game_id: params.game ?? null,
          team: params.game ? (params.team ?? null) : null,
          training_id: params.training ?? null,
          title: name,
          storage_key: picked?.key ?? null,
          url: picked ? null : url,
          size_bytes: picked?.size ?? null,
        });
    if (saved.error) {
      setError(`Could not save the video: ${saved.error.message}`);
      setSaving(false);
      return;
    }
    await refresh();
    router.back();
  }

  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };

  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: c.chalk }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={() => router.back()} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]}>{editing ? 'Rename video' : 'Add video'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.caption, { color: c.inkSoft }]}>Title</Text>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <TextInput
            style={[styles.input, { color: c.ink }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Name this video"
            placeholderTextColor={c.inkSoft}
            autoFocus={!!editing || linkMode}
            returnKeyType="done"
          />
        </View>

        {linkMode && !editing ? (
          <>
            <Text style={[styles.caption, { color: c.inkSoft }]}>Link</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <TextInput
                style={[styles.input, { color: c.ink }]}
                value={link}
                onChangeText={setLink}
                placeholder="https://youtu.be/…"
                placeholderTextColor={c.inkSoft}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
              />
            </View>
            <Text style={[styles.note, { color: c.inkSoft }]}>Opens in YouTube or the browser.</Text>
          </>
        ) : null}

        {listing ? (
          <>
            <Text style={[styles.caption, { color: c.inkSoft }]}>Video</Text>
            {files === null ? (
              <ActivityIndicator color={c.pitch} style={{ marginTop: 16 }} />
            ) : offered.length === 0 ? (
              <Text style={[styles.note, { color: c.inkSoft }]}>
                {error ? '' : 'No videos to choose from. Upload one to your video storage first, then come back here.'}
              </Text>
            ) : (
              <View style={[styles.card, { backgroundColor: c.surface }]}>
                {offered.map((f, i) => (
                  <Pressable
                    key={f.key}
                    style={[styles.row, i > 0 && line]}
                    onPress={() => {
                      setPicked(f);
                      // The file name is a fair first title.
                      if (!title.trim()) setTitle(fileName(f.key).replace(/\.[a-z0-9]+$/i, ''));
                    }}
                  >
                    <View style={[styles.thumb, { backgroundColor: c.pitchStrong }]}>
                      <Ionicons name="film-outline" size={17} color={c.onPitch} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 15 }} numberOfLines={1}>
                        {fileName(f.key)}
                      </Text>
                      <Text style={[styles.sub, { color: c.inkSoft }]} numberOfLines={1}>
                        {[folderName(f.key), fmtDay(f.modified), fmtSize(f.size)].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    {picked?.key === f.key ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
                  </Pressable>
                ))}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 12, gap: 8 }}>
        {error ? <Text style={{ color: c.danger, fontFamily: fonts.regular, fontSize: 13 }}>{error}</Text> : null}
        <Pressable style={[styles.button, { backgroundColor: c.pitch }]} onPress={save}>
          {saving ? (
            <ActivityIndicator color={c.onPitch} />
          ) : (
            <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>{editing ? 'Save' : 'Add video'}</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 17 },
  sub: { fontFamily: fonts.regular, fontSize: 13 },
  content: { padding: 16, gap: 8, paddingBottom: 24 },
  caption: { fontFamily: fonts.regular, fontSize: 13, marginLeft: 12, marginTop: 8 },
  note: { fontFamily: fonts.regular, fontSize: 13, marginHorizontal: 12 },
  card: { borderRadius: 14, paddingHorizontal: 16 },
  input: { fontFamily: fonts.regular, fontSize: 16, minHeight: 50, paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingVertical: 10 },
  thumb: { width: 54, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  button: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
});
