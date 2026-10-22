import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLook } from '../lib/appTheme';
import { goBack } from '../lib/nav';
import { fonts } from '../lib/theme';

// The frame of the player page and its sub pages (positions, games, training,
// injuries), in the theme on show: back button, title and subtitle, scrolling content.
export function PlayerFrame({ title, sub, children, after }: { title: string; sub?: string; children: ReactNode; after?: ReactNode }) {
  const t = useLook();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.page, { backgroundColor: t.page }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable style={[styles.round, { backgroundColor: t.card }]} onPress={goBack} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={t.ink} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.title, { color: t.ink }]} numberOfLines={1}>
            {title}
          </Text>
          {sub ? <Text style={{ color: t.soft, fontFamily: fonts.regular, fontSize: 13 }}>{sub}</Text> : null}
        </View>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
      {after}
    </View>
  );
}

// A section title: italic capitals in Sport, the app's own heading in Classic.
export function PlayerSection({ children }: { children: string }) {
  const t = useLook();
  return t.sport ? (
    <Text style={{ fontFamily: t.display, fontSize: 24, color: t.ink, marginTop: 10, marginHorizontal: 4 }}>{children.toUpperCase()}</Text>
  ) : (
    <Text style={{ fontFamily: fonts.medium, fontSize: 19, color: t.ink, marginTop: 8 }}>{children}</Text>
  );
}

// A card in the theme on show.
export function PlayerCard({ children, style }: { children: ReactNode; style?: object }) {
  const t = useLook();
  return <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border, borderRadius: t.radius }, style]}>{children}</View>;
}

// A tappable row with an icon, a title, a line below and an arrow.
export function NavRow({ icon, title, sub, onPress, first }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; onPress: () => void; first?: boolean }) {
  const t = useLook();
  return (
    <Pressable style={[styles.nav, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sport ? t.border : t.pill }]} onPress={onPress}>
      <View style={[styles.icon, { backgroundColor: t.pill }]}>
        <Ionicons name={icon} size={18} color={t.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.ink, fontFamily: fonts.medium, fontSize: 15 }}>{title}</Text>
        <Text style={{ color: t.soft, fontFamily: fonts.regular, fontSize: 13 }} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={t.soft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.medium, fontSize: 17 },
  content: { padding: 16, gap: 12, paddingBottom: 60 },
  card: { borderWidth: 1, paddingHorizontal: 16 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
