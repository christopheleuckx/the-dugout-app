import { Ionicons } from '@expo/vector-icons';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { PixelRatio, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { useData } from '../../lib/data';
import { brand, fonts, useColors } from '../../lib/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const AVATAR = 28;

// Thin outline icons, the same on iOS and Android.
const TABS: { name: string; label: string; icon: IoniconName }[] = [
  { name: 'index', label: 'Home', icon: 'home-outline' },
  { name: 'games', label: 'Games', icon: 'calendar-outline' },
  { name: 'trainings', label: 'Trainings', icon: 'barbell-outline' },
  { name: 'squad', label: 'Squad', icon: 'person-outline' },
];

// The system tab bar: floating Liquid Glass on iOS 26, Material on Android.
export default function TabsLayout() {
  const c = useColors();
  const { me } = useData();
  const initials = me ? `${me.firstName[0] ?? ''}${me.lastName[0] ?? ''}`.toUpperCase() : '';

  // A tab icon has to be an image, so the signed-in coach's initials are
  // drawn off screen once and captured as one. A profile picture can later
  // be drawn in the same circle.
  const avatarRef = useRef<View>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  useEffect(() => {
    if (!initials) return;
    captureRef(avatarRef, { format: 'png', result: 'tmpfile' }).then(setAvatarUri, () => setAvatarUri(null));
  }, [initials]);

  return (
    <>
      <View ref={avatarRef} collapsable={false} style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <NativeTabs iconColor={{ default: c.ink, selected: c.pitch }} tintColor={c.pitch} minimizeBehavior="onScrollDown">
        {TABS.map((tab) => (
          <NativeTabs.Trigger key={tab.name} name={tab.name}>
            <NativeTabs.Trigger.Icon
              src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name={tab.icon} />}
              renderingMode="template"
            />
            <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        ))}
        <NativeTabs.Trigger name="profile">
          {avatarUri ? (
            <NativeTabs.Trigger.Icon src={{ uri: avatarUri, scale: PixelRatio.get() }} renderingMode="original" />
          ) : (
            <NativeTabs.Trigger.Icon
              src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="person-circle-outline" />}
              renderingMode="template"
            />
          )}
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </>
  );
}

const styles = StyleSheet.create({
  avatar: {
    position: 'absolute',
    left: -AVATAR * 2,
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: brand.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontFamily: fonts.semi, fontSize: 12 },
});
