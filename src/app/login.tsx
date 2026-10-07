import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../lib/auth';
import { fonts, radius, shell } from '../lib/theme';

export default function Login() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!username.trim() || !password || pending) return;
    setPending(true);
    // On success the root layout swaps this screen for the tabs by itself.
    const message = await signIn(username, password);
    setError(message ?? '');
    setPending(false);
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.form}>
        <Text style={styles.brand}>The Dugout</Text>
        <Text style={styles.sub}>Sign in with your Dugout account</Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor={shell.textSoft}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          returnKeyType="next"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={shell.textSoft}
          secureTextEntry
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]} onPress={submit}>
          {pending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: shell.bg, justifyContent: 'center' },
  form: { paddingHorizontal: 24, gap: 12 },
  brand: { color: shell.text, fontFamily: fonts.display, fontSize: 48, textTransform: 'uppercase' },
  sub: { color: shell.textSoft, marginBottom: 12 },
  input: {
    backgroundColor: shell.bg2,
    borderColor: shell.border,
    borderWidth: 1,
    borderRadius: radius,
    color: shell.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  error: { color: '#D97A72' },
  button: {
    backgroundColor: shell.active,
    borderRadius: radius,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
