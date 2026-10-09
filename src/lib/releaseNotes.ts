import * as Application from 'expo-application';
import Constants from 'expo-constants';

// "1.0.0 (5)" in an installed build. Inside Expo Go the native numbers are
// Expo Go's own, so only the app's version from the config is shown.
export function appVersion() {
  const inExpoGo = Constants.executionEnvironment === 'storeClient';
  if (inExpoGo) return `${Constants.expoConfig?.version ?? ''} (development)`;
  return `${Application.nativeApplicationVersion ?? ''} (${Application.nativeBuildVersion ?? ''})`;
}

// What's new, written for coaches. Newest release first; add a block at the
// top with every release.
export const RELEASE_NOTES: { version: string; title: string; items: { title: string; text: string }[] }[] = [
  {
    version: '1.0.0',
    title: 'The first version of The Dugout on your phone',
    items: [
      { title: 'Home', text: 'Your next games, this week at a glance and the latest results, with a result per team.' },
      { title: 'Games', text: 'The whole season in one list, opening on the next game. Add a new game straight from your phone.' },
      { title: 'Game details', text: 'Score per quarter with goal scorers, the game report, player ratings and feedback, for Blue and Red.' },
      { title: 'Selection', text: 'Pick your players by line, or let the app propose a selection, with rotation and mixed teams.' },
      { title: 'Line-ups', text: 'Build a line-up per quarter on the pitch, generate one automatically, and see every player’s playing time.' },
      { title: 'Trainings', text: 'See how many trainings you have had and the average attendance, and keep attendance up to date.' },
      { title: 'Tournaments', text: 'A card of their own with wins, draws, losses, goals and your final place.' },
      { title: 'Profile', text: 'Add a profile picture and choose your team.' },
    ],
  },
];
