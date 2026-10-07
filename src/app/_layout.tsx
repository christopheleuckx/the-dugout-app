import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, useFonts } from '@expo-google-fonts/barlow-condensed';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';

import { AuthProvider, useAuth } from '../lib/auth';
import { DataProvider } from '../lib/data';
import { shell } from '../lib/theme';

function RootNavigator() {
  const { session, loading } = useAuth();
  const [fontsLoaded] = useFonts({ BarlowCondensed_600SemiBold, BarlowCondensed_700Bold });

  if (loading || !fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: shell.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={shell.text} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <DataProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </DataProvider>
    </AuthProvider>
  );
}
