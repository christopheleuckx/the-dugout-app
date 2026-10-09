import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, useFonts } from '@expo-google-fonts/barlow-condensed';
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { AuthProvider, useAuth } from '../lib/auth';
import { DataProvider, useData } from '../lib/data';
import { Splash } from '../components/Splash';
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

  const data = useData();
  const booted = !loading && fontsLoaded;
  // The splash stays until the first screen has something to show: the
  // sign-in screen, or the tabs with their data.
  const ready = booted && (!session || !data.loading);

  return (
    <View style={{ flex: 1, backgroundColor: c.chalk }}>
      {booted ? (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="game/[id]" />
        <Stack.Screen name="game-player" />
        <Stack.Screen name="game-report" />
        <Stack.Screen name="game-lineups" />
        <Stack.Screen name="game-new" />
        <Stack.Screen name="game-selection" />
        <Stack.Screen name="game-lineup-edit" />
        <Stack.Screen name="training/[id]" />
        <Stack.Screen name="account" />
        <Stack.Screen name="about" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
      ) : null}
      <Splash ready={ready} fontsLoaded={fontsLoaded} />
    </View>
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
