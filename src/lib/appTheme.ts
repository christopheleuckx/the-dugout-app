import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';

// The look of the app, chosen per phone in Profile. Classic is the app as it
// has been; Sport (beta) is the new design, rolled out section by section.
// Kept on the phone only, so trying it changes nothing for other coaches.
export type ThemeName = 'classic' | 'sport';

const KEY = 'appTheme';
// The first beta only had a switch for the new game cards.
const OLD_KEY = 'newGameCards';
let current: ThemeName = 'classic';
const listeners = new Set<() => void>();

(async () => {
  const saved = await AsyncStorage.getItem(KEY);
  if (saved === 'sport' || saved === 'classic') current = saved;
  else if ((await AsyncStorage.getItem(OLD_KEY)) === '1') current = 'sport';
  AsyncStorage.removeItem(OLD_KEY);
  listeners.forEach((l) => l());
})();

export function setTheme(next: ThemeName) {
  current = next;
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, next);
}

export function useTheme(): ThemeName {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

// Sport: bold italic display type, navy and violet, results in green, amber and red.
const sportLight = {
  page: '#F1F3F8',
  card: '#FFFFFF',
  border: '#E1E5EF',
  pill: '#EEF1F8',
  ink: '#0E1A3A',
  soft: '#6A7594',
  faint: '#9AA3BC',
  win: '#16A34A',
  draw: '#C98A0B',
  loss: '#DC2626',
  cup: '#0F8A7A',
  // The highlighted block (the next game), dark in both modes.
  feature: '#1F2A5C',
  featureSoft: '#C9CFF0',
  featureAccent: '#9FAEF2',
  countdown: '#C8323C',
  teamBlue: '#2E86DE',
  teamRed: '#C81E2E',
  // Games and trainings in the week list, and the tag of the age group on show.
  game: '#3B4FB8',
  training: '#1E7D82',
  ownTag: '#1F2A5C',
  onOwnTag: '#FFFFFF',
};
const sportDark: typeof sportLight = {
  page: '#0B1020',
  card: '#151C30',
  border: '#232C46',
  pill: '#1E2742',
  ink: '#F2F4FA',
  soft: '#8D97B5',
  faint: '#6E7899',
  win: '#3DD68C',
  draw: '#E7B321',
  loss: '#E5484D',
  cup: '#5FC9B8',
  feature: '#2C1F5E',
  featureSoft: '#C9CFF0',
  featureAccent: '#9FAEF2',
  countdown: '#C8323C',
  teamBlue: '#2E86DE',
  teamRed: '#C81E2E',
  game: '#9FAEF2',
  training: '#4FC4C9',
  ownTag: '#9FAEF2',
  onOwnTag: '#0B1020',
};
export type SportColors = typeof sportLight;

export const sportFonts = {
  // Names, times and scores.
  display: 'BarlowCondensed_600SemiBold_Italic',
};

export const sportShape = { card: 20, feature: 22, pill: 999 };

export function useSportColors(): SportColors {
  return useColorScheme() === 'dark' ? sportDark : sportLight;
}
