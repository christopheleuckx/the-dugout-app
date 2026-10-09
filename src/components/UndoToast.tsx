import { useEffect, useRef } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts } from '../lib/theme';

const VISIBLE_MS = 5000;

// A message at the top of the screen with an Undo button. It leaves by
// itself after five seconds, or when swiped away (up or sideways).
export function UndoToast({ message, onUndo, onDismiss }: { message: string; onUndo: () => void; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  const enter = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.ValueXY()).current;
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useEffect(() => {
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
    const timer = setTimeout(() => {
      Animated.timing(enter, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => dismiss.current());
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [enter]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 || g.dy < -6,
      // Follows the finger sideways and upwards, never down into the page.
      onPanResponderMove: (_, g) => drag.setValue({ x: g.dx, y: Math.min(0, g.dy) }),
      onPanResponderRelease: (_, g) => {
        const away = Math.abs(g.dx) > 80 || g.dy < -30;
        if (!away) return Animated.spring(drag, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
        const to = Math.abs(g.dx) > 80 ? { x: Math.sign(g.dx) * 500, y: 0 } : { x: 0, y: -200 };
        Animated.timing(drag, { toValue: to, duration: 160, useNativeDriver: true }).start(() => dismiss.current());
      },
    }),
  ).current;

  return (
    <Animated.View
      {...pan.panHandlers}
      accessibilityRole="alert"
      style={[
        styles.toast,
        {
          top: insets.top + 8,
          opacity: enter,
          transform: [
            { translateY: Animated.add(enter.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }), drag.y) },
            { translateX: drag.x },
          ],
        },
      ]}
    >
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
      <Pressable onPress={onUndo} hitSlop={10} accessibilityRole="button">
        <Text style={styles.undo}>Undo</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#131A26',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#0E1320',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  message: { flex: 1, color: '#fff', fontFamily: fonts.regular, fontSize: 15 },
  undo: { color: '#9CC0FF', fontFamily: fonts.semi, fontSize: 15 },
});
