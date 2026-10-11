import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { goBack } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';
import { fmtSize } from '../lib/videos';

// Supabase's free plan, as Supabase publishes it; kept here to show how far
// the club is from its limits.
const FREE_DATABASE_BYTES = 500e6;
const FREE_STORAGE_BYTES = 1e9;
const WARNING = 0.8;
const DASHBOARD = 'https://supabase.com/dashboard/org/_/usage';

type Usage = {
  database_bytes: number;
  accounts: number;
  buckets: { name: string; files: number; bytes: number }[];
  tables: { name: string; rows: number; bytes: number }[];
};

// For the admin: how much of Supabase's free plan the club uses. Supabase
// holds everything except the videos: players, games, trainings, reports,
// accounts, and the pictures (club logos and profile pictures).
export default function SupabaseUsageScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.rpc('admin_usage').then(({ data, error: failed }) => {
      if (failed) setError(`Could not load the usage: ${failed.message}`);
      else setUsage(data as Usage);
    });
  }, []);

  const stored = usage?.buckets.reduce((sum, b) => sum + b.bytes, 0) ?? 0;
  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };
  // A used amount against its free limit, with a bar.
  const meter = (label: string, used: number, free: number, about: string) => {
    const share = used / free;
    return (
      <View style={[styles.card, { backgroundColor: c.surface, paddingVertical: 16, gap: 8 }]}>
        <Text style={[styles.small, { color: c.inkSoft }]}>{label}</Text>
        <Text style={[styles.value, { color: c.ink }]}>
          {fmtSize(used) || '0 MB'}
          <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 15 }}> of {fmtSize(free)} free</Text>
        </Text>
        <View style={[styles.track, { backgroundColor: c.surface2 }]}>
          <View style={[styles.fill, { backgroundColor: share >= 1 ? c.danger : share >= WARNING ? c.amber : c.pitch, width: `${Math.min(100, Math.max(1, share * 100))}%` }]} />
        </View>
        <Text style={[styles.small, { color: c.inkSoft, lineHeight: 18 }]}>{about}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.page, { backgroundColor: c.chalk }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={goBack} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]}>Supabase</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error ? <Text style={[styles.note, { color: c.danger }]}>{error}</Text> : null}
        {!usage ? (
          error ? null : <ActivityIndicator color={c.pitch} style={{ marginTop: 24 }} />
        ) : (
          <>
            {meter('Database', usage.database_bytes, FREE_DATABASE_BYTES, 'Players, games, trainings, selections, line-ups, reports and accounts.')}
            {meter('Pictures', stored, FREE_STORAGE_BYTES, 'Club logos and profile pictures. Videos are not here; they are at Cloudflare.')}
            <View style={styles.tiles}>
              <View style={[styles.tile, { backgroundColor: c.surface }]}>
                <Text style={[styles.small, { color: c.inkSoft }]}>Accounts</Text>
                <Text style={[styles.value, { color: c.ink }]}>{usage.accounts}</Text>
              </View>
              <View style={[styles.tile, { backgroundColor: c.surface }]}>
                <Text style={[styles.small, { color: c.inkSoft }]}>Cost</Text>
                <Text style={[styles.value, { color: c.ink }]}>$0.00</Text>
                <Text style={[styles.small, { color: c.inkSoft }]}>the free plan</Text>
              </View>
            </View>
            <Text style={[styles.note, { color: c.inkSoft }]}>
              Supabase does not charge on the free plan. When a limit is reached it stops accepting new data until you make room or upgrade.
            </Text>

            {usage.buckets.length ? (
              <>
                <Text style={[styles.section, { color: c.ink }]}>Pictures</Text>
                <View style={[styles.card, { backgroundColor: c.surface }]}>
                  {usage.buckets.map((b, i) => (
                    <View key={b.name} style={[styles.row, i > 0 && line]}>
                      <Text style={[styles.label, { color: c.ink }]}>{b.name}</Text>
                      <Text style={[styles.small, { color: c.inkSoft }]}>
                        {b.files} {b.files === 1 ? 'file' : 'files'} · {fmtSize(b.bytes) || 'under 1 MB'}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            <Text style={[styles.section, { color: c.ink }]}>Largest tables</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              {usage.tables.map((t, i) => (
                <View key={t.name} style={[styles.row, i > 0 && line]}>
                  <Text style={[styles.label, { color: c.ink }]}>{t.name}</Text>
                  <Text style={[styles.small, { color: c.inkSoft }]}>
                    {t.rows.toLocaleString('en-GB')} rows · {t.bytes >= 1e6 ? fmtSize(t.bytes) : `${Math.max(1, Math.round(t.bytes / 1000))} KB`}
                  </Text>
                </View>
              ))}
            </View>

            <View style={[styles.card, { backgroundColor: c.surface, marginTop: 8 }]}>
              <Pressable style={styles.row} onPress={() => Linking.openURL(DASHBOARD)}>
                <Ionicons name="open-outline" size={20} color={c.ink} />
                <Text style={[styles.label, { color: c.ink }]}>Open Supabase</Text>
                <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
              </Pressable>
            </View>
            <Text style={[styles.note, { color: c.inkSoft }]}>For the data sent out and the other figures Supabase counts.</Text>
          </>
        )}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingVertical: 9 },
  label: { flex: 1, fontFamily: fonts.regular, fontSize: 16 },
  small: { fontFamily: fonts.regular, fontSize: 13 },
  value: { fontFamily: fonts.semi, fontSize: 24 },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, borderRadius: 14, padding: 14, gap: 2 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  note: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, marginHorizontal: 4 },
  section: { fontFamily: fonts.medium, fontSize: 19, marginTop: 12 },
});
