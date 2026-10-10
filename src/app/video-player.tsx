import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useData } from '../lib/data';
import { goBack } from '../lib/nav';
import { fonts } from '../lib/theme';
import { storedVideoUrl } from '../lib/videos';

// Plays a video from the club's video storage inside the app, on a black
// page with the phone's own controls.
export default function VideoPlayerScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { videos } = useData();
  const video = videos.find((v) => v.id === id);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  const key = video?.storageKey;
  useEffect(() => {
    if (!key) return;
    storedVideoUrl(key)
      .then(setUrl)
      .catch((e) => setError((e as Error).message));
  }, [key]);

  // Turning the phone sideways shows the video in landscape; leaving the
  // player puts the app upright again.
  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  const player = useVideoPlayer(url, (p) => p.play());

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      {url ? (
        <VideoView style={StyleSheet.absoluteFill} player={player} contentFit="contain" fullscreenOptions={{ enable: true }} allowsPictureInPicture={false} />
      ) : (
        <View style={styles.center}>
          {error || !video ? (
            <Text style={styles.message}>{error ? `Could not open the video: ${error}` : 'This video no longer exists.'}</Text>
          ) : (
            <ActivityIndicator color="#fff" />
          )}
        </View>
      )}
      <View style={[styles.bar, { paddingTop: insets.top + 6, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }]} pointerEvents="box-none">
        <Pressable style={styles.round} onPress={goBack} accessibilityLabel="Close" hitSlop={8}>
          <Ionicons name="close" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {video?.title}
        </Text>
        <View style={{ width: 36 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  message: { color: '#fff', fontFamily: fonts.regular, fontSize: 15, textAlign: 'center' },
  bar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  title: { flex: 1, textAlign: 'center', color: '#fff', fontFamily: fonts.medium, fontSize: 16 },
});
