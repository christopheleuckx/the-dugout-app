import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setTheme, useTheme, type ThemeName } from '../lib/appTheme';
import { useData } from '../lib/data';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';
import { goBack } from '../lib/nav';

// The club's age groups this app covers.
const AGE_GROUPS = ['U12', 'U15'];

// Account details: name and age group can be changed; the username is the
// login and stays fixed, as on the web.
export default function AccountScreen() {
  const c = useColors();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { me, refresh } = useData();
  const [firstName, setFirstName] = useState(me?.firstName ?? '');
  const [lastName, setLastName] = useState(me?.lastName ?? '');
  const [ageGroup, setAgeGroup] = useState<string | null>(me?.ageGroup ?? null);
  const [choosing, setChoosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!me) return null;
  const changed = firstName.trim() !== me.firstName || lastName.trim() !== me.lastName || ageGroup !== me.ageGroup;

  async function save() {
    if (saving) return;
    if (!firstName.trim()) {
      setError('Fill in your first name.');
      return;
    }
    setSaving(true);
    setError('');
    const saved = await supabase
      .from('profiles')
      .update({ first_name: firstName.trim(), last_name: lastName.trim(), age_group: ageGroup })
      .eq('id', me!.id);
    if (saved.error) {
      setError(`Could not save your details: ${saved.error.message}`);
      setSaving(false);
      return;
    }
    await refresh();
    goBack();
  }

  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };

  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: c.chalk }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable
          style={[styles.round, { backgroundColor: c.surface }]}
          onPress={() => (choosing ? setChoosing(false) : goBack())}
          accessibilityLabel="Back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]}>{choosing ? 'My team' : 'Account details'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {choosing ? (
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            {AGE_GROUPS.map((group, i) => (
              <Pressable
                key={group}
                style={[styles.row, i > 0 && line]}
                onPress={() => {
                  setAgeGroup(group);
                  setChoosing(false);
                }}
              >
                <Text style={[styles.label, { color: c.ink }]}>{group}</Text>
                {ageGroup === group ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
              </Pressable>
            ))}
          </View>
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <View style={styles.row}>
                <Text style={[styles.label, { color: c.ink }]}>First name</Text>
                <TextInput style={[styles.input, { color: c.ink }]} value={firstName} onChangeText={setFirstName} autoCorrect={false} />
              </View>
              <View style={[styles.row, line]}>
                <Text style={[styles.label, { color: c.ink }]}>Name</Text>
                <TextInput style={[styles.input, { color: c.ink }]} value={lastName} onChangeText={setLastName} autoCorrect={false} />
              </View>
              <View style={[styles.row, line]}>
                <Text style={[styles.label, { color: c.ink }]}>Username</Text>
                <Text style={[styles.value, { color: c.inkSoft }]}>{me.username}</Text>
              </View>
            </View>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <Pressable style={styles.row} onPress={() => router.push('/pin')}>
                <Text style={[styles.label, { color: c.ink }]}>PIN code</Text>
                <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
              </Pressable>
            </View>
            {/* The look of the app on this phone; Classic brings the current design back at once. */}
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <View style={styles.row}>
                <Text style={[styles.label, { color: c.ink }]}>Theme</Text>
                <View style={[styles.segment, { backgroundColor: c.surface2 }]}>
                  {(
                    [
                      ['classic', 'Classic'],
                      ['sport', 'Sport (beta)'],
                    ] as [ThemeName, string][]
                  ).map(([key, label]) => (
                    <Pressable
                      key={key}
                      onPress={() => setTheme(key)}
                      style={[styles.segmentItem, theme === key && { backgroundColor: c.surface }]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: theme === key }}
                    >
                      <Text style={{ color: theme === key ? c.ink : c.inkSoft, fontFamily: theme === key ? fonts.medium : fonts.regular, fontSize: 13 }}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
            <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13, marginHorizontal: 12, marginTop: -6 }}>
              Only on this phone. Sport is the new design, rolled out screen by screen.
            </Text>
            {error ? <Text style={{ color: c.danger, fontFamily: fonts.regular, fontSize: 13, marginHorizontal: 12 }}>{error}</Text> : null}
            {changed ? (
              <Pressable style={[styles.button, { backgroundColor: c.pitch }]} onPress={save}>
                {saving ? <ActivityIndicator color={c.onPitch} /> : <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>Save</Text>}
              </Pressable>
            ) : null}
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
  card: { borderRadius: 14, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, paddingVertical: 9 },
  label: { flex: 1, fontFamily: fonts.regular, fontSize: 16 },
  value: { fontFamily: fonts.regular, fontSize: 16 },
  segment: { flexDirection: 'row', borderRadius: 999, padding: 3 },
  segmentItem: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  input: { flex: 1, textAlign: 'right', fontFamily: fonts.regular, fontSize: 16, paddingVertical: 0 },
  button: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
});
