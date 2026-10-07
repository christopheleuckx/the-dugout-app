import { Empty, Screen, SectionTitle, TrainingCard } from '../../components/ui';
import { todayIso, useData } from '../../lib/data';

export default function Trainings() {
  const { trainings } = useData();
  const today = todayIso();

  const upcoming = trainings.filter((t) => t.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = trainings
    .filter((t) => t.date < today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  return (
    <Screen title="Trainings">
      <SectionTitle>Upcoming</SectionTitle>
      {upcoming.length ? (
        upcoming.map((t) => <TrainingCard key={t.id} training={t} />)
      ) : (
        <Empty>No upcoming trainings.</Empty>
      )}

      <SectionTitle>Last 10</SectionTitle>
      {past.length ? past.map((t) => <TrainingCard key={t.id} training={t} />) : <Empty>No past trainings.</Empty>}
    </Screen>
  );
}
