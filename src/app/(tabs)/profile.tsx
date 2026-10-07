import { Pressable, StyleSheet, Text } from 'react-native';

import { Card, Screen } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useData } from '../../lib/data';
import { radius, useColors } from '../../lib/theme';

export default function Profile() {
  const c = useColors();
  const { signOut } = useAuth();
  const { me } = useData();

  return (
    <Screen title="Profile">
      <Card>
        <Text style={[styles.name, { color: c.ink }]}>
          {me ? `${me.firstName} ${me.lastName}`.trim() || me.username : 'Unknown user'}
        </Text>
        {me ? <Text style={{ color: c.inkSoft }}>@{me.username}</Text> : null}
        {me?.isAdmin ? <Text style={{ color: c.inkSoft }}>Admin</Text> : null}
        {me?.preferredTeam ? (
          <Text style={{ color: c.inkSoft }}>Team {me.preferredTeam === 'blue' ? 'Blue' : 'Red'}</Text>
        ) : null}
      </Card>

      <Pressable
        style={({ pressed }) => [styles.button, { borderColor: c.danger }, pressed && { opacity: 0.7 }]}
        onPress={signOut}
      >
        <Text style={{ color: c.danger, fontWeight: '700', fontSize: 16 }}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 18, fontWeight: '700' },
  button: { borderWidth: 1, borderRadius: radius, alignItems: 'center', paddingVertical: 14, marginTop: 8 },
});
