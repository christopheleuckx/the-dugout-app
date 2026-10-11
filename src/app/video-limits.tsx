import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PinPrompt } from '../components/PinPrompt';
import { Slider } from '../components/Slider';
import { goBack } from '../lib/nav';
import { pinMessage, type PinAnswer } from '../lib/pin';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';
import { FREE_PLAN, loadVideoLimits, PRICES, storageFill, type VideoLimits } from '../lib/videos';

// For the admin: how far the video storage may go past Cloudflare's free
// plan, with what that could cost a month. Saving asks for the PIN.
export default function VideoLimitsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [saved, setSaved] = useState<VideoLimits | null>(null);
  const [limits, setLimits] = useState<VideoLimits>(FREE_PLAN);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadVideoLimits().then((now) => {
      setSaved(now);
      setLimits(now);
    });
  }, []);

  const extra = {
    storage: (limits.storageGb - FREE_PLAN.storageGb) * PRICES.storageGb,
    reads: (limits.readMillions - FREE_PLAN.readMillions) * PRICES.readMillion,
    writes: (limits.writeMillions - FREE_PLAN.writeMillions) * PRICES.writeMillion,
  };
  const total = extra.storage + extra.reads + extra.writes;
  const changed = !!saved && (saved.storageGb !== limits.storageGb || saved.readMillions !== limits.readMillions || saved.writeMillions !== limits.writeMillions);
  const dollars = (n: number) => `$${n.toFixed(2)}`;

  async function confirm(pin: string) {
    const { data, error: failed } = await supabase.rpc('set_video_limits', {
      p_pin: pin,
      p_storage_gb: limits.storageGb,
      p_read_millions: limits.readMillions,
      p_write_millions: limits.writeMillions,
    });
    if (failed) return failed.message;
    if (data !== 'ok') {
      // Without a PIN there is nothing to enter: point to where it is set.
      if (data === 'none') {
        setAsking(false);
        setError('Set a PIN first.');
      }
      return pinMessage(data as PinAnswer) || 'These limits are not allowed.';
    }
    setAsking(false);
    storageFill(true);
    goBack();
  }

  const block = (
    title: string,
    value: string,
    free: string,
    cost: number,
    slider: { value: number; min: number; max: number; step: number; onChange: (n: number) => void },
  ) => (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      <View style={styles.head}>
        <Text style={[styles.name, { color: c.ink }]}>{title}</Text>
        <Text style={[styles.value, { color: c.ink }]}>{value}</Text>
      </View>
      <Slider {...slider} />
      <View style={styles.head}>
        <Text style={[styles.sub, { color: c.inkSoft }]}>{free} free</Text>
        <Text style={[styles.sub, { color: cost ? c.ink : c.inkSoft }]}>{cost ? `up to ${dollars(cost)} a month` : 'free'}</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.page, { backgroundColor: c.chalk }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={goBack} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]}>Limits</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!saved ? (
          <ActivityIndicator color={c.pitch} style={{ marginTop: 24 }} />
        ) : (
          <>
            <Text style={[styles.note, { color: c.inkSoft }]}>
              The app stops uploads or plays when a limit is reached. Slide a limit past the free amount to keep going; Cloudflare then charges for what is actually used above free.
            </Text>
            {block('Storage', `${limits.storageGb} GB`, `${FREE_PLAN.storageGb} GB`, extra.storage, {
              value: limits.storageGb,
              min: FREE_PLAN.storageGb,
              max: 200,
              step: 5,
              onChange: (n) => setLimits({ ...limits, storageGb: n }),
            })}
            {block('Plays a month', `${limits.readMillions} million requests`, `${FREE_PLAN.readMillions} million`, extra.reads, {
              value: limits.readMillions,
              min: FREE_PLAN.readMillions,
              max: 100,
              step: 10,
              onChange: (n) => setLimits({ ...limits, readMillions: n }),
            })}
            {block('Uploads a month', `${limits.writeMillions} million requests`, `${FREE_PLAN.writeMillions} million`, extra.writes, {
              value: limits.writeMillions,
              min: FREE_PLAN.writeMillions,
              max: 20,
              step: 1,
              onChange: (n) => setLimits({ ...limits, writeMillions: n }),
            })}

            <View style={[styles.card, styles.head, { backgroundColor: c.surface, paddingVertical: 16 }]}>
              <Text style={[styles.name, { color: c.ink }]}>At most</Text>
              <Text style={[styles.value, { color: c.ink, fontSize: 20 }]}>{total ? `${dollars(total)} a month` : 'Free'}</Text>
            </View>
            <Text style={[styles.note, { color: c.inkSoft }]}>
              This is the highest it can get with these limits, if every limit is fully used. Prices are Cloudflare's, in US dollars.
            </Text>

            {error ? (
              <Pressable onPress={() => router.push('/pin')}>
                <Text style={[styles.note, { color: c.danger }]}>
                  {error} <Text style={{ color: c.pitch, fontFamily: fonts.medium }}>Set your PIN</Text>
                </Text>
              </Pressable>
            ) : null}
            {changed ? (
              <Pressable style={[styles.button, { backgroundColor: c.pitch }]} onPress={() => { setError(''); setAsking(true); }}>
                <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>Save limits</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>

      <PinPrompt
        visible={asking}
        title="Enter your PIN"
        text={total ? `To allow up to ${dollars(total)} a month.` : 'To go back to the free plan.'}
        onEntered={confirm}
        onClose={() => setAsking(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 17 },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  note: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, marginHorizontal: 4 },
  card: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  name: { fontFamily: fonts.medium, fontSize: 16 },
  value: { fontFamily: fonts.semi, fontSize: 16 },
  sub: { fontFamily: fonts.regular, fontSize: 13 },
  button: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
});
