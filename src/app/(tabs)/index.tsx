import { Empty, GameCard, Screen, SectionTitle, TrainingCard } from '../../components/ui';
import { todayIso, useData } from '../../lib/data';

export default function Dashboard() {
  const { games, trainings, me } = useData();
  const today = todayIso();

  const nextGame = games
    .filter((g) => g.date && g.date >= today && !g.cancelStatus)
    .sort((a, b) => a.date!.localeCompare(b.date!))[0];
  const nextTraining = trainings
    .filter((t) => t.date >= today && !t.cancelStatus)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const lastResults = games
    .filter((g) => g.scores.length > 0 && g.date)
    .sort((a, b) => b.date!.localeCompare(a.date!))
    .slice(0, 3);

  return (
    <Screen title={me?.firstName ? `Hi ${me.firstName}` : 'Dashboard'}>
      <SectionTitle>Next game</SectionTitle>
      {nextGame ? <GameCard game={nextGame} /> : <Empty>No upcoming game planned.</Empty>}

      <SectionTitle>Next training</SectionTitle>
      {nextTraining ? <TrainingCard training={nextTraining} /> : <Empty>No upcoming training planned.</Empty>}

      <SectionTitle>Latest results</SectionTitle>
      {lastResults.length ? (
        lastResults.map((g) => <GameCard key={g.id} game={g} />)
      ) : (
        <Empty>No results yet.</Empty>
      )}
    </Screen>
  );
}
