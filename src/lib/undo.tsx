import { useSyncExternalStore } from 'react';

import { UndoToast } from '../components/UndoToast';

// One undo message for the whole app, for actions that leave their screen
// (such as removing a game): the toast is drawn above every screen.
type Pending = { key: number; message: string; onUndo: () => void };
let pending: Pending | null = null;
const listeners = new Set<() => void>();

function set(next: Pending | null) {
  pending = next;
  listeners.forEach((l) => l());
}

export function showUndo(message: string, onUndo: () => void) {
  set({ key: Date.now(), message, onUndo });
}

export function UndoHost() {
  const current = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => pending,
  );
  if (!current) return null;
  return (
    <UndoToast
      key={current.key}
      message={current.message}
      onUndo={() => {
        set(null);
        current.onUndo();
      }}
      onDismiss={() => set(null)}
    />
  );
}
