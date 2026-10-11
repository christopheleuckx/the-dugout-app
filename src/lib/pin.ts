import { supabase } from './supabase';

// The six-digit PIN a coach sets in their account, to confirm sensitive
// actions. The server keeps only a scrambled form of it and answers with a
// short code: ok, wrong, locked (too many wrong attempts), none (no PIN yet)
// or invalid (not six digits).
export type PinAnswer = 'ok' | 'wrong' | 'locked' | 'none' | 'invalid' | 'forbidden';

export const PIN_LENGTH = 6;

export async function hasPin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_pin');
  if (error) throw new Error(error.message);
  return !!data;
}

export async function setPin(next: string, current?: string): Promise<PinAnswer> {
  const { data, error } = await supabase.rpc('set_pin', { p_new: next, p_current: current ?? null });
  if (error) throw new Error(error.message);
  return data as PinAnswer;
}

// What to tell the coach when the server did not answer "ok".
export function pinMessage(answer: PinAnswer) {
  switch (answer) {
    case 'wrong':
      return 'That PIN is not right. Try again.';
    case 'locked':
      return 'Too many wrong attempts. Try again in 15 minutes.';
    case 'none':
      return 'Set a PIN in your account details first.';
    case 'invalid':
      return 'A PIN is six digits.';
    case 'forbidden':
      return 'Only an admin can do this.';
    default:
      return '';
  }
}
