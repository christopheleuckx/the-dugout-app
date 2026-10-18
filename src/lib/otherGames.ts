import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { supabase } from './supabase';

// Whether the week list on Home also shows the games of the coach's other age
// groups (say U15 while working in U12). Kept on this phone; the profile and
// Home share it, so a change shows at once.
const KEY = 'showOtherAgeGroupGames';
let current = false;
const listeners = new Set<() => void>();

AsyncStorage.getItem(KEY)
  .then((value) => {
    current = value === '1';
    listeners.forEach((l) => l());
  })
  .catch(() => {});

export function setShowOtherGames(on: boolean) {
  current = on;
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, on ? '1' : '0').catch(() => {});
}

export function useShowOtherGames() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}

export type OtherGame = {
  id: string;
  date: string;
  time: string | null;
  opponent: string;
  homeAway: string;
  competitorId: string | null;
  cancelStatus: string | null;
  ageGroupId: string;
  ageGroup: string;
};

// Only what the week list needs; the game itself opens after switching to its age group.
export async function loadOtherGames(from: string, to: string): Promise<OtherGame[]> {
  const { data, error } = await supabase.rpc('other_age_group_games', { p_from: from, p_to: to });
  if (error || !data) return [];
  return (data as Record<string, string | null>[]).map((g) => ({
    id: g.id!,
    date: g.date!,
    time: g.kickoff ? g.kickoff.slice(0, 5) : null,
    opponent: g.opponent ?? '',
    homeAway: g.home_away ?? '',
    competitorId: g.competitor_id,
    cancelStatus: g.cancel_status,
    ageGroupId: g.age_group_id!,
    ageGroup: g.age_group ?? '',
  }));
}
