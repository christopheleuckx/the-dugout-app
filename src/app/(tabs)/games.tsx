import { Fragment, useRef } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { isPlayed, MatchCard } from '../../components/MatchCard';
import { Empty, Screen, SectionTitle } from '../../components/ui';
import { todayIso, useData } from '../../lib/data';

const monthTitle = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

// The whole season as one calendar, oldest first, with a title per month.
// It opens on the next game: scroll up for results, down for what's coming.
export default function Games() {
  const { games } = useData();
  const { height } = useWindowDimensions();
  const today = todayIso();
  const scrollRef = useRef<ScrollView>(null);
  const opened = useRef(false);

  const sorted = games
    .slice()
    .sort((a, b) => ((a.date ?? '9999') + (a.time ?? '')).localeCompare((b.date ?? '9999') + (b.time ?? '')));
  const next = sorted.find((g) => g.date && g.date >= today && !g.cancelStatus && !isPlayed(g, today));
  // With no game left to play, open on the most recent one instead.
  const focusId = (next ?? sorted.filter((g) => g.date).at(-1))?.id;

  return (
    <Screen title="Games" scrollRef={scrollRef}>
      {sorted.length === 0 ? <Empty>No games planned.</Empty> : null}
      {sorted.map((g, i) => {
        const month = g.date ? g.date.slice(0, 7) : '';
        const newMonth = i === 0 || month !== (sorted[i - 1].date ?? '').slice(0, 7);
        return (
          <Fragment key={g.id}>
            {newMonth ? <SectionTitle>{g.date ? monthTitle(g.date) : 'No date yet'}</SectionTitle> : null}
            <View
              onLayout={(e) => {
                if (g.id !== focusId || opened.current) return;
                opened.current = true;
                const { y, height: cardHeight } = e.nativeEvent.layout;
                // Park the card around the middle of the visible page.
                scrollRef.current?.scrollTo({ y: Math.max(0, y - (height * 0.62 - cardHeight) / 2), animated: false });
              }}
            >
              <MatchCard
                game={g}
                today={today}
                variant={g.id === next?.id ? 'next' : isPlayed(g, today) ? 'played' : 'upcoming'}
              />
            </View>
          </Fragment>
        );
      })}
    </Screen>
  );
}
