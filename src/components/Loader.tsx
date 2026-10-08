import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

// Same colours and drawing as the app icon (design/build-icons.mjs).
const NAVY = '#14306B';
const BAND = '#1B3C82';
const RED = '#F2545F';
// Length of the run's curve, a little over so the dash fully hides it.
const RUN_LENGTH = 520;

// The app icon as a loader: the run draws itself around the opponent, over and over.
export function Loader({ size = 88 }: { size?: number }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(t, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  // Draw the run, show the arrow head, hold, then fade both out before the next lap.
  const dashoffset = t.interpolate({ inputRange: [0, 0.55, 1], outputRange: [RUN_LENGTH, 0, 0] });
  const runOpacity = t.interpolate({ inputRange: [0, 0.05, 0.85, 1], outputRange: [0, 1, 1, 0] });
  const headOpacity = t.interpolate({ inputRange: [0, 0.5, 0.6, 0.85, 1], outputRange: [0, 0, 1, 1, 0] });

  return (
    <View
      style={{ width: size, height: size, borderRadius: size * 0.23, overflow: 'hidden' }}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    >
      <Svg width={size} height={size} viewBox="0 0 1024 1024">
        <Rect width={1024} height={1024} fill={NAVY} />
        {[0, 256, 512, 768].map((y) => (
          <Rect key={y} y={y} width={1024} height={128} fill={BAND} />
        ))}
        <G fill="none" stroke="#FFFFFF" strokeOpacity={0.28} strokeWidth={20}>
          <Line x1={0} y1={512} x2={1024} y2={512} />
          <Circle cx={512} cy={512} r={330} />
        </G>
        <G stroke={RED} strokeWidth={64} strokeLinecap="round">
          <Line x1={300} y1={210} x2={440} y2={350} />
          <Line x1={440} y1={210} x2={300} y2={350} />
        </G>
        <Circle cx={290} cy={730} r={92} fill="none" stroke="#FFFFFF" strokeWidth={64} />
        <AnimatedPath
          d="M 500 740 C 680 730 780 570 722 352"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={64}
          strokeLinecap="round"
          strokeDasharray={[RUN_LENGTH, RUN_LENGTH]}
          strokeDashoffset={dashoffset}
          opacity={runOpacity}
        />
        <AnimatedG opacity={headOpacity}>
          <Path
            d="M 640 452 L 722 352 L 836 414"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={64}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </AnimatedG>
      </Svg>
    </View>
  );
}
