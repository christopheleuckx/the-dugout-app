import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { sportFonts, sportShape, useSportColors } from '../lib/appTheme';
import { fonts } from '../lib/theme';
import { Crest } from './MatchCard';

// Home's greeting and week list in the Sport theme (beta).

export function SportGreeting({ greeting, firstName }: { greeting: string; firstName?: string }) {
  const p = useSportColors();
  return (
    <View>
      <Text style={[styles.small, { color: p.soft, fontSize: 14 }]}>
        {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
      </Text>
      <Text style={[styles.greeting, { color: p.ink }]}>
        {greeting.toUpperCase()},{firstName ? '\n' : ''}
        {firstName ? <Text style={{ color: p.game }}>{firstName.toUpperCase()}</Text> : null}
      </Text>
    </View>
  );
}

// A section title on Home in the Sport theme, like THIS WEEK.
export function SportSectionTitle({ children }: { children: string }) {
  const p = useSportColors();
  return <Text style={[styles.italic, { fontSize: 28, color: p.ink, marginTop: 12 }]}>{children.toUpperCase()}</Text>;
}

export type WeekItem = {
  key: string;
  date: string;
  kind: 'Game' | 'Training';
  // The age group it belongs to, and whether that is the one on show.
  group: string;
  own: boolean;
  name: string;
  time: string | null;
  // Home or away for a game, the pitch for a training.
  place: string;
  cancelled: string | null;
  crestName: string;
  logoUrl: string | null;
  onPress: (() => void) | null;
};

const dayOf = (iso: string) => new Date(iso + 'T00:00:00');
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const shortDate = (iso: string) => dayOf(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

// The week as a strip of seven days (today highlighted, a dot per kind of
// activity), then a card per day with a row per game or training.
export function SportWeek({
  week,
  items,
  today,
  offset,
  onPrev,
  onNext,
  onToday,
}: {
  week: string[];
  items: WeekItem[];
  today: string;
  offset: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const p = useSportColors();
  const title = offset === 0 ? 'THIS WEEK' : offset === -1 ? 'LAST WEEK' : offset === 1 ? 'NEXT WEEK' : 'WEEK';
  const range = `${dayOf(week[0]).getDate()} – ${shortDate(week[6])}`;
  const days = week.map((date) => ({ date, items: items.filter((it) => it.date === date) }));
  const round = [styles.round, { backgroundColor: p.card }];

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.head}>
        <Text style={[styles.italic, { flex: 1, fontSize: 28, color: p.ink }]}>{title}</Text>
        <Text style={[styles.small, { color: p.soft }]}>{range}</Text>
        {offset !== 0 ? (
          <Pressable style={[round, { width: 'auto', paddingHorizontal: 12 }]} onPress={onToday}>
            <Text style={{ color: p.ink, fontFamily: fonts.medium, fontSize: 13 }}>Today</Text>
          </Pressable>
        ) : null}
        <Pressable style={round} onPress={onPrev} accessibilityLabel="Previous week" hitSlop={6}>
          <Ionicons name="chevron-back" size={18} color={p.ink} />
        </Pressable>
        <Pressable style={round} onPress={onNext} accessibilityLabel="Next week" hitSlop={6}>
          <Ionicons name="chevron-forward" size={18} color={p.ink} />
        </Pressable>
      </View>

      <View style={[styles.strip, { backgroundColor: p.card }]}>
        {days.map(({ date, items: on }) => {
          const isToday = date === today;
          const kinds = [on.some((it) => it.kind === 'Game') && p.game, on.some((it) => it.kind === 'Training') && p.training].filter(Boolean) as string[];
          return (
            <View key={date} style={[styles.stripDay, isToday && { backgroundColor: p.feature }]}>
              <Text style={[styles.small, { fontSize: 11, color: isToday ? p.featureSoft : p.soft }]}>{WEEKDAYS[dayOf(date).getDay()]}</Text>
              <Text style={[styles.italic, { fontSize: 20, color: isToday ? '#fff' : p.ink }]}>{dayOf(date).getDate()}</Text>
              <View style={styles.dots}>
                {kinds.map((color) => (
                  <View key={color} style={[styles.dot, { backgroundColor: isToday ? '#fff' : color }]} />
                ))}
              </View>
            </View>
          );
        })}
      </View>

      {items.length === 0 ? <Text style={[styles.small, { color: p.soft, textAlign: 'center', paddingVertical: 12 }]}>Nothing scheduled this week.</Text> : null}
      {days
        .filter((d) => d.items.length)
        .map(({ date, items: on }) => (
          <View key={date} style={[styles.day, { backgroundColor: p.card, borderColor: p.border }]}>
            <View style={styles.dayNumber}>
              <Text style={[styles.italic, { fontSize: 30, lineHeight: 32, color: date === today ? p.game : p.ink }]}>{dayOf(date).getDate()}</Text>
              <Text style={[styles.small, { color: p.soft }]}>{WEEKDAYS[dayOf(date).getDay()]}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              {on.map((it, i) => {
                const fg = it.own ? p.ink : p.soft;
                const bar = !it.own ? p.faint : it.kind === 'Game' ? p.game : p.training;
                return (
                  <Pressable key={it.key} disabled={!it.onPress} onPress={it.onPress ?? undefined} style={[styles.item, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border }]}>
                    <View style={[styles.bar, { backgroundColor: bar }]} />
                    {it.kind === 'Game' ? <Crest url={it.logoUrl} name={it.crestName} size={30} /> : null}
                    {/* Home or away (or the pitch) above; the tag, name and time on one centred line. */}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.small, { color: it.cancelled ? p.loss : p.soft, textTransform: it.cancelled ? 'capitalize' : 'none' }]} numberOfLines={1}>
                        {it.cancelled ?? it.place}
                      </Text>
                      <View style={styles.nameLine}>
                        <View style={[styles.tag, { backgroundColor: it.own ? p.ownTag : p.pill }]}>
                          <Text style={[styles.tagText, { color: it.own ? p.onOwnTag : p.soft }]}>{it.group}</Text>
                        </View>
                        <Text style={[styles.italic, { flex: 1, fontSize: 18, color: p.ink }]} numberOfLines={1}>
                          {it.name.toUpperCase()}
                        </Text>
                        <Text style={[styles.italic, { fontSize: 20, color: fg }]}>{it.time ?? ''}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  italic: { fontFamily: sportFonts.display },
  small: { fontFamily: fonts.regular, fontSize: 12.5 },
  greeting: { fontFamily: sportFonts.display, fontSize: 40, lineHeight: 40, marginTop: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  round: { width: 34, height: 34, borderRadius: sportShape.pill, alignItems: 'center', justifyContent: 'center' },
  strip: { flexDirection: 'row', borderRadius: 18, padding: 6, gap: 4 },
  stripDay: { flex: 1, alignItems: 'center', borderRadius: 14, paddingTop: 6, paddingBottom: 7 },
  dots: { flexDirection: 'row', gap: 3, height: 5, marginTop: 3 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  day: { flexDirection: 'row', gap: 12, borderRadius: sportShape.card, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 14 },
  dayNumber: { width: 44, alignItems: 'center', paddingTop: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  bar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tag: { borderRadius: sportShape.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontFamily: fonts.medium, fontSize: 11 },
});
