import type { ReactNode, RefObject } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useData } from '../lib/data';
import { fonts, useColors } from '../lib/theme';
import { Loader } from './Loader';

// Page frame shared by every tab: title bar with the app logo, pull-to-refresh, and the
// loading / error states for the shared data load.
export function Screen({
  title,
  scrollRef,
  children,
}: {
  title: string;
  scrollRef?: RefObject<ScrollView | null>;
  children: ReactNode;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { loading, error, refresh } = useData();

  return (
    <View style={{ flex: 1, backgroundColor: c.chalk }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Image source={require('../../assets/icon.png')} style={styles.appLogo} accessibilityLabel="The Dugout" />
        <Text style={[styles.headerTitle, { color: c.ink }]}>{title}</Text>
        {/* Spacer the size of the logo keeps the title centred. */}
        <View style={{ width: 40 }} />
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}>
          <Loader />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={c.pitch} />}
        >
          {error ? <Text style={{ color: c.danger }}>Could not load data: {error}</Text> : children}
        </ScrollView>
      )}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.sectionTitle, { color: c.ink }]}>{children}</Text>;
}

export function Card({ children }: { children: ReactNode }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.surface }]}>{children}</View>;
}

export function Empty({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={{ color: c.inkSoft, paddingVertical: 8 }}>{children}</Text>;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingBottom: 10, flexDirection: 'row', alignItems: 'center' },
  appLogo: { width: 40, height: 40, borderRadius: 10 },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 19 },
  content: { padding: 16, gap: 10, paddingBottom: 120 },
  card: { borderRadius: 14, padding: 14, gap: 10 },
  sectionTitle: { fontFamily: fonts.medium, fontSize: 19, marginTop: 12 },
});
