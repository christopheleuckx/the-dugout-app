import { StyleSheet, Text, View } from 'react-native';

import { Card, Empty, Screen, SectionTitle } from '../../components/ui';
import { useData } from '../../lib/data';
import { groupOf, POSITION_GROUPS } from '../../lib/selection';
import { fonts, useColors } from '../../lib/theme';

export default function Squad() {
  const c = useColors();
  const { players } = useData();
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
            <Card key={p.id}>
              <View style={styles.row}>
                <View style={[styles.number, { backgroundColor: c.pitch }]}>
                  <Text style={[styles.numberText, { color: c.onPitch }]}>{p.bestPosition || '–'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: c.ink }]}>
                    {p.firstName} {p.lastName}
                  </Text>
                  <Text style={{ color: c.inkSoft }}>
                    {[p.developingPosition && p.developingPosition !== p.bestPosition && `Also ${p.developingPosition}`, p.preferredFoot && `${p.preferredFoot} foot`].filter(Boolean).join(' · ') ||
                      (p.bestPosition ? 'No foot set' : 'No position set')}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
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
