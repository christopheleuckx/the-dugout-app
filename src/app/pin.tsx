import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { goBack } from '../lib/nav';
import { hasPin, PIN_LENGTH, pinMessage, setPin } from '../lib/pin';
import { fonts, useColors } from '../lib/theme';

// Set the six-digit PIN that confirms sensitive actions, or change it by
// giving the current one first.
export default function PinScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [exists, setExists] = useState<boolean | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    hasPin().then(setExists, (e) => {
      setExists(false);
      setError(`Could not check your PIN: ${(e as Error).message}`);
    });
  }, []);

  async function save() {
    if (saving) return;
    if (exists && current.length !== PIN_LENGTH) return setError('Enter your current PIN.');
    if (next.length !== PIN_LENGTH) return setError('Choose a PIN of six digits.');
    if (next !== again) return setError('The two new PINs are not the same.');
    setSaving(true);
    setError('');
    try {
      const answer = await setPin(next, exists ? current : undefined);
      if (answer === 'ok') return goBack();
      setError(answer === 'wrong' ? 'Your current PIN is not right.' : pinMessage(answer));
      setCurrent('');
    } catch (e) {
      setError(`Could not save the PIN: ${(e as Error).message}`);
    }
    setSaving(false);
  }

  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };
  const field = (label: string, value: string, set: (v: string) => void, first = false) => (
    <View style={[styles.row, !first && line]}>
      <Text style={[styles.label, { color: c.ink }]}>{label}</Text>
      <TextInput
        style={[styles.input, { color: c.ink }]}
        value={value}
        onChangeText={(v) => set(v.replace(/\D/g, '').slice(0, PIN_LENGTH))}
        keyboardType="number-pad"
        maxLength={PIN_LENGTH}
        secureTextEntry
        placeholder="6 digits"
        placeholderTextColor={c.inkSoft}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: c.chalk }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={goBack} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]}>PIN code</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {exists === null ? (
          <ActivityIndicator color={c.pitch} style={{ marginTop: 24 }} />
        ) : (
          <>
            <Text style={[styles.note, { color: c.inkSoft }]}>
              {exists
                ? 'Your PIN confirms sensitive actions, such as raising the limits of the video storage.'
                : 'Choose a PIN of six digits. You will be asked for it to confirm sensitive actions, such as raising the limits of the video storage.'}
            </Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              {exists ? field('Current PIN', current, setCurrent, true) : null}
              {field('New PIN', next, setNext, !exists)}
              {field('Repeat new PIN', again, setAgain)}
            </View>
            {error ? <Text style={[styles.note, { color: c.danger }]}>{error}</Text> : null}
            <Pressable style={[styles.button, { backgroundColor: c.pitch }]} onPress={save}>
              {saving ? <ActivityIndicator color={c.onPitch} /> : <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>{exists ? 'Change PIN' : 'Set PIN'}</Text>}
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 17 },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  note: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, marginHorizontal: 12 },
  card: { borderRadius: 14, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, paddingVertical: 9 },
  label: { flex: 1, fontFamily: fonts.regular, fontSize: 16 },
  input: { flex: 1, textAlign: 'right', fontFamily: fonts.regular, fontSize: 16, paddingVertical: 0 },
  button: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
});
