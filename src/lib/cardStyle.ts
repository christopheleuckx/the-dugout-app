import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

// Whether this phone shows the new game cards (beta). Kept on the phone only,
// so trying them out changes nothing for other coaches, and switching back is instant.
const KEY = 'newGameCards';
let on = false;
const listeners = new Set<() => void>();

AsyncStorage.getItem(KEY).then((v) => {
  on = v === '1';
  listeners.forEach((l) => l());
});

export function setNewGameCards(next: boolean) {
  on = next;
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, next ? '1' : '0');
}

export function useNewGameCards() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => on,
  );
}
