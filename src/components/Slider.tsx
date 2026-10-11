import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

import { useColors } from '../lib/theme';

const THUMB = 28;

// A slider that moves in steps between a lowest and a highest value.
export function Slider({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  // The pan handlers are made once, so they read the latest values from here.
  const live = useRef({ width, min, max, step, onChange });
  live.current = { width, min, max, step, onChange };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => move(e.nativeEvent.locationX),
      onPanResponderMove: (e) => move(e.nativeEvent.locationX),
    }),
  ).current;

  function move(x: number) {
    const now = live.current;
    const usable = now.width - THUMB;
    if (usable <= 0) return;
    const share = Math.min(1, Math.max(0, (x - THUMB / 2) / usable));
    now.onChange(Math.round((now.min + share * (now.max - now.min)) / now.step) * now.step);
  }

  const share = max > min ? (value - min) / (max - min) : 0;
  const left = share * Math.max(0, width - THUMB);

  return (
    <View style={styles.area} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} {...pan.panHandlers}>
      <View pointerEvents="none" style={[styles.track, { backgroundColor: c.surface2 }]}>
        <View style={[styles.fill, { backgroundColor: c.pitch, width: left + THUMB / 2 }]} />
      </View>
      <View pointerEvents="none" style={[styles.thumb, { left, backgroundColor: c.surface, borderColor: c.line }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  area: { height: 40, justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6 },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#0E1320',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
