import { Ionicons } from '@expo/vector-icons';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import type { ComponentProps } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useColors } from '../../lib/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// The system tab bar: floating Liquid Glass on iOS 26, Material on Android.
// SF Symbols are used on iOS; the Ionicon is the Android fallback.
const TABS: { name: string; label: string; sf: SFSymbol; sfSelected: SFSymbol; ion: IoniconName }[] = [
  { name: 'index', label: 'Home', sf: 'house', sfSelected: 'house.fill', ion: 'home-outline' },
  { name: 'games', label: 'Games', sf: 'soccerball', sfSelected: 'soccerball', ion: 'football-outline' },
  { name: 'trainings', label: 'Trainings', sf: 'figure.run', sfSelected: 'figure.run', ion: 'fitness-outline' },
  { name: 'squad', label: 'Squad', sf: 'person.3', sfSelected: 'person.3.fill', ion: 'people-outline' },
  { name: 'profile', label: 'Profile', sf: 'person.crop.circle', sfSelected: 'person.crop.circle.fill', ion: 'person-circle-outline' },
];

export default function TabsLayout() {
  const c = useColors();

  return (
    <NativeTabs tintColor={c.pitch} minimizeBehavior="onScrollDown">
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Icon
            sf={{ default: tab.sf, selected: tab.sfSelected }}
            src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name={tab.ion} />}
          />
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
