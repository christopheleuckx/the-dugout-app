import { StyleSheet, Text, View } from 'react-native';

import { Card, Empty, Screen, SectionTitle } from '../../components/ui';
import { useData } from '../../lib/data';
import { fonts, useColors } from '../../lib/theme';

export default function Squad() {
  const c = useColors();
  const { players } = useData();

  return (
    <Screen title="Squad">
      <SectionTitle>{players.length} players</SectionTitle>
      {players.length === 0 ? <Empty>No players yet.</Empty> : null}
      {players.map((p) => (
        <Card key={p.id}>
          <View style={styles.row}>
            <View style={[styles.number, { backgroundColor: c.pitch }]}>
              <Text style={[styles.numberText, { color: c.onPitch }]}>{p.number ?? '–'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: c.ink }]}>
                {p.firstName} {p.lastName}
              </Text>
              <Text style={{ color: c.inkSoft }}>
                {[p.bestPosition, p.preferredFoot && `${p.preferredFoot} foot`].filter(Boolean).join(' · ') ||
                  'No position set'}
              </Text>
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  number: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontFamily: fonts.display, fontSize: 20 },
  name: { fontSize: 16, fontWeight: '600' },
});
