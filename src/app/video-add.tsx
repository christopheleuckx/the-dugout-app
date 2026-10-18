import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useData } from '../lib/data';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';
import { SourceTag, sourceOf, type VideoSource } from '../components/SourceTag';
import {
  fileName,
  fmtDay,
  fmtSize,
  folderName,
  GAMES_FOLDER,
  listStoredVideos,
  StorageRefusal,
  TRAININGS_FOLDER,
  uploadVideo,
  type StoredVideo,
} from '../lib/videos';
import { goBack } from '../lib/nav';

// Add a video to a game or training: a title, and either a file picked from
// the club's video storage, a video uploaded from this phone, or a pasted
// link. With "edit" it renames a video.
export default function VideoAddScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ game?: string; team?: string; training?: string; mode?: string; edit?: string; source?: string }>();
  const { videos, refresh } = useData();
  const editing = videos.find((v) => v.id === params.edit);
  const linkMode = params.mode === 'link';
  // Which site the link is for, chosen in the sheet: Veo or YouTube.
  const source: VideoSource = params.source === 'veo' ? 'veo' : 'youtube';
  const uploadMode = params.mode === 'upload';

  const [title, setTitle] = useState(editing?.title ?? '');
  const [link, setLink] = useState('');
  const [files, setFiles] = useState<StoredVideo[] | null>(null);
  const [picked, setPicked] = useState<StoredVideo | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // The video chosen on this phone, and how far its upload is (0 to 1).
  const [chosen, setChosen] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const listing = !editing && !linkMode && !uploadMode;
  useEffect(() => {
    if (!listing) return;
    listStoredVideos()
      .then(setFiles)
      .catch((e) => {
        setFiles([]);
        setError(e instanceof StorageRefusal && e.limit ? e.message : `Could not load your videos: ${(e as Error).message}`);
      });
  }, [listing]);

  // Files already on this game or training are not offered twice.
  const used = new Set(
    videos
      .filter((v) => (params.game ? v.gameId === params.game && v.team === params.team : v.trainingId === params.training))
      .map((v) => v.storageKey),
  );
  const offered = (files ?? []).filter((f) => !used.has(f.key));

  async function choose() {
    setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'] });
      if (!result.canceled) setChosen(result.assets[0]);
    } catch (e) {
      setError(`Could not open your videos: ${(e as { message?: string })?.message ?? 'unknown error'}`);
    }
  }

  async function save() {
    if (saving) return;
    const name = title.trim();
    const url = link.trim();
    if (!name) return setError('Give the video a title.');
    if (listing && !picked) return setError('Choose a video.');
    if (uploadMode && !editing && !chosen) return setError('Choose a video.');
    if (linkMode && !editing && !/^https?:\/\/\S+\.\S+/i.test(url)) return setError('Paste the full link, starting with https://');
    if (linkMode && !editing && sourceOf(url) !== source) return setError(source === 'veo' ? 'This is not a Veo link. Paste the link from Veo (veo.co).' : 'This is not a YouTube link. Paste the link from YouTube.');
    setSaving(true);
    setError('');
    // An upload goes to the storage first; only then is the video attached.
    let uploaded: { key: string; size: number | null } | null = null;
    if (uploadMode && !editing && chosen) {
      try {
        setProgress(0);
        const type = (chosen.fileName ?? chosen.uri).match(/\.([a-z0-9]{2,4})$/i)?.[1]?.toLowerCase() ?? 'mov';
        const key = await uploadVideo(
          { uri: chosen.uri, name: `${name}.${type}`, mimeType: chosen.mimeType, size: chosen.fileSize },
          params.game ? GAMES_FOLDER : TRAININGS_FOLDER,
          setProgress,
        );
        uploaded = { key, size: chosen.fileSize ?? null };
      } catch (e) {
        // When the free plan is the reason, the server's explanation says it all.
        setError(e instanceof StorageRefusal && e.limit ? e.message : `Could not upload the video: ${(e as Error).message}`);
        setProgress(null);
        setSaving(false);
        return;
      }
    }
    const saved = editing
      ? await supabase.from('videos').update({ title: name }).eq('id', editing.id)
      : await supabase.from('videos').insert({
          game_id: params.game ?? null,
          team: params.game ? (params.team ?? null) : null,
          training_id: params.training ?? null,
          title: name,
          storage_key: uploaded?.key ?? picked?.key ?? null,
          url: uploaded || picked ? null : url,
          size_bytes: uploaded?.size ?? picked?.size ?? null,
        });
    if (saved.error) {
      setError(`Could not save the video: ${saved.error.message}`);
      setProgress(null);
      setSaving(false);
      return;
    }
    await refresh();
    goBack();
  }

  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };

  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: c.chalk }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={() => goBack()} accessibilityLabel="Back" hitSlop={8}>
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
            autoFocus={!!editing || linkMode || uploadMode}
            returnKeyType="done"
          />
        </View>

        {linkMode && !editing ? (
          <>
            <View style={styles.sourceHead}>
              <SourceTag source={source} size="large" />
            </View>
            <Text style={[styles.caption, { color: c.inkSoft }]}>Link</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <TextInput
                style={[styles.input, { color: c.ink }]}
                value={link}
                onChangeText={setLink}
                placeholder={source === 'veo' ? 'https://app.veo.co/matches/…' : 'https://youtu.be/…'}
                placeholderTextColor={c.inkSoft}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
              />
            </View>
            <Text style={[styles.note, { color: c.inkSoft }]}>
              {source === 'veo' ? 'Opens in the Veo app or the browser; Veo asks you to sign in if needed.' : 'Opens in YouTube or the browser.'}
            </Text>
          </>
        ) : null}

        {uploadMode && !editing ? (
          <>
            <Text style={[styles.caption, { color: c.inkSoft }]}>Video</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <Pressable style={styles.row} onPress={choose} disabled={saving}>
                <View style={[styles.thumb, { backgroundColor: chosen ? c.pitchStrong : c.surface2 }]}>
                  <Ionicons name={chosen ? 'film-outline' : 'add'} size={chosen ? 17 : 22} color={chosen ? c.onPitch : c.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 15 }} numberOfLines={1}>
                    {chosen ? (chosen.fileName ?? 'Video from this phone') : 'Choose a video'}
                  </Text>
                  <Text style={[styles.sub, { color: c.inkSoft }]} numberOfLines={1}>
                    {chosen
                      ? [chosen.duration ? fmtDuration(chosen.duration) : '', fmtSize(chosen.fileSize ?? null)].filter(Boolean).join(' · ')
                      : 'From your photo library'}
                  </Text>
                </View>
                {chosen && !saving ? <Text style={{ color: c.pitch, fontFamily: fonts.medium, fontSize: 15 }}>Change</Text> : null}
              </Pressable>
            </View>
            {progress !== null ? (
              <View style={{ gap: 6, marginHorizontal: 12, marginTop: 6 }}>
                <View style={[styles.track, { backgroundColor: c.surface2 }]}>
                  <View style={[styles.fill, { backgroundColor: c.pitch, width: `${Math.round(progress * 100)}%` }]} />
                </View>
                <Text style={[styles.sub, { color: c.inkSoft }]}>
                  {progress < 1 ? `Uploading ${Math.round(progress * 100)}%. Keep this screen open.` : 'Finishing…'}
                </Text>
              </View>
            ) : (
              <Text style={[styles.note, { color: c.inkSoft }]}>
                Stored in the club's video storage, in the folder {params.game ? GAMES_FOLDER : TRAININGS_FOLDER}. Use Wi-Fi for long videos.
              </Text>
            )}
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
            <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>{editing ? 'Save' : uploadMode ? 'Upload video' : 'Add video'}</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// "1:42" from a length in milliseconds.
function fmtDuration(ms: number) {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  sourceHead: { alignItems: 'flex-start', marginLeft: 12, marginTop: 8 },
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
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  button: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
});
