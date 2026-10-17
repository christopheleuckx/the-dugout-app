import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, useFonts } from '@expo-google-fonts/barlow-condensed';
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import { Stack } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { AuthProvider, useAuth } from '../lib/auth';
import { DataProvider, useData } from '../lib/data';
import { Splash } from '../components/Splash';
import { useColors } from '../lib/theme';
import { UndoHost } from '../lib/undo';

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
        <Stack.Screen name="game-scores" />
        <Stack.Screen name="game-lineups" />
        <Stack.Screen name="game-new" />
        <Stack.Screen name="game-selection" />
        <Stack.Screen name="game-lineup-edit" />
        <Stack.Screen name="training/[id]" />
        <Stack.Screen name="training-edit" />
        <Stack.Screen name="video-analysis" />
        <Stack.Screen name="video-add" />
        <Stack.Screen name="video-player" options={{ animation: 'fade' }} />
        <Stack.Screen name="cloudflare" />
        <Stack.Screen name="manage" />
        <Stack.Screen name="opponents" />
        <Stack.Screen name="supabase-usage" />
        <Stack.Screen name="pin" />
        <Stack.Screen name="video-limits" />
        <Stack.Screen name="account" />
        <Stack.Screen name="about" />
        <Stack.Screen name="tour" options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
      ) : null}
      <UndoHost />
      <Splash ready={ready} fontsLoaded={fontsLoaded} />
    </View>
  );
}

// The app is upright everywhere; only the video player lets the phone turn.
ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});

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
