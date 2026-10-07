import { Empty, GameCard, Screen, SectionTitle } from '../../components/ui';
import { todayIso, useData } from '../../lib/data';

export default function Games() {
  const { games } = useData();
  const today = todayIso();

  const upcoming = games
    .filter((g) => !g.date || g.date >= today)
    .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
  const played = games
    .filter((g) => g.date && g.date < today)
    .sort((a, b) => b.date!.localeCompare(a.date!));

  return (
    <Screen title="Games">
      <SectionTitle>Upcoming</SectionTitle>
      {upcoming.length ? upcoming.map((g) => <GameCard key={g.id} game={g} />) : <Empty>No upcoming games.</Empty>}

      <SectionTitle>Played</SectionTitle>
      {played.length ? played.map((g) => <GameCard key={g.id} game={g} />) : <Empty>No games played yet.</Empty>}
    </Screen>
  );
}
