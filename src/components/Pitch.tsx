import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

// Same pitch as pitchDiagram() in the web app: size, markings and where each
// position stands (percent of width and height, our goal at the bottom).
const W = 300;
const H = 420;
const TURF = '#3F7D4A';
const TURF_DARK = '#386F43';
const TURF_LINE = 'rgba(255,255,255,0.85)';
export const PITCH_COORDS: Record<string, { x: number; y: number }> = {
  K: { x: 50, y: 90 },
  '4': { x: 38, y: 62 },
  '3': { x: 62, y: 62 },
  '10': { x: 40, y: 40 },
  '6': { x: 60, y: 40 },
  '11': { x: 28, y: 22 },
  '7': { x: 72, y: 22 },
  '9': { x: 50, y: 9 },
};
export const FIELD_POSITIONS = ['K', '3', '4', '6', '10', '7', '11', '9'];
export const onPitch = (position: string) => position in PITCH_COORDS;

// Wide enough for the name, and never narrower than the short ones.
const labelWidth = (name: string) => Math.max(58, name.length * 5.2 + 10);

// `slots` maps a position to the name of the player standing there. With
// `onPressSpot` every position is tappable and empty ones are drawn as well.
export function Pitch({ slots, color, onPressSpot }: { slots: Record<string, string>; color: string; onPressSpot?: (position: string) => void }) {
  return (
    <Svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ aspectRatio: W / H }}>
      {Array.from({ length: 8 }, (_, i) => (
        <Rect key={i} x={0} y={(i * H) / 8} width={W} height={H / 8} fill={i % 2 === 0 ? TURF : TURF_DARK} />
      ))}
      <G fill="none" stroke={TURF_LINE} strokeWidth={2}>
        <Rect x={6} y={6} width={W - 12} height={H - 12} />
        <Line x1={6} y1={H / 2} x2={W - 6} y2={H / 2} />
        <Circle cx={W / 2} cy={H / 2} r={42} />
        <Rect x={W / 2 - 70} y={H - 70} width={140} height={64} />
        <Rect x={W / 2 - 32} y={H - 24} width={64} height={18} />
        <Rect x={W / 2 - 70} y={6} width={140} height={64} />
        <Rect x={W / 2 - 32} y={6} width={64} height={18} />
      </G>
      <Circle cx={W / 2} cy={H / 2} r={2.5} fill={TURF_LINE} />
      {FIELD_POSITIONS.filter((position) => slots[position] || onPressSpot).map((position) => {
        const cx = (PITCH_COORDS[position].x / 100) * W;
        const cy = (PITCH_COORDS[position].y / 100) * H;
        const name = slots[position];
        return (
          <G key={position} onPress={onPressSpot ? () => onPressSpot(position) : undefined}>
            {/* A generous invisible target so a thumb hits the spot. */}
            {onPressSpot ? <Rect x={cx - 30} y={cy - 20} width={60} height={60} fill="transparent" /> : null}
            <Circle
              cx={cx}
              cy={cy}
              r={16}
              fill={name ? color : 'rgba(255,255,255,0.14)'}
              stroke="#fff"
              strokeWidth={2}
              strokeDasharray={name ? undefined : [4, 3]}
            />
            <SvgText x={cx} y={cy + 5} textAnchor="middle" fontSize={13} fontWeight="800" fill="#fff">
              {position}
            </SvgText>
            {name ? (
              <>
                {/* Narrower than on the web so the two central labels don't overlap. */}
                <Rect x={cx - labelWidth(name) / 2} y={cy + 21} width={labelWidth(name)} height={17} rx={4} fill="rgba(10,14,22,0.82)" />
                <SvgText x={cx} y={cy + 33} textAnchor="middle" fontSize={9} fontWeight="700" fill="#fff">
                  {name}
                </SvgText>
              </>
            ) : null}
          </G>
        );
      })}
    </Svg>
  );
}
