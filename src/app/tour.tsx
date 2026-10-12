import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type LayoutRectangle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useData } from '../lib/data';
import { goBack } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { fonts } from '../lib/theme';
import { TOUR_VERSION, tourSlidesFor, type TourBlock } from '../lib/tour';

const NAVY = '#0C1F4A';
const DIM = 'rgba(12,31,74,0.62)';
// How long each part of a small screen stays pointed out.
const STEP_MS = 2600;
const PAD = 10;

// A small screen of the app. While it is the slide on show, a frame steps
// from one pointed-out part to the next, dimming the rest and scrolling the
// screen along; after the last part it moves on to the next scene, if any.
function MiniScreen({ scenes, active, width, height }: { scenes: TourBlock[][]; active: boolean; width: number; height: number }) {
  const [scene, setScene] = useState(0);
  const [step, setStep] = useState(0);
  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>({});
  const [contentHeight, setContentHeight] = useState(0);
  const top = useRef(new Animated.Value(0)).current;
  const size = useRef(new Animated.Value(0)).current;
  const scroll = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  const blocks = scenes[scene];
  const spots = blocks.filter((b) => b.spot);
  const spot = spots[step % spots.length];
  const target = spot ? layouts[`${scene}:${spot.key}`] : undefined;

  // Back to the start whenever the slide comes on show.
  useEffect(() => {
    setScene(0);
    setStep(0);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setStep((now) => {
        if (now + 1 < spots.length || scenes.length === 1) return (now + 1) % spots.length;
        // The last part of this scene: fade to the next one.
        Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: false }).start(() => {
          setScene((s) => (s + 1) % scenes.length);
          Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: false }).start();
        });
        return 0;
      });
    }, STEP_MS);
    return () => clearInterval(timer);
  }, [active, spots.length, scenes.length, fade]);

  // The part's own place on the screen decides where the frame goes, and how
  // far the screen has to scroll to show it.
  const y = target?.y ?? 0;
  const h = target?.height ?? 0;
  const offset = target ? Math.round(Math.min(Math.max(0, contentHeight - height), Math.max(0, y + h / 2 - height / 2 + 20))) : 0;
  useEffect(() => {
    if (!target) return;
    const to = (value: Animated.Value, toValue: number) =>
      Animated.timing(value, { toValue, duration: 550, easing: Easing.inOut(Easing.ease), useNativeDriver: false });
    Animated.parallel([to(top, y - offset - 4), to(size, h + 8), to(scroll, -offset)]).start();
  }, [target, y, h, offset, top, size, scroll]);

  const below = y - offset + h + 12;
  const tipTop = below + 44 < height ? below : Math.max(6, y - offset - 50);

  return (
    <View style={[styles.frame, { width, height }]}>
      <Animated.View
        style={{ padding: PAD, paddingBottom: 16, gap: 8, opacity: fade, transform: [{ translateY: scroll }] }}
        onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
      >
        {blocks.map((block) => (
          <View
            key={`${scene}:${block.key}`}
            style={block.joined ? { marginTop: -8 } : undefined}
            onLayout={(e) => {
              const layout = e.nativeEvent.layout;
              setLayouts((all) => ({ ...all, [`${scene}:${block.key}`]: layout }));
            }}
          >
            {block.node}
          </View>
        ))}
      </Animated.View>

      {target ? (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]} pointerEvents="none">
          {/* Four dark panes around the frame leave the pointed-out part clear. */}
          <Animated.View style={[styles.dim, { top: 0, left: 0, right: 0, height: top }]} />
          <Animated.View style={[styles.dim, { top: Animated.add(top, size), left: 0, right: 0, bottom: 0 }]} />
          <Animated.View style={[styles.dim, { top, left: 0, width: PAD - 4, height: size }]} />
          <Animated.View style={[styles.dim, { top, right: 0, width: PAD - 4, height: size }]} />
          <Animated.View style={[styles.ring, { top, left: PAD - 4, right: PAD - 4, height: size }]} />
          <View style={[styles.tip, { top: tipTop }]}>
            <Text style={styles.tipText}>{spot?.spot}</Text>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

// The walkthrough: one slide per part of the app, swiped or stepped through
// with Next. Shown by itself the first time, and again with only the new
// slides after an update; "all" replays everything from About this version.
export default function TourScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{ all?: string }>();
  const { me, refresh } = useData();
  const seen = me?.tourSeen ?? 0;
  // Decided once, so the slides don't change while going through them.
  const slides = useMemo(() => tourSlidesFor(seen, params.all === '1'), []); // eslint-disable-line react-hooks/exhaustive-deps
  const onlyNew = params.all !== '1' && seen > 0;
  const pager = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const last = index === slides.length - 1;

  // The small screen takes the room that is really left between the dots and
  // the buttons, minus the lines of text under it, so Next and Skip always fit.
  const [room, setRoom] = useState(height - insets.top - insets.bottom - 190);
  const frameWidth = Math.min(310, width - 72);
  const frameHeight = Math.max(200, Math.min(460, room - 132));

  // Leaving, by the last button or by Skip, counts as having seen it.
  async function close() {
    if (me && me.tourSeen < TOUR_VERSION) {
      await supabase.from('profiles').update({ tour_seen: TOUR_VERSION }).eq('id', me.id);
      refresh();
    }
    goBack();
  }

  function next() {
    if (last) close();
    else pager.current?.scrollTo({ x: (index + 1) * width, animated: true });
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top + 2, paddingBottom: Math.max(insets.bottom, 12) }]}>
      <StatusBar style="light" />
      <Text style={styles.counter}>
        {index + 1} of {slides.length}
      </Text>
      <View style={styles.dots}>
        {slides.map((slide, i) => (
          <View key={slide.title} style={[styles.dot, i === index && styles.dotOn]} />
        ))}
      </View>

      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        scrollEventThrottle={32}
        style={{ flex: 1 }}
        onLayout={(e) => setRoom(e.nativeEvent.layout.height)}
      >
        {slides.map((slide, i) => (
          <View key={slide.title} style={{ width, paddingHorizontal: 24 }}>
            <View style={{ alignItems: 'center' }}>
              <MiniScreen scenes={slide.scenes} active={i === index} width={frameWidth} height={frameHeight} />
            </View>
            {onlyNew ? (
              <View style={styles.newTag}>
                <Text style={styles.newText}>New</Text>
              </View>
            ) : null}
            <Text style={[styles.title, onlyNew && { marginTop: 8 }]} maxFontSizeMultiplier={1.15} numberOfLines={2}>{slide.title}</Text>
            <Text style={styles.text} maxFontSizeMultiplier={1.15} numberOfLines={3}>
              {slide.text}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: 24 }}>
        <Pressable style={({ pressed }) => [styles.next, pressed && { opacity: 0.85 }]} onPress={next}>
          <Text style={styles.nextText} maxFontSizeMultiplier={1.15}>{last ? 'Get started' : 'Next'}</Text>
        </Pressable>
        <Pressable style={styles.skip} onPress={close} disabled={last} hitSlop={6}>
          <Text style={[styles.skipText, last && { opacity: 0 }]} maxFontSizeMultiplier={1.15}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: NAVY },
  counter: { color: '#B5C7EA', fontFamily: fonts.regular, fontSize: 13, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 6, marginBottom: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2F4C8C' },
  dotOn: { width: 20, backgroundColor: '#fff' },
  frame: { backgroundColor: '#F3F5F9', borderRadius: 20, overflow: 'hidden' },
  dim: { position: 'absolute', backgroundColor: DIM },
  ring: { position: 'absolute', borderWidth: 2, borderColor: '#fff', borderRadius: 12 },
  tip: { position: 'absolute', left: 8, right: 8, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10 },
  tipText: { color: NAVY, fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  newTag: { alignSelf: 'flex-start', backgroundColor: '#C81E2E', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, marginTop: 16 },
  newText: { color: '#fff', fontFamily: fonts.medium, fontSize: 12 },
  title: { color: '#fff', fontFamily: fonts.semi, fontSize: 22, lineHeight: 27, marginTop: 14 },
  text: { color: '#C9D6F0', fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, marginTop: 4 },
  next: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  nextText: { color: NAVY, fontFamily: fonts.semi, fontSize: 16 },
  skip: { alignItems: 'center', paddingTop: 12, paddingBottom: 6 },
  skipText: { color: '#B5C7EA', fontFamily: fonts.regular, fontSize: 15 },
});
