import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

// Same Supabase project as the web app (football-hub/index.html), so both
// read and write exactly the same data. The publishable key is safe to ship
// in a client: Row Level Security only lets signed-in users through.
const SUPABASE_URL = 'https://wjmydsutslejxjxbozkt.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ZOnLTh-euOjv7qwyfgpOIQ_Ogd8DSxc';
const AUTH_EMAIL_DOMAIN = '@footballhub-app.com';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Only refresh the session token while the app is actually on screen.
AppState.addEventListener('change', (status) => {
  if (status === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

// Login is username-based in the app; auth.users holds a synthetic email
// under the hood. Must stay identical to usernameToEmail() in the web app.
export function usernameToEmail(username: string) {
  return username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '') + AUTH_EMAIL_DOMAIN;
}

export function logoUrl(path: string | null | undefined) {
  return path ? supabase.storage.from('competitor-logos').getPublicUrl(path).data.publicUrl : null;
}
