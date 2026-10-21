import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AgeGroup } from './data';
import { supabase } from './supabase';

// Per age group: whether its trainings and its games show in the week list on
// Home, next to those of the age group on show. Kept on the coach's account.
export type WeekChoice = { trainings: boolean; games: boolean };
export type WeekChoices = Record<string, WeekChoice>;

export async function setWeekChoice(groupId: string, choice: WeekChoice) {
  return supabase.rpc('set_week_age_group', { p_group: groupId, p_trainings: choice.trainings, p_games: choice.games });
}

// Before, "Show … matches" was one switch kept on the phone. When it was on and
// nothing is chosen on the account yet, the games of the other age groups are
// switched on once, so nothing disappears from This week.
const OLD_KEY = 'showOtherAgeGroupGames';
export async function carryOverOldSwitch(choices: WeekChoices, groups: AgeGroup[], activeId: string | undefined) {
  try {
    if ((await AsyncStorage.getItem(OLD_KEY)) !== '1') return false;
    await AsyncStorage.removeItem(OLD_KEY);
    if (Object.keys(choices).length) return false;
    const others = groups.filter((g) => g.id !== activeId);
    await Promise.all(others.map((g) => setWeekChoice(g.id, { trainings: false, games: true })));
    return others.length > 0;
  } catch {
    return false;
  }
}

export type OtherItem = {
  kind: 'game' | 'training';
  id: string;
  date: string;
  time: string | null;
  // The opponent of a game, the name of a training.
  title: string;
  homeAway: string;
  location: string;
  competitorId: string | null;
  cancelStatus: string | null;
  ageGroupId: string;
  ageGroup: string;
};

// Only what the week list needs; a game or training opens after switching to its age group.
export async function loadOtherItems(from: string, to: string): Promise<OtherItem[]> {
  const { data, error } = await supabase.rpc('week_age_group_items', { p_from: from, p_to: to });
  if (error || !data) return [];
  return (data as Record<string, string | null>[]).map((x) => ({
    kind: x.kind === 'training' ? 'training' : 'game',
    id: x.id!,
    date: x.date!,
    time: x.start_time ? x.start_time.slice(0, 5) : null,
    title: x.title ?? '',
    homeAway: x.home_away ?? '',
    location: x.location ?? '',
    competitorId: x.competitor_id,
    cancelStatus: x.cancel_status,
    ageGroupId: x.age_group_id!,
    ageGroup: x.age_group ?? '',
  }));
}
