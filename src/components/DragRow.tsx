import { Ionicons } from '@expo/vector-icons';
import { useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';

const ROW = 54;

// A row that is picked up by its handle. While it is held it follows the
// finger; on release the page decides what the drop means.
export function DragRow({
  children,
  onStart,
  onDrop,
  background,
  handleColor,
}: {
  children: ReactNode;
  onStart: () => void;
  onDrop: (dy: number, pageY: number) => void;
  background: string;
  handleColor: string;
}) {
  const move = useRef(new Animated.Value(0)).current;
  const [held, setHeld] = useState(false);
  // The latest callbacks, so the gesture never works with an old list.
  const latest = useRef({ onStart, onDrop });
  latest.current = { onStart, onDrop };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setHeld(true);
        latest.current.onStart();
      },
      onPanResponderMove: (_, g) => move.setValue(g.dy),
      onPanResponderRelease: (_, g) => {
        setHeld(false);
        move.setValue(0);
        latest.current.onDrop(g.dy, g.moveY);
      },
      onPanResponderTerminate: () => {
        setHeld(false);
        move.setValue(0);
        latest.current.onDrop(0, -1);
      },
    }),
  ).current;

  return (
    <Animated.View
      style={[
        styles.dragRow,
        { backgroundColor: background, transform: [{ translateY: move }] },
        held && styles.held,
      ]}
    >
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>{children}</View>
      <View {...pan.panHandlers} style={styles.handle} accessibilityLabel="Drag">
        <Ionicons name="reorder-three" size={24} color={handleColor} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dragRow: { height: ROW, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, borderRadius: 14 },
  handle: { width: 56, height: ROW, alignItems: 'center', justifyContent: 'center' },
  held: { zIndex: 5, shadowColor: '#0E1320', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
});
