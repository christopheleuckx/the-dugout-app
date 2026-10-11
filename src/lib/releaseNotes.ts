import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

// "1.0.0 (5)" in an installed build. Inside Expo Go the native numbers are
// Expo Go's own, so only the app's version from the config is shown.
export function appVersion() {
  const inExpoGo = Constants.executionEnvironment === 'storeClient';
  if (inExpoGo) return `${Constants.expoConfig?.version ?? ''} (development)`;
  const build = `${Application.nativeApplicationVersion ?? ''} (${Application.nativeBuildVersion ?? ''})`;
  // After an over-the-air update the build number stays the same, so the
  // update's date tells which one is running.
  if (!Updates.isEmbeddedLaunch && Updates.createdAt) {
    return `${build} - updated ${Updates.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  }
  return build;
}

// What's new, written for coaches. Newest release first; add a block at the
// top with every release.
export const RELEASE_NOTES: { version: string; title: string; items: { title: string; text: string }[] }[] = [
  {
    version: 'October 2026 updates',
    title: "What's new",
    items: [
      { title: 'Save a video to your phone', text: 'Coaches who are allowed to can save a video to their photo library, from the three dots next to a video.' },
      { title: 'PIN code', text: 'Set a six-digit PIN in your account details. It confirms sensitive actions, such as raising the limits of the video storage.' },
      { title: 'Manage coaches', text: 'Admins can add a coach, link them to an age group and decide what they may do, under Manage in the profile.' },
      { title: 'Upload videos from your phone', text: 'Add a video straight from your photo library to a game or a training. It is stored in the club\'s video storage and every coach can watch it.' },
      { title: 'A more detailed game report', text: 'Rate the team on five topics, from build-up to decision-making, rate how strong the opponent was, and write a match report with a game summary and notes per quarter.' },
      { title: 'Write the game report', text: 'Rate the team performance and write about the opponent, each quarter, what went well and what to improve, straight from the game.' },
      { title: 'Rate your players', text: 'Open a player in a game to give a rating from 1 to 5 and to write or change your feedback.' },
      { title: 'Edit a game', text: 'Change the opponent, date, kick-off and the other details of a game with the edit button at the top of the game.' },
      { title: 'Add and edit trainings', text: 'Add an extra training with the plus button in Trainings. Change the name, date and hours of a training, postpone it or cancel it, with the edit button at the top right.' },
      { title: 'Videos', text: 'Add videos to a game or a training, from the club\'s video storage or with a YouTube link, and watch them with your fellow coaches.' },
      { title: 'Training at a glance', text: 'Open a training to see how many players and goalkeepers are coming, and who is absent.' },
      { title: 'Training themes', text: 'Set the major and minor theme and the basics for each training.' },
      { title: 'Pitch', text: 'Every training shows where you train, Walleken D or Gemeenteplein, next to the hour.' },
      { title: 'A clearer Trainings tab', text: 'Trainings now look like the week list on Home, with the attendance on the right.' },
      { title: 'Reset with undo', text: 'Start a selection or line-up again with one tap. Changed your mind? Undo within five seconds.' },
      { title: 'Changes after 10 minutes', text: 'The list shows only what you have to act on: who comes on, who goes off and who switches position.' },
      { title: 'Playing minutes count right away', text: 'Saving a line-up confirms it, so the playing time is counted without an extra step on the web.' },
    ],
  },
  {
    version: '1.0.0',
    title: 'The first version of the app',
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
