import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PIN_LENGTH } from '../lib/pin';
import { fonts, useColors } from '../lib/theme';

// Asks for the coach's six-digit PIN in a sheet, to confirm a sensitive
// action. "onEntered" gets the PIN once all six digits are typed and returns
// an error to show (the digits are cleared for another try) or nothing when
// it went through.
export function PinPrompt({
  visible,
  title,
  text,
  onEntered,
  onClose,
}: {
  visible: boolean;
  title: string;
  text?: string;
  onEntered: (pin: string) => Promise<string | void>;
  onClose: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const input = useRef<TextInput>(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setPin('');
      setError('');
      setBusy(false);
    }
  }, [visible]);

  async function change(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, PIN_LENGTH);
    setPin(digits);
    if (digits.length < PIN_LENGTH || busy) return;
    setBusy(true);
    setError('');
    const problem = await onEntered(digits).catch((e) => (e as Error).message || 'Something went wrong.');
    setBusy(false);
    if (problem) {
      setError(problem);
      setPin('');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.grabber, { backgroundColor: c.line }]} />
          <Text style={[styles.title, { color: c.ink }]}>{title}</Text>
          {text ? <Text style={[styles.text, { color: c.inkSoft }]}>{text}</Text> : null}
          <Pressable style={styles.dots} onPress={() => input.current?.focus()} accessibilityLabel="PIN">
            {Array.from({ length: PIN_LENGTH }, (_, i) => (
              <View key={i} style={[styles.dot, { borderColor: i < pin.length ? c.pitch : c.line, backgroundColor: i < pin.length ? c.pitch : 'transparent' }]} />
            ))}
          </Pressable>
          {busy ? <ActivityIndicator color={c.pitch} /> : <Text style={[styles.text, { color: c.danger, minHeight: 20 }]}>{error}</Text>}
          <TextInput
            ref={input}
            style={styles.hidden}
            value={pin}
            onChangeText={change}
            keyboardType="number-pad"
            maxLength={PIN_LENGTH}
            autoFocus
            secureTextEntry
            caretHidden
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 8,
    alignItems: 'center',
    shadowColor: '#0E1320',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  grabber: { width: 36, height: 4, borderRadius: 2, marginBottom: 8 },
  title: { fontFamily: fonts.medium, fontSize: 18 },
  text: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 14, paddingVertical: 16 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5 },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
