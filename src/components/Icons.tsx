import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type Props = { size?: number; color: ColorValue };

const stroke = { fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

// The app's edit icon: a pencil over a sheet.
export function EditIcon({ size = 19, color }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" />
      <Path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415" />
      <Path d="M16 5l3 3" />
    </Svg>
  );
}

// Two opposite arrows: this can be switched.
export function SwitchIcon({ size = 13, color }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Path d="M7 10h14l-4 -4" />
      <Path d="M17 14h-14l4 4" />
    </Svg>
  );
}
