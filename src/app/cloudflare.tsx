import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useData } from '../lib/data';
import { goBack } from '../lib/nav';
import { fonts, useColors } from '../lib/theme';
import {
  deleteStoredVideo,
  fileName,
  fmtDay,
  fmtSize,
  folderName,
  listStorage,
  STORAGE_WARNING,
  storageFill,
  storageUsage,
  type StorageUsage,
  type StoredVideo,
} from '../lib/videos';

// Cloudflare R2's free plan and its price beyond it, per month. These are
// Cloudflare's published figures, kept here to estimate the cost.
const FREE_GB = 10;
const DOLLARS_PER_EXTRA_GB = 0.015;
// Requests: writing and listing (class A) and reading (class B).
const FREE_WRITES = 1_000_000;
const FREE_READS = 10_000_000;
const DOLLARS_PER_MILLION_WRITES = 4.5;
const DOLLARS_PER_MILLION_READS = 0.36;
const DASHBOARD = 'https://dash.cloudflare.com/?to=/:account/r2/overview';

// For the admin: what is in the club's video storage at Cloudflare, how much
// of the free plan it uses, and how often the videos are watched. Tapping a
// folder shows its videos, which can be deleted from the storage there.
export default function CloudflareScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { videos, refresh } = useData();
  const [bucket, setBucket] = useState('');
  const [files, setFiles] = useState<StoredVideo[] | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  // How the videos in a folder are ordered: the largest and oldest first help to clean up.
  const [order, setOrder] = useState<'newest' | 'largest' | 'oldest'>('newest');
  // Cloudflare's own figures for this month, or why they could not be read.
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [usageError, setUsageError] = useState('');

  useEffect(() => {
    listStorage()
      .then((storage) => {
        setBucket(storage.bucket);
        setFiles(storage.videos);
      })
      .catch((e) => {
        setFiles([]);
        setError(`Could not load the storage: ${(e as Error).message}`);
      });
    storageUsage()
      .then(setUsage)
      .catch((e) => setUsageError((e as Error).message));
  }, []);

  // Deleting from the storage cannot be undone, so it asks first.
  function confirmDelete(file: StoredVideo, name: string, uses: number) {
    Alert.alert(
      'Delete this video?',
      `"${name}" is removed from Cloudflare for good${uses ? `, and from the ${uses === 1 ? 'game or training' : `${uses} games or trainings`} it is on` : ''}. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(file.key);
            setError('');
            try {
              await deleteStoredVideo(file.key);
              setFiles((list) => (list ?? []).filter((f) => f.key !== file.key));
              storageFill(true);
              await refresh();
            } catch (e) {
              setError(`Could not delete the video: ${(e as Error).message}`);
            }
            setDeleting(null);
          },
        },
      ],
    );
  }

  const all = files ?? [];
  const bytes = all.reduce((sum, f) => sum + f.size, 0);
  const gb = bytes / 1e9;
  const cost =
    Math.max(0, gb - FREE_GB) * DOLLARS_PER_EXTRA_GB +
    (Math.max(0, (usage?.classA ?? 0) - FREE_WRITES) / 1e6) * DOLLARS_PER_MILLION_WRITES +
    (Math.max(0, (usage?.classB ?? 0) - FREE_READS) / 1e6) * DOLLARS_PER_MILLION_READS;
  const month = new Date().toLocaleDateString('en-GB', { month: 'long' });
  const number = (n: number) => n.toLocaleString('en-GB');
  // A request allowance: how many were used of the free number, with a bar.
  const allowance = (label: string, used: number, free: number, first = false) => (
    <View style={[{ paddingVertical: 12, gap: 6 }, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
        <Text style={[styles.name, { color: c.ink, fontFamily: fonts.regular }]}>{label}</Text>
        <Text style={[styles.sub, { color: c.inkSoft }]}>
          <Text style={{ color: c.ink, fontFamily: fonts.medium }}>{number(used)}</Text> of {number(free)} free
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: c.surface2, height: 6 }]}>
        <View style={[styles.fill, { height: 6, backgroundColor: used > free ? c.danger : c.pitch, width: `${Math.min(100, Math.max(1, (used / free) * 100))}%` }]} />
      </View>
    </View>
  );
  const views = videos.reduce((sum, v) => sum + (v.storageKey ? v.views : 0), 0);
  // Per file: the videos in the app that use it, for its title and views.
  const attached = (key: string) => videos.filter((v) => v.storageKey === key);

  const folders = [...new Set(all.map((f) => folderName(f.key)))].sort().map((name) => {
    const inside = all.filter((f) => folderName(f.key) === name);
    return { name, count: inside.length, bytes: inside.reduce((sum, f) => sum + f.size, 0) };
  });
  const inFolder = (folder === null ? [] : all.filter((f) => folderName(f.key) === folder)).sort((a, b) =>
    order === 'largest' ? b.size - a.size : order === 'oldest' ? a.modified.localeCompare(b.modified) : b.modified.localeCompare(a.modified),
  );
  const share = gb / FREE_GB;

  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };
  const tile = (label: string, value: string, note?: string) => (
    <View style={[styles.tile, { backgroundColor: c.surface }]}>
      <Text style={[styles.tileLabel, { color: c.inkSoft }]}>{label}</Text>
      <Text style={[styles.tileValue, { color: c.ink }]}>{value}</Text>
      {note ? <Text style={[styles.tileLabel, { color: c.inkSoft, fontSize: 12.5 }]}>{note}</Text> : null}
    </View>
  );

  return (
    <View style={[styles.page, { backgroundColor: c.chalk }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable
          style={[styles.round, { backgroundColor: c.surface }]}
          onPress={() => (folder !== null ? setFolder(null) : goBack())}
          accessibilityLabel="Back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.title, { color: c.ink }]}>Cloudflare</Text>
          <Text style={[styles.sub, { color: c.inkSoft }]} numberOfLines={1}>
            {bucket ? `${bucket}/${folder ? `${folder}/` : ''}` : ' '}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error ? <Text style={{ color: c.danger, fontFamily: fonts.regular, fontSize: 13 }}>{error}</Text> : null}
        {files === null ? (
          <ActivityIndicator color={c.pitch} style={{ marginTop: 24 }} />
        ) : folder !== null ? (
          <>
          <View style={[styles.toggle, { backgroundColor: c.surface2 }]}>
            {(['newest', 'largest', 'oldest'] as const).map((key) => (
              <Pressable key={key} style={[styles.toggleOption, key === order && { backgroundColor: c.surface }]} onPress={() => setOrder(key)}>
                <Text style={{ color: key === order ? c.ink : c.inkSoft, fontFamily: fonts.medium, fontSize: 14, textTransform: 'capitalize' }}>{key}</Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            {inFolder.map((f, i) => {
              const used = attached(f.key);
              const seen = used.reduce((sum, v) => sum + v.views, 0);
              return (
                <Pressable
                  key={f.key}
                  style={[styles.row, i > 0 && line]}
                  disabled={!used.length}
                  onPress={() => router.push({ pathname: '/video-player', params: { id: used[0].id } })}
                >
                  <View style={[styles.thumb, { backgroundColor: used.length ? c.pitchStrong : c.surface2 }]}>
                    <Ionicons name={used.length ? 'play' : 'film-outline'} size={17} color={used.length ? c.onPitch : c.ink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>
                      {used[0]?.title ?? fileName(f.key)}
                    </Text>
                    <Text style={[styles.sub, { color: c.inkSoft }]} numberOfLines={1}>
                      {[fmtDay(f.modified), fmtSize(f.size), used.length ? `${seen} ${seen === 1 ? 'view' : 'views'}` : 'Not on a game or training'].join(' · ')}
                    </Text>
                  </View>
                  {deleting === f.key ? (
                    <ActivityIndicator size="small" color={c.danger} />
                  ) : (
                    <Pressable onPress={() => confirmDelete(f, used[0]?.title ?? fileName(f.key), used.length)} hitSlop={10} accessibilityLabel="Delete video">
                      <Ionicons name="trash-outline" size={20} color={c.danger} />
                    </Pressable>
                  )}
                </Pressable>
              );
            })}
          </View>
          </>
        ) : (
          <>
            {share >= STORAGE_WARNING ? (
              <View style={[styles.warning, { backgroundColor: (share >= 1 ? c.danger : c.amber) + '22' }]}>
                <Ionicons name="warning-outline" size={20} color={share >= 1 ? c.danger : c.amber} />
                <Text style={[styles.note, { flex: 1, marginHorizontal: 0, color: c.ink }]}>
                  {share >= 1
                    ? 'The free storage is full. New videos cannot be uploaded until you delete some.'
                    : `The free storage is ${Math.round(share * 100)}% full. Delete videos you no longer need: open a folder and order by largest or oldest.`}
                </Text>
              </View>
            ) : null}
            <View style={[styles.card, { backgroundColor: c.surface, paddingVertical: 16, gap: 8 }]}>
              <Text style={[styles.tileLabel, { color: c.inkSoft }]}>Storage used</Text>
              <Text style={[styles.tileValue, { color: c.ink }]}>
                {gb < 0.1 ? fmtSize(bytes) || '0 MB' : `${gb.toFixed(1)} GB`}
                <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 15 }}> of {FREE_GB} GB free</Text>
              </Text>
              <View style={[styles.track, { backgroundColor: c.surface2 }]}>
                <View style={[styles.fill, { backgroundColor: share >= 1 ? c.danger : share >= STORAGE_WARNING ? c.amber : c.pitch, width: `${Math.min(100, Math.max(1, (gb / FREE_GB) * 100))}%` }]} />
              </View>
            </View>
            <View style={styles.tiles}>
              {tile('Videos', String(all.length))}
              {tile('Views', String(views), 'in the app')}
              {tile('Cost', `$${cost.toFixed(2)}`, cost ? 'this month, estimate' : 'within the free plan')}
            </View>
            <Text style={[styles.note, { color: c.inkSoft }]}>
              Sending video data out is free at Cloudflare. You pay for storage above {FREE_GB} GB, about ${DOLLARS_PER_EXTRA_GB.toFixed(3)} per extra GB a month, and for requests above the free numbers below.
            </Text>

            <Text style={[styles.section, { color: c.ink }]}>{month} at Cloudflare</Text>
            {usage ? (
              <>
                <View style={styles.tiles}>
                  {tile('Uploads', number(usage.uploads))}
                  {tile('Downloads', number(usage.downloads))}
                  {tile('Data sent', fmtSize(usage.bytesOut) || '0 MB')}
                </View>
                <View style={[styles.card, { backgroundColor: c.surface }]}>
                  {allowance('Write requests', usage.classA, FREE_WRITES, true)}
                  {allowance('Read requests', usage.classB, FREE_READS)}
                </View>
                <Text style={[styles.note, { color: c.inkSoft }]}>
                  Counted by Cloudflare since 1 {month}; its figures can run a little behind. One play of a video is several downloads, because it is fetched in pieces.
                </Text>
              </>
            ) : (
              <Text style={[styles.note, { color: usageError ? c.danger : c.inkSoft }]}>{usageError || 'Loading Cloudflare\'s figures…'}</Text>
            )}

            <Text style={[styles.section, { color: c.ink }]}>Folders</Text>
            {folders.length ? (
              <View style={[styles.card, { backgroundColor: c.surface }]}>
                {folders.map((f, i) => (
                  <Pressable key={f.name} style={[styles.row, i > 0 && line]} onPress={() => setFolder(f.name)}>
                    <Ionicons name="folder-outline" size={22} color={c.ink} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.name, { color: c.ink }]}>{f.name || 'No folder'}</Text>
                      <Text style={[styles.sub, { color: c.inkSoft }]}>
                        {f.count} {f.count === 1 ? 'video' : 'videos'} · {fmtSize(f.bytes) || '0 MB'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={[styles.note, { color: c.inkSoft }]}>No videos uploaded yet.</Text>
            )}

            <View style={[styles.card, { backgroundColor: c.surface, marginTop: 8 }]}>
              <Pressable style={styles.row} onPress={() => Linking.openURL(DASHBOARD)}>
                <Ionicons name="open-outline" size={20} color={c.ink} />
                <Text style={[styles.name, { color: c.ink, flex: 1, fontFamily: fonts.regular, fontSize: 16 }]}>Open Cloudflare</Text>
                <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
              </Pressable>
            </View>
            <Text style={[styles.note, { color: c.inkSoft }]}>For your invoices and Cloudflare's own activity figures.</Text>
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
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  card: { borderRadius: 14, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingVertical: 10 },
  name: { fontFamily: fonts.medium, fontSize: 15 },
  thumb: { width: 54, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, borderRadius: 14, padding: 14, gap: 2 },
  tileLabel: { fontFamily: fonts.regular, fontSize: 13 },
  tileValue: { fontFamily: fonts.semi, fontSize: 24 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  note: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, marginHorizontal: 4 },
  warning: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 14 },
  toggle: { flexDirection: 'row', alignSelf: 'center', borderRadius: 10, padding: 3 },
  toggleOption: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14 },
  section: { fontFamily: fonts.medium, fontSize: 19, marginTop: 12 },
});
