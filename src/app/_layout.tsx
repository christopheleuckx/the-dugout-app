import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, useFonts } from '@expo-google-fonts/barlow-condensed';
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { AuthProvider, useAuth } from '../lib/auth';
import { DataProvider } from '../lib/data';
import { Loader } from '../components/Loader';
import { useColors } from '../lib/theme';

function RootNavigator() {
  const c = useColors();
  const { session, loading } = useAuth();
  const [fontsLoaded] = useFonts({
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
  });

  if (loading || !fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: c.chalk, alignItems: 'center', justifyContent: 'center' }}>
        <Loader />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="game/[id]" />
        <Stack.Screen name="game-player" />
        <Stack.Screen name="game-report" />
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
        <StatusBar style="auto" />
        <RootNavigator />
      </DataProvider>
    </AuthProvider>
  );
}
