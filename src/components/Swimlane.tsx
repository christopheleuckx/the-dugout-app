import { Children, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useColors } from '../lib/theme';

const GAP = 12;
const GUTTER = 16;

// Horizontal, snapping row of equally wide cards with page dots underneath.
// Bleeds through the page's side padding so cards scroll edge to edge.
// `initialIndex` is the card the lane opens on.
export function Swimlane({ cardWidth, initialIndex = 0, children }: { cardWidth: number; initialIndex?: number; children: ReactNode }) {
  const c = useColors();
  const [active, setActive] = useState(initialIndex);
  const cards = Children.toArray(children);

  return (
    <View style={{ marginHorizontal: -GUTTER }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + GAP}
        decelerationRate="fast"
        contentOffset={{ x: initialIndex * (cardWidth + GAP), y: 0 }}
        contentContainerStyle={{ paddingHorizontal: GUTTER, gap: GAP }}
        scrollEventThrottle={32}
        onScroll={({ nativeEvent: e }) => {
          const atEnd = e.contentOffset.x + e.layoutMeasurement.width >= e.contentSize.width - 4;
          const index = atEnd ? cards.length - 1 : Math.round(e.contentOffset.x / (cardWidth + GAP));
          setActive(Math.max(0, Math.min(cards.length - 1, index)));
        }}
      >
        {cards.map((card, i) => (
          <View key={i} style={{ width: cardWidth }}>
            {card}
          </View>
        ))}
      </ScrollView>
      {cards.length > 1 ? (
        <View style={styles.dots}>
          {cards.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, { backgroundColor: c.line }, i === active && { width: 18, backgroundColor: c.pitch }]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
