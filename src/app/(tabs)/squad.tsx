import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Empty, Screen, SectionTitle } from '../../components/ui';
import { injuryOn, todayIso, useData } from '../../lib/data';
import { groupOf, POSITION_GROUPS } from '../../lib/selection';
import { supabase } from '../../lib/supabase';
import { fonts, useColors } from '../../lib/theme';

export default function Squad() {
  const c = useColors();
  const { players } = useData();
  // The photos are private: the app asks for links that work for an hour,
  // only for a signed-in coach.
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const paths = players.map((p) => p.photoPath).filter((x): x is string => !!x).sort().join(',');
  useEffect(() => {
    if (!paths) return setPhotos({});
    supabase.storage
      .from('player-photos')
      .createSignedUrls(paths.split(','), 3600)
      .then(({ data }) => setPhotos(Object.fromEntries((data ?? []).flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl]] : [])))));
  }, [paths]);
  // The same lines as on a game's selection: goalies first, attackers last,
  // and inside a line by position number, then by name.
  const lines = [...POSITION_GROUPS, { label: 'No position', positions: [] as string[] }]
    .map((group, i) => ({
      label: group.label,
      players: players
        .filter((p) => groupOf(p.bestPosition ?? '') === i)
        .sort((x, y) => (Number(x.bestPosition) || 0) - (Number(y.bestPosition) || 0) || x.firstName.localeCompare(y.firstName)),
    }))
    .filter((line) => line.players.length);

  return (
    <Screen title="Squad">
      {players.length === 0 ? <Empty>No players yet.</Empty> : null}
      {lines.map((line) => (
        <View key={line.label} style={{ gap: 10 }}>
          <SectionTitle>{line.label}</SectionTitle>
          {line.players.map((p) => (
            <Pressable key={p.id} onPress={() => router.push({ pathname: '/squad-player', params: { id: p.id } })} accessibilityLabel={`${p.firstName} ${p.lastName}`}>
            <Card>
              <View style={styles.row}>
                <View style={[styles.number, p.photoPath && photos[p.photoPath] ? { backgroundColor: c.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line } : { backgroundColor: c.pitch }]}>
                  {/* The photo when there is one, otherwise the initials. */}
                  {p.photoPath && photos[p.photoPath] ? (
                    <Image source={{ uri: photos[p.photoPath] }} style={styles.photo} accessibilityLabel={`${p.firstName} ${p.lastName}`} />
                  ) : (
                    <Text style={[styles.numberText, { color: c.onPitch, fontSize: 16 }]}>
                      {`${p.firstName.trim().charAt(0)}${p.lastName.trim().charAt(0)}`.toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text style={[styles.name, { flex: 1, color: c.ink }]}>
                  {p.firstName} {p.lastName}
                </Text>
                {injuryOn(p, todayIso()) ? (
                  <View style={[styles.injured, { backgroundColor: c.danger + '22' }]}>
                    <Ionicons name="medkit" size={11} color={c.danger} />
                    <Text style={{ color: c.danger, fontFamily: fonts.medium, fontSize: 12 }}>Injured</Text>
                  </View>
                ) : null}
                <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
              </View>
            </Card>
            </Pressable>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Zoomed in on the face: the photos show head and shoulders.
  photo: { position: 'absolute', width: 54, height: 54, left: -7, top: -2 },
  number: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  numberText: { fontFamily: fonts.display, fontSize: 20 },
  name: { fontSize: 16, fontWeight: '600' },
  injured: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
});
