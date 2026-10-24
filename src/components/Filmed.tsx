import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { fonts } from '../lib/theme';

// The cameras one of our games can be filmed with. The kind sets the colour:
// Veo green, Huddle blue, grey when the camera is not known.
export type Filmed = 'vc3' | 'veocam' | 'veo_opponent' | 'huddle' | 'unknown';
export const CAMERAS: { key: Filmed; label: string; sub?: string; kind: 'veo' | 'huddle' | 'unknown' }[] = [
  { key: 'vc3', label: 'VC3 – 65523', sub: 'FCV Dender', kind: 'veo' },
  { key: 'veocam', label: 'VEOCAM – 13108', sub: 'FCV Dender', kind: 'veo' },
  { key: 'veo_opponent', label: 'Veo opponent', kind: 'veo' },
  { key: 'huddle', label: 'Huddle', kind: 'huddle' },
  { key: 'unknown', label: 'Unknown', sub: 'Filmed, camera not known', kind: 'unknown' },
];
const COLORS = { veo: '#0B3D18', huddle: '#1E4289', unknown: '#888780' };

export const cameraOf = (key: string | null | undefined) => CAMERAS.find((c) => c.key === key) ?? null;
export const cameraName = (key: string | null | undefined) => {
  const cam = cameraOf(key);
  return !cam ? 'Not filmed' : cam.kind === 'veo' ? `Veo · ${cam.label}` : cam.label;
};

// A small round camera icon, for game cards and lists. Nothing when not filmed.
export function FilmedIcon({ filmed, size = 18 }: { filmed: string | null | undefined; size?: number }) {
  const cam = cameraOf(filmed);
  if (!cam) return null;
  return (
    <View style={[styles.icon, { width: size, height: size, borderRadius: size / 2, backgroundColor: COLORS[cam.kind] }]} accessibilityLabel={`Filmed: ${cameraName(filmed)}`}>
      <Ionicons name="videocam" size={size * 0.58} color="#fff" />
    </View>
  );
}

// The badge above the game card: the icon and the camera's name.
export function FilmedBadge({ filmed }: { filmed: string | null | undefined }) {
  const cam = cameraOf(filmed);
  if (!cam) return null;
  return (
    <View style={[styles.badge, { backgroundColor: COLORS[cam.kind] }]}>
      <Ionicons name="videocam" size={13} color="#fff" />
      <Text style={styles.badgeText}>{cameraName(filmed)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#fff', fontFamily: fonts.medium, fontSize: 12 },
});
