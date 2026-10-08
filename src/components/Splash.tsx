import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { fonts, useColors } from '../lib/theme';
import { Loader } from './Loader';

// Long enough for the loader's run to draw once, so the splash never just flashes by.
const MIN_VISIBLE_MS = 1400;

// The opening screen: the animated app icon exactly where the native splash
// shows the still one, with the motto underneath. It covers the app until
// `ready`, then fades out. The text waits for `fontsLoaded` so it never
// appears in the wrong typeface first.
export function Splash({ ready, fontsLoaded }: { ready: boolean; fontsLoaded: boolean }) {
  const c = useColors();
  const opacity = useRef(new Animated.Value(1)).current;
  const [waited, setWaited] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), MIN_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready || !waited) return;
    Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }).start(() => setGone(true));
  }, [ready, waited, opacity]);

  if (gone) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: c.chalk, opacity }]}>
      <Loader />
      {/* Positioned below the icon without moving it off the centre. */}
      <View style={styles.words}>
        {fontsLoaded ? (
          <>
            <Text style={[styles.name, { color: c.ink }]}>The Dugout</Text>
            <Text style={[styles.motto, { color: c.inkSoft }]}>Stay calm, be positive.</Text>
          </>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  words: { position: 'absolute', top: '50%', marginTop: 64, alignItems: 'center', gap: 4 },
  name: { fontFamily: fonts.semi, fontSize: 22 },
  motto: { fontFamily: fonts.regular, fontSize: 15 },
});
