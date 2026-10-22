import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PlayerCard, PlayerFrame, PlayerSection } from '../components/PlayerPage';
import { useLook } from '../lib/appTheme';
import { fmtDate, useData } from '../lib/data';
import { playerTrainings } from '../lib/playerProfile';
import { fonts } from '../lib/theme';

// A player's training attendance: how many he attended, why he was absent, and
// the trainings he missed. GK training and training with another team don't
// count against him, as in Player statistics.
export default function PlayerTrainingScreen() {
  const t = useLook();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { players, trainings, me } = useData();
  const player = players.find((p) => p.id === id);
  if (!player) {
    return (
      <PlayerFrame title="Training">
        <Text style={{ color: t.soft, fontFamily: fonts.regular, textAlign: 'center' }}>This player is not in the team on show.</Text>
      </PlayerFrame>
    );
  }
  const s = playerTrainings(player, trainings);
  const most = Math.max(1, ...s.reasons.map((r) => r.count));
  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sport ? t.border : t.pill };
  const big = { fontFamily: t.display, color: t.ink };

  return (
    <PlayerFrame title="Training" sub={`${player.firstName} ${player.lastName}${me?.activeAgeGroup ? ` · ${me.activeAgeGroup.name}` : ''}`}>
      <View style={[styles.stats, { backgroundColor: t.feature, borderRadius: t.radius + 2 }]}>
        {(
          [
            [String(s.attended), 'Attended', `of ${s.counting}`],
            [`${s.percent}%`, 'Attendance', s.held !== s.counting ? `${s.held - s.counting} excused` : 'of the trainings'],
            [String(s.missed.length), 'Absent', s.missed.length === 1 ? 'training' : 'trainings'],
          ] as [string, string, string][]
        ).map(([value, label, sub], i) => (
          <View key={label} style={[styles.stat, i > 0 && { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.18)' }]}>
            <Text style={[big, { color: '#fff', fontSize: 36, lineHeight: 38 }]}>{value}</Text>
            <Text style={{ color: '#fff', fontFamily: fonts.medium, fontSize: 13 }}>{label}</Text>
            <Text style={{ color: t.featureSoft, fontFamily: fonts.regular, fontSize: 12 }}>{sub}</Text>
          </View>
        ))}
      </View>

      <PlayerSection>Why absent</PlayerSection>
      {s.reasons.length ? (
        <PlayerCard style={{ paddingVertical: 10 }}>
          {s.reasons.map((r) => (
            <View key={r.reason} style={styles.reason}>
              <Text style={{ width: 150, color: t.ink, fontFamily: fonts.regular, fontSize: 14 }} numberOfLines={2}>
                {r.reason}
              </Text>
              <View style={{ flex: 1 }}>
                <View style={[styles.bar, { width: `${(r.count / most) * 100}%`, backgroundColor: r.excused ? t.soft : t.accent }]} />
              </View>
              <Text style={{ width: 22, textAlign: 'right', color: t.soft, fontFamily: fonts.regular, fontSize: 13 }}>{r.count}</Text>
            </View>
          ))}
          {s.reasons.some((r) => r.excused) ? (
            <Text style={{ color: t.soft, fontFamily: fonts.regular, fontSize: 12, marginTop: 8 }}>Grey reasons don&apos;t count against the attendance.</Text>
          ) : null}
        </PlayerCard>
      ) : (
        <Text style={{ color: t.soft, fontFamily: fonts.regular, fontSize: 14, marginHorizontal: 4 }}>Never absent.</Text>
      )}

      {s.missed.length ? (
        <>
          <PlayerSection>Missed trainings</PlayerSection>
          <PlayerCard>
            {s.missed.map((tr, i) => (
              <Pressable key={tr.id} style={[styles.row, i > 0 && line]} onPress={() => router.push(`/training/${tr.id}`)}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.ink, fontFamily: fonts.medium, fontSize: 15 }} numberOfLines={1}>
                    {tr.label}
                  </Text>
                  <Text style={{ color: t.soft, fontFamily: fonts.regular, fontSize: 12.5 }}>{fmtDate(tr.date)}</Text>
                </View>
                <View style={[styles.chip, { backgroundColor: t.pill }]}>
                  <Text style={{ color: t.soft, fontFamily: fonts.medium, fontSize: 11.5 }}>{tr.absences[player.id] || 'No reason'}</Text>
                </View>
              </Pressable>
            ))}
          </PlayerCard>
        </>
      ) : null}
    </PlayerFrame>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 6 },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  bar: { height: 10, borderRadius: 5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  chip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
});
