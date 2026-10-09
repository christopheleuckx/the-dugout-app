import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Empty, Screen, TrainingCard } from '../../components/ui';
import { todayIso, useData, type Training } from '../../lib/data';
import { fonts, useColors } from '../../lib/theme';

type Tab = 'upcoming' | 'completed';

export default function Trainings() {
  const c = useColors();
  const { trainings, players } = useData();
  const [tab, setTab] = useState<Tab>('upcoming');
  const today = todayIso();

  const upcoming = trainings.filter((t) => t.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const completed = trainings.filter((t) => t.date < today).sort((a, b) => b.date.localeCompare(a.date));

  // Season figures count the trainings that actually took place.
  const held = completed.filter((t) => !t.cancelStatus);
  const present = (t: Training) => players.filter((p) => !(p.id in t.absences)).length;
  const average = held.length ? held.reduce((n, t) => n + present(t), 0) / held.length : null;
  const share = average !== null && players.length ? Math.round((average / players.length) * 100) : null;

  const list = tab === 'upcoming' ? upcoming : completed;

  return (
    <Screen title="Trainings">
      <View style={styles.tiles}>
        <View style={[styles.tile, { backgroundColor: c.surface }]}>
          <Text style={[styles.tileLabel, { color: c.inkSoft }]}>Trainings this season</Text>
          <Text style={[styles.tileValue, { color: c.ink }]}>{held.length}</Text>
        </View>
        <View style={[styles.tile, { backgroundColor: c.surface }]}>
          <Text style={[styles.tileLabel, { color: c.inkSoft }]}>Average attendance</Text>
          <Text style={[styles.tileValue, { color: c.ink }]}>{share !== null ? `${share}%` : '–'}</Text>
          {average !== null ? (
            <Text style={[styles.tileNote, { color: c.inkSoft }]}>
              {average.toFixed(1)} of {players.length} players
            </Text>
          ) : null}
        </View>
      </View>

      <View style={[styles.toggle, { backgroundColor: c.surface2 }]}>
        {(['upcoming', 'completed'] as Tab[]).map((t) => (
          <Pressable key={t} style={[styles.toggleOption, t === tab && { backgroundColor: c.surface }]} onPress={() => setTab(t)}>
            <Text style={{ color: t === tab ? c.ink : c.inkSoft, fontFamily: fonts.medium, fontSize: 14 }}>
              {t === 'upcoming' ? 'Upcoming' : 'Completed'}
            </Text>
          </Pressable>
        ))}
      </View>

      {list.length === 0 ? <Empty>{tab === 'upcoming' ? 'No upcoming trainings.' : 'No completed trainings yet.'}</Empty> : null}
      {list.map((t) => (
        <Pressable key={t.id} onPress={() => router.push(`/training/${t.id}`)}>
          <TrainingCard training={t} />
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, borderRadius: 14, padding: 14, gap: 2 },
  tileLabel: { fontFamily: fonts.regular, fontSize: 13 },
  tileValue: { fontFamily: fonts.semi, fontSize: 28 },
  tileNote: { fontFamily: fonts.regular, fontSize: 12.5 },
  toggle: { flexDirection: 'row', alignSelf: 'center', borderRadius: 10, padding: 3, marginVertical: 6 },
  toggleOption: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 18 },
});
