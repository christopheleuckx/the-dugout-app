import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { shell } from '../../lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const icon = (name: IconName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: shell.bg, borderTopColor: shell.border },
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: shell.textSoft,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="games" options={{ title: 'Games', tabBarIcon: icon('football-outline') }} />
      <Tabs.Screen name="trainings" options={{ title: 'Trainings', tabBarIcon: icon('fitness-outline') }} />
      <Tabs.Screen name="squad" options={{ title: 'Squad', tabBarIcon: icon('people-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle-outline') }} />
    </Tabs>
  );
}
