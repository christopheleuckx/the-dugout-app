import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';

import { fonts } from '../lib/theme';

const VEO_LOGO = require('../../assets/veo.png');
const VEO_GREEN = '#0B3D18';
const YOUTUBE_RED = '#FF0000';

export type VideoSource = 'veo' | 'youtube';

// Where a pasted link points, from its address; null for any other site.
export function sourceOf(url: string | null | undefined): VideoSource | null {
  const u = (url ?? '').toLowerCase();
  if (/(^|\/\/|\.)veo\.co\b/.test(u)) return 'veo';
  if (/(^|\/\/|\.)(youtube\.com|youtu\.be)\b/.test(u)) return 'youtube';
  return null;
}

// A small tag with the site's logo, so a Veo or YouTube link is recognised at a glance.
export function SourceTag({ source, size = 'small' }: { source: VideoSource; size?: 'small' | 'large' }) {
  const big = size === 'large';
  if (source === 'veo') {
    return (
      <View style={[styles.tag, { backgroundColor: VEO_GREEN, height: big ? 30 : 20 }]} accessibilityLabel="Veo">
        <Image source={VEO_LOGO} style={{ width: big ? 50 : 34, height: big ? 28 : 19 }} resizeMode="contain" />
      </View>
    );
  }
  return (
    <View style={[styles.tag, { backgroundColor: '#fff', borderWidth: StyleSheet.hairlineWidth, borderColor: '#D8DCE3', height: big ? 30 : 20, paddingHorizontal: big ? 10 : 6, gap: 4 }]} accessibilityLabel="YouTube">
      <Ionicons name="logo-youtube" size={big ? 20 : 14} color={YOUTUBE_RED} />
      <Text style={{ color: '#0F0F0F', fontFamily: fonts.semi, fontSize: big ? 14 : 11, letterSpacing: -0.2 }}>YouTube</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 6, overflow: 'hidden' },
});
