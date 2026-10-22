import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PlayerCard, PlayerFrame } from '../components/PlayerPage';
import { useLook } from '../lib/appTheme';
import { useData } from '../lib/data';
import { positionText } from '../lib/playerProfile';
import { fonts } from '../lib/theme';

// A player's positions and foot. They are kept in Club management (age group players).
export default function PlayerPositionsScreen() {
  const t = useLook();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { players, me } = useData();
  const player = players.find((p) => p.id === id);
  if (!player) {
    return (
      <PlayerFrame title="Positions">
        <Text style={{ color: t.soft, fontFamily: fonts.regular, textAlign: 'center' }}>This player is not in the team on show.</Text>
      </PlayerFrame>
    );
  }
  const rows: [string, string][] = [
    ['Best position', positionText(player.bestPosition)],
    ['Developing position', positionText(player.developingPosition)],
    ['Preferred position', positionText(player.preferredPosition)],
    ['Preferred foot', player.preferredFoot || '–'],
  ];
  return (
    <PlayerFrame title="Positions" sub={`${player.firstName} ${player.lastName}${me?.activeAgeGroup ? ` · ${me.activeAgeGroup.name}` : ''}`}>
      <PlayerCard>
        {rows.map(([label, value], i) => (
          <View key={label} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sport ? t.border : t.pill }]}>
            <Text style={{ flex: 1, color: t.ink, fontFamily: fonts.regular, fontSize: 16 }}>{label}</Text>
            <Text style={{ color: t.ink, fontFamily: t.sport ? t.display : fonts.medium, fontSize: t.sport ? 20 : 16 }}>{t.sport ? value.toUpperCase() : value}</Text>
          </View>
        ))}
      </PlayerCard>
      <Text style={{ color: t.soft, fontFamily: fonts.regular, fontSize: 13, marginHorizontal: 4 }}>Positions and foot are set in Club management, with the age group&apos;s players.</Text>
    </PlayerFrame>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 54 },
});
