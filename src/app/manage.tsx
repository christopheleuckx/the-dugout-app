import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
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
import { Crest } from '../components/MatchCard';
import { useData, type Profile } from '../lib/data';
import { goBack } from '../lib/nav';
import { logoUrl, supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';

const FORMATS = ['8v8', '9v9', '11v11'];

// A club with its age groups, as the structure of version 2 stores them.
type AgeGroup = { id: string; name: string; format: string; teams: string[]; coaches: number; video: boolean };
// Video: on for the club, and then for all its age groups or only the chosen ones.
type Club = { id: string; name: string; logoPath: string | null; video: boolean; videoAll: boolean; ageGroups: AgeGroup[] };
const hasVideo = (club: Club, group: AgeGroup) => club.video && (club.videoAll || group.video);

// A coach's account as the admin manages it.
type Coach = Profile & { flags: Record<string, unknown> };

// For admins: the coaches who can sign in. Add a coach, link them to an age
// groups, and decide whether they may save videos to their phone. Also the
// clubs with their age groups, and adding an age group to a club.
export default function ManageScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { me, refresh } = useData();
  // The Profile opens this page twice: once for the age groups, once for the coaches.
  const ageGroupsOnly = useLocalSearchParams<{ view?: string }>().view === 'age-groups';
  const [coaches, setCoaches] = useState<Coach[] | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  // The coach being changed, or "new" for the form to add one.
  const [open, setOpen] = useState<Coach | 'new' | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // Per coach id: the age groups they are linked to; and the ticks on the open coach.
  const [links, setLinks] = useState<Record<string, string[]>>({});
  const [groups, setGroups] = useState<string[]>([]);
  // The form to add an age group to a club.
  const [adding, setAdding] = useState<Club | null>(null);
  // The club whose video settings are on show.
  const [videoClubId, setVideoClubId] = useState<string | null>(null);
  // The form to add a club; its logo and age groups are added afterwards.
  const [newClub, setNewClub] = useState(false);
  const [clubName, setClubName] = useState('');
  // The age group being changed with that same form, instead of a new one.
  const [editing, setEditing] = useState<AgeGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [format, setFormat] = useState('8v8');
  const [twoTeams, setTwoTeams] = useState(true);
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
        tourSeen: 0,
        ageGroups: [],
        activeAgeGroup: null,
        flags: p.feature_flags ?? {},
      })),
    );
    const members = await supabase.from('age_group_members').select('age_group_id, user_id');
    const byCoach: Record<string, string[]> = {};
    for (const m of members.data ?? []) (byCoach[m.user_id] ??= []).push(m.age_group_id);
    setLinks(byCoach);
    // Clubs, their age groups and teams, with how many coaches and players each has.
    const structure = await supabase
      .from('clubs')
      .select('id, name, logo_path, video_enabled, video_all_age_groups, age_groups(id, name, default_format, video_enabled, teams(key, name), age_group_members(user_id))')
      .order('name');
    if (!structure.error) {
      setClubs(
        (structure.data ?? []).map((club) => ({
          id: club.id,
          name: club.name,
          logoPath: club.logo_path ?? null,
          video: !!club.video_enabled,
          videoAll: !!club.video_all_age_groups,
          ageGroups: (club.age_groups ?? [])
            .map((a) => ({
              id: a.id,
              name: a.name,
              format: a.default_format,
              teams: (a.teams ?? []).sort((x, y) => x.key.localeCompare(y.key)).map((t) => t.name),
              coaches: (a.age_group_members ?? []).length,
              video: !!a.video_enabled,
            }))
            .sort((x, y) => x.name.localeCompare(y.name)),
        })),
      );
    }
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
    setGroups(existing ? (links[existing.id] ?? []) : me?.activeAgeGroup ? [me.activeAgeGroup.id] : []);
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
        .update({ first_name: firstName.trim(), last_name: lastName.trim(), ...flags })
        .eq('id', id);
      if (saved.error) throw new Error(saved.error.message);
      // Link and unlink age groups to match the ticks.
      const linkedBefore = open === 'new' ? [] : (links[id] ?? []);
      const added = groups.filter((g) => !linkedBefore.includes(g));
      const removed = linkedBefore.filter((g) => !groups.includes(g));
      if (added.length) {
        const linked = await supabase.from('age_group_members').insert(added.map((g) => ({ age_group_id: g, user_id: id })));
        if (linked.error) throw new Error(linked.error.message);
      }
      if (removed.length) {
        const unlinked = await supabase.from('age_group_members').delete().eq('user_id', id).in('age_group_id', removed);
        if (unlinked.error) throw new Error(unlinked.error.message);
      }
      // A coach always works in one of their own age groups: a new coach
      // starts in the first one, and so does a coach unlinked from the one
      // they were working in.
      if (open === 'new') {
        await supabase.from('profiles').update({ active_age_group_id: groups[0] ?? null }).eq('id', id);
      } else if (removed.length) {
        await supabase.from('profiles').update({ active_age_group_id: groups[0] ?? null }).eq('id', id).in('active_age_group_id', removed);
      }
      await load();
      if (id === me?.id) await refresh();
      setOpen(null);
    } catch (e) {
      setError(`Could not save: ${(e as Error).message}`);
    }
    setSaving(false);
  }

  // A new age group gets its teams, and the admin who makes it is linked to it.
  async function addGroup() {
    if (saving || !adding || !me) return;
    if (!groupName.trim()) return setError('Give the age group a name.');
    setSaving(true);
    setError('');
    try {
      if (editing) {
        const changed = await supabase.from('age_groups').update({ name: groupName.trim(), default_format: format }).eq('id', editing.id);
        if (changed.error) throw new Error(/duplicate/i.test(changed.error.message) ? 'This club already has an age group with that name.' : changed.error.message);
        await Promise.all([load(), refresh()]);
        setAdding(null);
        setEditing(null);
        setSaving(false);
        return;
      }
      const made = await supabase.from('age_groups').insert({ club_id: adding.id, name: groupName.trim(), default_format: format }).select('id').single();
      if (made.error) throw new Error(/duplicate/i.test(made.error.message) ? 'This club already has an age group with that name.' : made.error.message);
      const teams = twoTeams
        ? [
            { age_group_id: made.data.id, key: 'blue', name: 'Blue', color: '#2E86DE' },
            { age_group_id: made.data.id, key: 'red', name: 'Red', color: '#C81E2E' },
          ]
        : [{ age_group_id: made.data.id, key: 'blue', name: groupName.trim(), color: '#2E86DE' }];
      const teamed = await supabase.from('teams').insert(teams);
      if (teamed.error) throw new Error(teamed.error.message);
      const linked = await supabase.from('age_group_members').insert({ age_group_id: made.data.id, user_id: me.id });
      if (linked.error) throw new Error(linked.error.message);
      await Promise.all([load(), refresh()]);
      setAdding(null);
    } catch (e) {
      setError(`Could not ${editing ? 'save' : 'add'} the age group: ${(e as Error).message}`);
    }
    setSaving(false);
  }

  const videoClub = clubs.find((club) => club.id === videoClubId) ?? null;

  // The video switches save at once. Shown as chosen straight away, and put
  // back when the database refuses.
  async function setClubVideo(club: Club, change: { video_enabled?: boolean; video_all_age_groups?: boolean }) {
    setError('');
    const before = clubs;
    setClubs(clubs.map((x) => (x.id === club.id ? { ...x, video: change.video_enabled ?? x.video, videoAll: change.video_all_age_groups ?? x.videoAll } : x)));
    const saved = await supabase.from('clubs').update(change).eq('id', club.id).select('id');
    if (saved.error || !saved.data?.length) {
      setClubs(before);
      setError(`Could not save: ${saved.error?.message ?? 'only admins can change this'}`);
    } else refresh();
  }
  async function setGroupVideo(club: Club, group: AgeGroup, on: boolean) {
    setError('');
    const before = clubs;
    setClubs(clubs.map((x) => (x.id === club.id ? { ...x, ageGroups: x.ageGroups.map((g) => (g.id === group.id ? { ...g, video: on } : g)) } : x)));
    const saved = await supabase.from('age_groups').update({ video_enabled: on }).eq('id', group.id).select('id');
    if (saved.error || !saved.data?.length) {
      setClubs(before);
      setError(`Could not save: ${saved.error?.message ?? 'only admins can change this'}`);
    } else refresh();
  }

  async function addClub() {
    if (saving) return;
    const clean = clubName.trim().replace(/\s+/g, ' ');
    if (!clean) return setError('Give the club a name.');
    if (clubs.some((club) => club.name.toLowerCase() === clean.toLowerCase())) return setError('There is already a club with that name.');
    setSaving(true);
    setError('');
    const made = await supabase.from('clubs').insert({ name: clean }).select('id');
    if (made.error || !made.data?.length) setError(`Could not add the club: ${made.error?.message ?? 'only admins can add a club'}`);
    else {
      await load();
      setNewClub(false);
    }
    setSaving(false);
  }

  // A club's logo: chosen from the photos, stored with the other logos, and
  // the old file removed. Everyone of the club sees it on their games.
  const [logoBusy, setLogoBusy] = useState<string | null>(null);
  async function changeLogo(club: Club) {
    setError('');
    let result;
    try {
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, base64: true });
    } catch (e) {
      setError(`Could not open your photos: ${(e as { message?: string })?.message ?? 'unknown error'}`);
      return;
    }
    if (result.canceled) return;
    setLogoBusy(club.id);
    try {
      const base64 = result.assets[0].base64;
      if (!base64) throw new Error('the photo could not be read');
      const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0)).buffer;
      const path = `club/${club.id}-${Date.now()}.jpg`;
      const uploaded = await supabase.storage.from('competitor-logos').upload(path, bytes, { contentType: 'image/jpeg' });
      if (uploaded.error) throw uploaded.error;
      const saved = await supabase.from('clubs').update({ logo_path: path }).eq('id', club.id).select('id');
      if (saved.error) throw saved.error;
      if (!saved.data?.length) throw new Error('you may not change this club');
      if (club.logoPath) await supabase.storage.from('competitor-logos').remove([club.logoPath]);
      await load();
      await refresh();
    } catch (e) {
      setError(`Could not save the logo: ${(e as { message?: string })?.message ?? 'unknown error'}`);
    }
    setLogoBusy(null);
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
        <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={() => (videoClub ? setVideoClubId(null) : newClub ? setNewClub(false) : adding ? (setAdding(null), setEditing(null)) : open ? setOpen(null) : goBack())} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]}>{videoClub ? `Video · ${videoClub.name}` : newClub ? 'New club' : adding ? (editing ? editing.name : 'New age group') : isNew ? 'New coach' : open ? `${open.firstName} ${open.lastName}`.trim() : ageGroupsOnly ? 'Club management' : 'Coaches'}</Text>
        {open || adding || ageGroupsOnly ? (
          <View style={{ width: 36 }} />
        ) : (
          <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={() => show('new')} accessibilityLabel="New coach" hitSlop={8}>
            <Ionicons name="add" size={22} color={c.ink} />
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {videoClub ? (
          <>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <View style={styles.row}>
                <Text style={[styles.label, { color: c.ink }]}>Activate video feature</Text>
                <Switch value={videoClub.video} onValueChange={(on) => setClubVideo(videoClub, { video_enabled: on })} trackColor={{ true: c.pitch }} />
              </View>
              {videoClub.video ? (
                <View style={[styles.row, line]}>
                  <Text style={[styles.label, { color: c.ink }]}>All age groups</Text>
                  <Switch value={videoClub.videoAll} onValueChange={(on) => setClubVideo(videoClub, { video_all_age_groups: on })} trackColor={{ true: c.pitch }} />
                </View>
              ) : null}
            </View>
            <Text style={[styles.note, { color: c.inkSoft }]}>
              {!videoClub.video
                ? `The coaches of ${videoClub.name} don't see videos in the app and can't upload them.`
                : videoClub.videoAll
                  ? `Every age group of ${videoClub.name} can watch and upload videos on its games and trainings.`
                  : 'Select the age groups that can watch and upload videos.'}
            </Text>
            {videoClub.video && !videoClub.videoAll ? (
              <>
                <Text style={[styles.caption, { color: c.inkSoft }]}>Age groups with video</Text>
                <View style={[styles.card, { backgroundColor: c.surface }]}>
                  {videoClub.ageGroups.map((group, i) => (
                    <View key={group.id} style={[styles.row, i > 0 && line]}>
                      <Text style={[styles.label, { color: c.ink }]}>{group.name}</Text>
                      <Switch value={group.video} onValueChange={(on) => setGroupVideo(videoClub, group, on)} trackColor={{ true: c.pitch }} />
                    </View>
                  ))}
                  {videoClub.ageGroups.length === 0 ? (
                    <View style={styles.row}>
                      <Text style={[styles.label, { color: c.inkSoft }]}>This club has no age groups yet.</Text>
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}
            {error ? <Text style={[styles.note, { color: c.danger }]}>{error}</Text> : null}
          </>
        ) : newClub ? (
          <>
            <Text style={[styles.note, { color: c.inkSoft }]}>A club has its own age groups, players, games and trainings. Add its logo and its age groups once it exists.</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>{field('Name', clubName, setClubName, { placeholder: 'FC Example', autoCapitalize: 'words' }, true)}</View>
            {error ? <Text style={[styles.note, { color: c.danger }]}>{error}</Text> : null}
            <Pressable style={[styles.button, { backgroundColor: c.pitch }]} onPress={addClub}>
              {saving ? <ActivityIndicator color={c.onPitch} /> : <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>Add club</Text>}
            </Pressable>
          </>
        ) : adding ? (
          <>
            <Text style={[styles.note, { color: c.inkSoft }]}>
              {editing ? `An age group of ${adding.name}.` : `A new age group of ${adding.name}, with its own players, games and trainings.`}
            </Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>{field('Name', groupName, setGroupName, { placeholder: 'U13' }, true)}</View>
            <Text style={[styles.caption, { color: c.inkSoft }]}>Usual format</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              {FORMATS.map((f, i) => (
                <Pressable key={f} style={[styles.row, i > 0 && line]} onPress={() => setFormat(f)}>
                  <Text style={[styles.label, { color: c.ink }]}>{f}</Text>
                  {format === f ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
                </Pressable>
              ))}
            </View>
            {editing ? (
              <Text style={[styles.note, { color: c.inkSoft }]}>
                New games start in this format; a game can still choose another one. Teams: {editing.teams.join(' and ')}.
              </Text>
            ) : (
              <>
              <Text style={[styles.caption, { color: c.inkSoft }]}>Teams</Text>
              <View style={[styles.card, { backgroundColor: c.surface }]}>
                {[
                  { two: false, label: 'One team' },
                  { two: true, label: 'Blue and Red' },
                ].map((option, i) => (
                  <Pressable key={option.label} style={[styles.row, i > 0 && line]} onPress={() => setTwoTeams(option.two)}>
                    <Text style={[styles.label, { color: c.ink }]}>{option.label}</Text>
                    {twoTeams === option.two ? <Ionicons name="checkmark" size={20} color={c.pitch} /> : null}
                  </Pressable>
                ))}
              </View>
              </>
            )}
            {error ? <Text style={[styles.note, { color: c.danger }]}>{error}</Text> : null}
            <Pressable style={[styles.button, { backgroundColor: c.pitch }]} onPress={addGroup}>
              {saving ? <ActivityIndicator color={c.onPitch} /> : <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>{editing ? 'Save' : 'Add age group'}</Text>}
            </Pressable>
          </>
        ) : open ? (
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

            {clubs.map((club) => (
              <View key={club.id} style={{ gap: 10 }}>
                <Text style={[styles.caption, { color: c.inkSoft }]}>Age groups · {club.name}</Text>
                <View style={[styles.card, { backgroundColor: c.surface }]}>
                  {club.ageGroups.map((group, i) => {
                    const on = groups.includes(group.id);
                    return (
                      <Pressable
                        key={group.id}
                        style={[styles.row, i > 0 && line]}
                        onPress={() => setGroups(on ? groups.filter((g) => g !== group.id) : [...groups, group.id])}
                        accessibilityRole="switch"
                        accessibilityState={{ checked: on }}
                      >
                        <Text style={[styles.label, { color: c.ink }]}>{group.name}</Text>
                        <Switch
                          value={on}
                          onValueChange={(next) => setGroups(next ? [...groups.filter((g) => g !== group.id), group.id] : groups.filter((g) => g !== group.id))}
                          trackColor={{ true: c.pitch }}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

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
            {(ageGroupsOnly ? clubs : []).map((club) => (
              <View key={club.id} style={{ gap: 10 }}>
                <Pressable style={styles.club} onPress={() => changeLogo(club)} accessibilityLabel={`Change the logo of ${club.name}`}>
                  {logoBusy === club.id ? <ActivityIndicator color={c.pitch} style={{ width: 44, height: 44 }} /> : <Crest url={logoUrl(club.logoPath)} name={club.name} size={44} />}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.section, { color: c.ink }]}>{club.name}</Text>
                    <Text style={{ color: c.pitch, fontFamily: fonts.regular, fontSize: 13 }}>{club.logoPath ? 'Change logo' : 'Add logo'}</Text>
                  </View>
                </Pressable>
                <View style={[styles.card, { backgroundColor: c.surface }]}>
                  <Pressable style={[styles.row, { minHeight: 62 }]} onPress={() => (setError(''), setVideoClubId(club.id))}>
                    <Ionicons name="videocam-outline" size={22} color={c.inkSoft} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 15 }}>Video</Text>
                      <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>
                        {!club.video
                          ? 'Off'
                          : club.videoAll
                            ? 'On for all age groups'
                            : `On for ${club.ageGroups.filter((g) => g.video).length} of ${club.ageGroups.length} age groups`}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
                  </Pressable>
                  {club.ageGroups.map((group) => (
                    <Pressable
                      key={group.id}
                      style={[styles.row, { minHeight: 62 }, line]}
                      onPress={() => {
                        setGroupName(group.name);
                        setFormat(group.format);
                        setError('');
                        setEditing(group);
                        setAdding(club);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 15 }}>{group.name}</Text>
                        <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>
                          {[group.format, group.teams.join(' and '), `${group.coaches} ${group.coaches === 1 ? 'coach' : 'coaches'}`, hasVideo(club, group) ? 'Video' : null].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
                    </Pressable>
                  ))}
                  <Pressable
                    style={[styles.row, line]}
                    onPress={() => {
                      setEditing(null);
                      setGroupName('');
                      setFormat('8v8');
                      setTwoTeams(true);
                      setError('');
                      setAdding(club);
                    }}
                  >
                    <Ionicons name="add" size={20} color={c.pitch} />
                    <Text style={[styles.label, { color: c.pitch }]}>Add age group</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {ageGroupsOnly ? null : (
              <View style={[styles.card, { backgroundColor: c.surface }]}>
                {coaches.map((coach, i) => (
                  <Pressable key={coach.id} style={[styles.row, { minHeight: 62 }, i > 0 && line]} onPress={() => show(coach)}>
                    <Avatar profile={coach} size={38} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 15 }} numberOfLines={1}>
                        {`${coach.firstName} ${coach.lastName}`.trim() || coach.username}
                      </Text>
                      <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }} numberOfLines={1}>
                        {[
                          clubs
                            .flatMap((club) => club.ageGroups)
                            .filter((g) => (links[coach.id] ?? []).includes(g.id))
                            .map((g) => g.name)
                            .join(', ') || 'No age group',
                          coach.isAdmin ? 'Admin' : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={c.inkSoft} />
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
      {ageGroupsOnly && !adding && !newClub && !videoClub && me?.isAdmin ? (
        <Pressable
          style={[styles.add, { backgroundColor: c.pitch, bottom: Math.max(insets.bottom, 12) + 12 }]}
          onPress={() => (setClubName(''), setError(''), setNewClub(true))}
          accessibilityLabel="New club"
        >
          <Ionicons name="add" size={28} color={c.onPitch} />
        </Pressable>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // The same round button as on the Games tab.
  add: {
    position: 'absolute',
    right: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0E1320',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  club: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 17 },
  content: { padding: 16, gap: 10, paddingBottom: 110 },
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
