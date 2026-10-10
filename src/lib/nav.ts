import { router } from 'expo-router';

// Back to the previous screen. A screen opened directly by a link has no
// previous screen, so it goes to Home instead of doing nothing.
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
