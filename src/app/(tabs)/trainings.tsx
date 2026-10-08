import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { Empty, Screen, SectionTitle, TrainingCard } from '../../components/ui';
import { todayIso, useData, type Training } from '../../lib/data';

export default function Trainings() {
  const { trainings } = useData();
  const today = todayIso();

  const upcoming = trainings.filter((t) => t.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = trainings
    .filter((t) => t.date < today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  const card = (t: Training) => (
    <Pressable key={t.id} onPress={() => router.push(`/training/${t.id}`)}>
      <TrainingCard training={t} />
    </Pressable>
  );

  return (
    <Screen title="Trainings">
      <SectionTitle>Upcoming</SectionTitle>
      {upcoming.length ? (
        upcoming.map((t) => card(t))
      ) : (
        <Empty>No upcoming trainings.</Empty>
      )}

      <SectionTitle>Last 10</SectionTitle>
      {past.length ? past.map((t) => card(t)) : <Empty>No past trainings.</Empty>}
    </Screen>
  );
}
