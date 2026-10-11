import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '../components/Avatar';
import { useData, type Profile } from '../lib/data';
import { goBack } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';

// The club's age groups this app covers.
const AGE_GROUPS = ['U12', 'U15'];

// A coach's account as the admin manages it.
type Coach = Profile & { flags: Record<string, unknown> };

// For admins: the coaches who can sign in. Add a coach, link them to an age
// group, and decide whether they may save videos to their phone.
export default function ManageScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { me, refresh } = useData();
  const [coaches, setCoaches] = useState<Coach[] | null>(null);
  // The coach being changed, or "new" for the form to add one.
  const [open, setOpen] = useState<Coach | 'new' | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [ageGroup, setAgeGroup] = useState<string | null>(null);
  const [saveVideos, setSaveVideos] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: failed } = await supabase
      .from('profiles')
      .select('id, username, first_name, last_name, is_admin, is_lead_admin, preferred_team, age_group, avatar_path, feature_flags')
      .order('first_name');
    if (failed) {
      setError(`Could not load the coaches: ${failed.message}`);
      setCoaches([]);
      return;
    }
    setCoaches(
      (data ?? []).map((p) => ({
        id: p.id,
        username: p.username,
        firstName: p.first_name,
        lastName: p.last_name,
        isAdmin: p.is_admin,
        isLeadAdmin: !!p.is_lead_admin,
        preferredTeam: p.preferred_team ?? null,
        ageGroup: p.age_group ?? null,
        avatarPath: p.avatar_path ?? null,
        avatarUrl: p.avatar_path ? supabase.storage.from('avatars').getPublicUrl(p.avatar_path).data.publicUrl : null,
        canSaveVideos: p.is_admin || !!p.feature_flags?.saveVideos,
        flags: p.feature_flags ?? {},
      })),
    );
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  function show(coach: Coach | 'new') {
    const existing = coach === 'new' ? null : coach;
    setFirstName(existing?.firstName ?? '');
    setLastName(existing?.lastName ?? '');
    setUsername(existing?.username ?? '');
    setPassword('');
    setAgeGroup(existing?.ageGroup ?? null);
    setSaveVideos(existing ? existing.canSaveVideos : false);
    setError('');
    setOpen(coach);
  }

  async function save() {
    if (saving || !open) return;
    if (!firstName.trim()) return setError('Fill in the first name.');
    setSaving(true);
    setError('');
    try {
      let id = open === 'new' ? '' : open.id;
      if (open === 'new') {
        if (!/^[A-Za-z0-9._-]{3,}$/.test(username.trim())) throw new Error('Choose a username of at least 3 letters or numbers, without spaces.');
        if (password.length < 8) throw new Error('Choose a password of at least 8 characters.');
        const made = await supabase.functions.invoke('create-user', {
          body: { username: username.trim(), password, firstName: firstName.trim(), lastName: lastName.trim() },
        });
        // A refusal still carries the server's own explanation.
        const reason = made.data?.error ?? (await (made.error as { context?: Response } | null)?.context?.json?.().catch(() => null))?.error;
        if (reason || made.error || !made.data?.id) throw new Error(reason ?? 'The account could not be created.');
        id = made.data.id;
      }
      // Permissions are only sent when they change: the database lets only
      // the lead admin change them.
      const before = open === 'new' ? false : !!open.flags.saveVideos;
      const flags = saveVideos !== before ? { feature_flags: { ...(open === 'new' ? {} : open.flags), saveVideos } } : {};
      const saved = await supabase
        .from('profiles')
        .update({ first_name: firstName.trim(), last_name: lastName.trim(), age_group: ageGroup, ...flags })
        .eq('id', id);
      if (saved.error) throw new Error(saved.error.message);
      await load();
      if (id === me?.id) await refresh();
      setOpen(null);
    } catch (e) {
      setError(`Could not save: ${(e as Error).message}`);
    }
    setSaving(false);
  }

  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };
  const isNew = open === 'new';
  const admin = open !== null && open !== 'new' && open.isAdmin;
  const field = (label: string, value: string, set: (v: string) => void, props: object = {}, first = false) => (
    <View style={[styles.row, !first && line]}>
      <Text style={[styles.label, { color: c.ink }]}>{label}</Text>
      <TextInput style={[styles.input, { color: c.ink }]} value={value} onChangeText={set} autoCorrect={false} placeholderTextColor={c.inkSoft} {...props} />
    </View>
  );

  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: c.chalk }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={() => (open ? setOpen(null) : goBack())} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]}>{isNew ? 'New coach' : open ? `${open.firstName} ${open.lastName}`.trim() : 'Manage'}</Text>
        {open ? (
          <View style={{ width: 36 }} />
        ) : (
          <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={() => show('new')} accessibilityLabel="New coach" hitSlop={8}>
            <Ionicons name="add" size={22} color={c.ink} />
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {open ? (
          <>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              {field('First name', firstName, setFirstName, {}, true)}
              {field('Name', lastName, setLastName)}
              {isNew ? (
                <>
                  {field('Username', username, setUsername, { autoCapitalize: 'none', placeholder: 'Coach_Name' })}
                  {field('Password', password, setPassword, { autoCapitalize: 'none', placeholder: 'At least 8 characters' })}
                </>
              ) : (
                <View style={[styles.row, line]}>
                  <Text style={[styles.label, { color: c.ink }]}>Username</Text>
                  <Text style={[styles.value, { color: c.inkSoft }]}>{username}</Text>
                </View>
              )}
            </View>
            {isNew ? (
              <Text style={[styles.note, { color: c.inkSoft }]}>Give the username and password to the coach yourself; they sign in with them.</Text>
            ) : null}

            <Text style={[styles.caption, { color: c.inkSoft }]}>Age group</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              {[...AGE_GROUPS, null].map((group, i) => (
                <Pressable key={group ?? 'none'} style={[styles.row, i > 0 && line]} onPress={() => setAgeGroup(group)}>
                  <Text style={[styles.label, { color: c.ink }]}>{group ?? 'None'}</Text>
                  {ageGroup === group ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
                </Pressable>
              ))}
            </View>

            <Text style={[styles.caption, { color: c.inkSoft }]}>Videos</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <Pressable style={styles.row} onPress={() => !admin && me?.isLeadAdmin && setSaveVideos(!saveVideos)} accessibilityRole="switch" accessibilityState={{ checked: saveVideos }}>
                <Text style={[styles.label, { color: c.ink }]}>May save videos to their phone</Text>
                <Switch value={saveVideos} onValueChange={setSaveVideos} disabled={admin || !me?.isLeadAdmin} trackColor={{ true: c.pitch }} />
              </Pressable>
            </View>
            <Text style={[styles.note, { color: c.inkSoft }]}>
              {admin
                ? 'Admins can always save videos.'
                : !me?.isLeadAdmin
                  ? 'Only the lead admin can change this.'
                : 'A saved video is a copy on the coach\'s own phone. It stays there when you remove the video or the coach later.'}
            </Text>

            {error ? <Text style={[styles.note, { color: c.danger }]}>{error}</Text> : null}
            <Pressable style={[styles.button, { backgroundColor: c.pitch }]} onPress={save}>
              {saving ? <ActivityIndicator color={c.onPitch} /> : <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>{isNew ? 'Create coach' : 'Save'}</Text>}
            </Pressable>
          </>
        ) : coaches === null ? (
          <ActivityIndicator color={c.pitch} style={{ marginTop: 24 }} />
        ) : (
          <>
            {error ? <Text style={[styles.note, { color: c.danger }]}>{error}</Text> : null}
            <Text style={[styles.section, { color: c.ink }]}>Coaches</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              {coaches.map((coach, i) => (
                <Pressable key={coach.id} style={[styles.row, { minHeight: 62 }, i > 0 && line]} onPress={() => show(coach)}>
                  <Avatar profile={coach} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 15 }} numberOfLines={1}>
                      {`${coach.firstName} ${coach.lastName}`.trim() || coach.username}
                    </Text>
                    <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }} numberOfLines={1}>
                      {[coach.ageGroup ?? 'No age group', coach.isAdmin ? 'Admin' : null, coach.canSaveVideos ? 'Can save videos' : null].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 17 },
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  section: { fontFamily: fonts.medium, fontSize: 19 },
  caption: { fontFamily: fonts.regular, fontSize: 13, marginLeft: 12, marginTop: 8 },
  note: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, marginHorizontal: 12 },
  card: { borderRadius: 14, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingVertical: 9 },
  label: { flex: 1, fontFamily: fonts.regular, fontSize: 16 },
  value: { fontFamily: fonts.regular, fontSize: 16 },
  input: { flex: 1.4, textAlign: 'right', fontFamily: fonts.regular, fontSize: 16, paddingVertical: 0 },
  button: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, marginTop: 6 },
});
