import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UndoToast } from '../components/UndoToast';
import { fmtDate, useData, type Video } from '../lib/data';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';
import { SourceTag, sourceOf, type VideoSource } from '../components/SourceTag';
import { fmtDay, fmtSize, saveVideoToPhone, siteOf } from '../lib/videos';
import { goBack } from '../lib/nav';

// The videos of one game (for the open team) or one training.
export default function VideoAnalysisScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ game?: string; team?: string; training?: string }>();
  const { games, trainings, videos, me, refresh } = useData();
  const game = games.find((g) => g.id === params.game);
  const training = trainings.find((t) => t.id === params.training);

  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState<Video | null>(null);
  const [removed, setRemoved] = useState<Video | null>(null);
  const [error, setError] = useState('');
  // The video being saved to this phone, how far it is (0 to 1), and the last one saved.
  const [saving, setSaving] = useState<{ id: string; progress: number } | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const list = videos.filter((v) => (game ? v.gameId === game.id && v.team === params.team : v.trainingId === training?.id));
  const sub = game ? `${game.opponent || 'TBD'} · ${fmtDate(game.date)}` : training ? `${training.label} · ${fmtDate(training.date)}` : '';
  const owner = game ? { game: game.id, team: params.team ?? '' } : { training: training?.id ?? '' };

  // A stored file plays inside the app; a pasted link opens where it lives.
  async function play(video: Video) {
    setError('');
    if (video.storageKey) {
      router.push({ pathname: '/video-player', params: { id: video.id } });
      return;
    }
    try {
      await Linking.openURL(video.url ?? '');
    } catch {
      setError('Could not open this link.');
    }
  }

  async function saveToPhone(video: Video) {
    setMenu(null);
    if (saving || !video.storageKey) return;
    setError('');
    setSavedId(null);
    setSaving({ id: video.id, progress: 0 });
    try {
      await saveVideoToPhone({ id: video.id, storageKey: video.storageKey }, (progress) => setSaving({ id: video.id, progress }));
      setSavedId(video.id);
    } catch (e) {
      setError(`Could not save the video: ${(e as Error).message}`);
    }
    setSaving(null);
  }

  // Removing only takes the video off this page, at once; the file stays in
  // the storage. Undo puts the same row back.
  async function remove(video: Video) {
    setMenu(null);
    setError('');
    const gone = await supabase.from('videos').delete().eq('id', video.id);
    if (gone.error) {
      setError(`Could not remove the video: ${gone.error.message}`);
      return;
    }
    setRemoved(video);
    await refresh();
  }

  async function undo() {
    const v = removed;
    setRemoved(null);
    if (!v) return;
    const back = await supabase.from('videos').insert({
      id: v.id,
      game_id: v.gameId,
      team: v.team,
      training_id: v.trainingId,
      title: v.title,
      storage_key: v.storageKey,
      url: v.url,
      size_bytes: v.sizeBytes,
      created_at: v.createdAt,
    });
    if (back.error) setError(`Could not put the video back: ${back.error.message}`);
    await refresh();
  }

  function add(mode: 'upload' | 'file' | 'link', source?: VideoSource) {
    setAdding(false);
    router.push({ pathname: '/video-add', params: { ...owner, mode, ...(source ? { source } : {}) } });
  }

  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };
  const sheet = [styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 12 }];

  return (
    <View style={[styles.page, { backgroundColor: c.chalk }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={() => goBack()} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.title, { color: c.ink }]}>Video analysis</Text>
          <Text style={[styles.sub, { color: c.inkSoft }]} numberOfLines={1}>
            {sub}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {list.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: c.surface }]}>
            <Ionicons name="videocam-outline" size={26} color={c.ink} />
          </View>
          <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 17 }}>Add your first video</Text>
          <Text style={[styles.sub, { color: c.inkSoft, textAlign: 'center', fontSize: 14 }]}>
            {game ? 'Goals, build-up or the full match, for every coach to watch.' : 'Drills or game forms, for every coach to watch.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            {list.map((v, i) => (
              <Pressable key={v.id} style={[styles.row, i > 0 && line]} onPress={() => play(v)}>
                <View style={[styles.thumb, { backgroundColor: v.storageKey ? c.pitchStrong : c.surface2 }]}>
                  <Ionicons name={v.storageKey ? 'play' : 'link-outline'} size={17} color={v.storageKey ? c.onPitch : c.ink} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  {!v.storageKey && sourceOf(v.url) ? <SourceTag source={sourceOf(v.url)!} /> : null}
                  <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 15 }} numberOfLines={1}>
                    {v.title}
                  </Text>
                  <Text style={[styles.sub, { color: c.inkSoft }]} numberOfLines={1}>
                    {saving?.id === v.id
                      ? `Saving to your phone ${Math.round(saving.progress * 100)}%`
                      : savedId === v.id
                        ? 'Saved to your photos'
                        : [v.storageKey ? fmtSize(v.sizeBytes) : siteOf(v.url ?? ''), `added ${fmtDay(v.createdAt)}`].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Pressable onPress={() => setMenu(v)} hitSlop={10} accessibilityLabel={`More for ${v.title}`}>
                  <Ionicons name="ellipsis-horizontal" size={20} color={c.inkSoft} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 12, gap: 8 }}>
        {error ? <Text style={{ color: c.danger, fontFamily: fonts.regular, fontSize: 13 }}>{error}</Text> : null}
        <Pressable style={[styles.button, { backgroundColor: c.pitch }]} onPress={() => setAdding(true)}>
          <Ionicons name="add" size={20} color={c.onPitch} />
          <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>Add video</Text>
        </Pressable>
      </View>

      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setAdding(false)} accessibilityLabel="Close" />
        <View style={sheet}>
          <View style={[styles.grabber, { backgroundColor: c.line }]} />
          <Text style={[styles.sheetTitle, { color: c.ink }]}>Add video</Text>
          <Pressable style={styles.sheetRow} onPress={() => add('upload')}>
            <Ionicons name="cloud-upload-outline" size={20} color={c.ink} />
            <Text style={[styles.sheetLabel, { color: c.ink }]}>Upload from this phone</Text>
          </Pressable>
          <Pressable style={[styles.sheetRow, line]} onPress={() => add('file')}>
            <Ionicons name="film-outline" size={20} color={c.ink} />
            <Text style={[styles.sheetLabel, { color: c.ink }]}>Choose from your videos</Text>
          </Pressable>
          <Pressable style={[styles.sheetRow, line]} onPress={() => add('link', 'veo')}>
            <Ionicons name="link-outline" size={20} color={c.ink} />
            <Text style={[styles.sheetLabel, { color: c.ink }]}>Paste a Veo link</Text>
            <SourceTag source="veo" size="large" />
          </Pressable>
          <Pressable style={[styles.sheetRow, line]} onPress={() => add('link', 'youtube')}>
            <Ionicons name="link-outline" size={20} color={c.ink} />
            <Text style={[styles.sheetLabel, { color: c.ink }]}>Paste a YouTube link</Text>
            <SourceTag source="youtube" size="large" />
          </Pressable>
        </View>
      </Modal>

      <Modal visible={!!menu} transparent animationType="slide" onRequestClose={() => setMenu(null)}>
        <Pressable style={{ flex: 1 }} onPress={() => setMenu(null)} accessibilityLabel="Close" />
        <View style={sheet}>
          <View style={[styles.grabber, { backgroundColor: c.line }]} />
          <Text style={[styles.sheetTitle, { color: c.ink }]} numberOfLines={1}>
            {menu?.title}
          </Text>
          <Pressable
            style={styles.sheetRow}
            onPress={() => {
              const id = menu!.id;
              setMenu(null);
              router.push({ pathname: '/video-add', params: { ...owner, edit: id } });
            }}
          >
            <Ionicons name="pencil-outline" size={20} color={c.ink} />
            <Text style={[styles.sheetLabel, { color: c.ink }]}>Rename</Text>
          </Pressable>
          {me?.canSaveVideos && menu?.storageKey ? (
            <Pressable style={[styles.sheetRow, line]} onPress={() => saveToPhone(menu!)}>
              <Ionicons name="download-outline" size={20} color={c.ink} />
              <Text style={[styles.sheetLabel, { color: c.ink }]}>Save to my phone</Text>
            </Pressable>
          ) : null}
          <Pressable style={[styles.sheetRow, line]} onPress={() => remove(menu!)}>
            <Ionicons name="trash-outline" size={20} color={c.danger} />
            <Text style={[styles.sheetLabel, { color: c.danger }]}>Remove from this {game ? 'game' : 'training'}</Text>
          </Pressable>
        </View>
      </Modal>

      {removed ? <UndoToast message="Video removed" onUndo={undo} onDismiss={() => setRemoved(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.medium, fontSize: 17 },
  sub: { fontFamily: fonts.regular, fontSize: 13 },
  content: { padding: 16, gap: 14, paddingBottom: 24 },
  card: { borderRadius: 14, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingVertical: 10 },
  thumb: { width: 54, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 40 },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  button: { flexDirection: 'row', gap: 6, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
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
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingVertical: 9 },
  sheetLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 16 },
});
