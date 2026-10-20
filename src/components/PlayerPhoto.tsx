import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import type { Player } from '../lib/data';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';

// The photos are private: links that work for an hour, fetched once per set
// of players and shared by every PlayerPhoto on the screen.
export function usePlayerPhotos(players: Player[]) {
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const paths = players
    .map((p) => p.photoPath)
    .filter((x): x is string => !!x)
    .sort()
    .join(',');
  useEffect(() => {
    if (!paths) return;
    supabase.storage
      .from('player-photos')
      .createSignedUrls(paths.split(','), 3600)
      .then(({ data }) => setPhotos(Object.fromEntries((data ?? []).flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl]] : [])))));
  }, [paths]);
  return photos;
}

// A player's photo in a circle, zoomed in on the face, or the initials when
// there is none. With `badge` a small tag (the position) sits on its corner.
export function PlayerPhoto({ player, url, size = 36, badge }: { player: Player; url?: string; size?: number; badge?: string }) {
  const c = useColors();
  const initials = `${player.firstName.trim()[0] ?? ''}${player.lastName.trim()[0] ?? ''}`.toUpperCase();
  const zoom = size * 1.35;
  return (
    <View>
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: c.surface2 },
          url ? { borderWidth: StyleSheet.hairlineWidth, borderColor: c.line } : null,
        ]}
      >
        {url ? (
          <Image source={{ uri: url }} style={{ position: 'absolute', width: zoom, height: zoom, left: (size - zoom) / 2, top: -size * 0.05 }} />
        ) : (
          <Text style={{ color: c.pitch, fontFamily: fonts.medium, fontSize: size * 0.35 }}>{initials}</Text>
        )}
      </View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={{ color: c.ink, fontFamily: fonts.semi, fontSize: 9.5 }}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  badge: {
    position: 'absolute',
    right: -6,
    bottom: -3,
    minWidth: 18,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
