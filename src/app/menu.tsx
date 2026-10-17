import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useData } from '../lib/data';
import { goBack } from '../lib/nav';
import { fonts, useColors } from '../lib/theme';

type Item = { label: string; hint: string; icon: keyof typeof Ionicons.glyphMap; to: string };

// "Configure and manage" behind the Profile: clubs and coaches for admins,
// opponents and leagues for every coach.
export default function MenuScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { me } = useData();

  const items: Item[] = [
    ...(me?.isAdmin
      ? ([
          { label: 'Club management', hint: 'Clubs, their logos, age groups and formats', icon: 'shield-outline', to: '/manage?view=age-groups' },
          { label: 'Coaches', hint: 'Who can sign in, their age groups and what they may do', icon: 'people-outline', to: '/manage?view=coaches' },
        ] as Item[])
      : []),
    { label: 'Opponents', hint: 'Names and logos', icon: 'flag-outline', to: '/opponents' },
    { label: 'Leagues and fixtures', hint: 'Competitions, matchdays and rules', icon: 'trophy-outline', to: '/leagues' },
  ];

  return (
    <View style={[styles.page, { backgroundColor: c.chalk }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={goBack} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]}>Configure and manage</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          {items.map((item, i) => (
            <Pressable
              key={item.label}
              style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}
              onPress={() => router.push(item.to as never)}
            >
              <Ionicons name={item.icon} size={22} color={c.inkSoft} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontFamily: fonts.regular, fontSize: 16 }}>{item.label}</Text>
                <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>{item.hint}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 17 },
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  card: { borderRadius: 14, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingVertical: 9 },
});
