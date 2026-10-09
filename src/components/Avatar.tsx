import { Image, Text, View } from 'react-native';

import type { Profile } from '../lib/data';
import { brand, fonts } from '../lib/theme';

// A coach's profile picture, or their initials on navy when they have none.
export function Avatar({ profile, size }: { profile: Profile | null; size: number }) {
  const initials = profile ? `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`.toUpperCase() : '';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: brand.navy,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {profile?.avatarUrl ? (
        <Image source={{ uri: profile.avatarUrl }} style={{ width: size, height: size }} />
      ) : (
        <Text style={{ color: '#fff', fontFamily: fonts.semi, fontSize: size * 0.36 }}>{initials}</Text>
      )}
    </View>
  );
}
