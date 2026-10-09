import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { appVersion, RELEASE_NOTES } from '../lib/releaseNotes';
import { fonts, useColors } from '../lib/theme';

// What's new in this version, in plain words.
export default function AboutScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.page, { backgroundColor: c.chalk }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={() => router.back()} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]}>About this version</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.version, { color: c.inkSoft }]}>The Dugout {appVersion()}</Text>
        {RELEASE_NOTES.map((release) => (
          <View key={release.version} style={{ gap: 10 }}>
            <Text style={[styles.heading, { color: c.ink }]}>{release.title}</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              {release.items.map((item, i) => (
                <View key={item.title} style={[styles.item, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}>
                  <Text style={[styles.itemTitle, { color: c.ink }]}>{item.title}</Text>
                  <Text style={[styles.itemText, { color: c.inkSoft }]}>{item.text}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 17 },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  version: { fontFamily: fonts.regular, fontSize: 14 },
  heading: { fontFamily: fonts.medium, fontSize: 22, lineHeight: 27 },
  card: { borderRadius: 14, paddingHorizontal: 16 },
  item: { paddingVertical: 14, gap: 3 },
  itemTitle: { fontFamily: fonts.medium, fontSize: 16 },
  itemText: { fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 20 },
});
