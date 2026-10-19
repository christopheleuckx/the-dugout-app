import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DragRow } from '../components/DragRow';
import { fmtDate, useData, type Player, type TrainingGroups } from '../lib/data';
import { makeGroups } from '../lib/groups';
import { goBack } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';

const COUNTS = [1, 2, 3, 4, 5, 6];
// Where a dragged player can land: a group by its number, or out of every group.
const OUTSIDE = -1;

// The groups of a training, made from the players who are present. They can
// be made again with other options, or changed by dragging players between
// groups while editing.
export default function TrainingGroupsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trainings, players, refresh } = useData();
  const training = trainings.find((t) => t.id === id);

  const [groups, setGroups] = useState<TrainingGroups | null>(training?.groups ?? null);
  const [editing, setEditing] = useState(false);
  const [held, setHeld] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [count, setCount] = useState(training?.groups?.numGroups ?? 2);
  const [splitGoalies, setSplitGoalies] = useState(training?.groups?.splitGoalies ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const boxes = useRef(new Map<number, View | null>());

  if (!training) {
    return (
      <View style={[styles.page, { backgroundColor: c.chalk, paddingTop: insets.top + 60, alignItems: 'center' }]}>
        <Text style={{ color: c.inkSoft, fontFamily: fonts.regular }}>This training no longer exists.</Text>
      </View>
    );
  }

  // Only players who are present are divided; absent ones are left out.
  const present = players.filter((p) => !(p.id in training.absences));
  const byId = new Map(players.map((p) => [p.id, p]));
  const grouped = new Set((groups?.groupIds ?? []).flat());
  // Present players who are in no group, for example marked present later.
  const loose = groups ? present.filter((p) => !grouped.has(p.id)) : [];
  const line = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line };

  async function store(next: TrainingGroups | null) {
    setError('');
    setGroups(next);
    // A training without groups keeps an empty object, as the database and the web app expect.
    const { error: failed } = await supabase.from('trainings').update({ groups: next ?? {} }).eq('id', training!.id);
    if (failed) setError(`Could not save the groups: ${failed.message}`);
    refresh();
  }

  async function generate() {
    setSaving(true);
    await store({ numGroups: count, splitGoalies, mixed: true, groupIds: makeGroups(present, count, splitGoalies) });
    setSaving(false);
    setSheet(false);
  }

  function remove() {
    Alert.alert('Remove the groups?', 'The groups of this training are removed. You can create new ones at any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setEditing(false);
          store(null);
        },
      },
    ]);
  }

  // A dropped player goes to the group under the finger, at the end of it.
  async function drop(playerId: string, pageY: number) {
    setHeld(null);
    if (!groups || pageY < 0) return;
    const keys = [...boxes.current.keys()];
    const hits = await Promise.all(
      keys.map(
        (key) =>
          new Promise<number | null>((resolve) => {
            const box = boxes.current.get(key);
            if (!box) return resolve(null);
            box.measureInWindow((_x, y, _w, h) => resolve(pageY >= y && pageY <= y + h ? key : null));
          }),
      ),
    );
    const target = hits.find((k) => k !== null);
    if (target === undefined || target === null) return;
    const from = groups.groupIds.findIndex((ids) => ids.includes(playerId));
    if (from === target) return;
    const groupIds = groups.groupIds.map((ids) => ids.filter((x) => x !== playerId));
    if (target !== OUTSIDE) groupIds[target] = [...groupIds[target], playerId];
    store({ ...groups, groupIds });
  }

  const row = (p: Player, i: number) => {
    const absent = p.id in training.absences;
    const content = (
      <>
        <View style={[styles.badge, { backgroundColor: c.surface2 }]}>
          <Text style={{ color: c.ink, fontFamily: fonts.semi, fontSize: 13 }}>{p.bestPosition || '–'}</Text>
        </View>
        <Text style={{ flex: 1, color: absent ? c.inkSoft : c.ink, fontFamily: fonts.medium, fontSize: 15 }} numberOfLines={1}>
          {`${p.firstName} ${p.lastName}`.trim()}
        </Text>
        {absent ? <Text style={{ color: c.danger, fontFamily: fonts.medium, fontSize: 13, marginRight: editing ? 0 : 16 }}>Absent</Text> : null}
      </>
    );
    return editing ? (
      <View key={p.id} style={i > 0 && line}>
        <DragRow background={c.surface} handleColor={c.inkSoft} onStart={() => setHeld(p.id)} onDrop={(_dy, pageY) => drop(p.id, pageY)}>
          {content}
        </DragRow>
      </View>
    ) : (
      <View key={p.id} style={[styles.row, i > 0 && line]}>
        {content}
      </View>
    );
  };

  const box = (key: number, title: string, list: Player[]) => (
    <View key={key} style={[{ gap: 8 }, list.some((p) => p.id === held) && { zIndex: 10 }]}>
      <Text style={[styles.group, { color: c.inkSoft }]}>
        {title} · {list.length} {list.length === 1 ? 'player' : 'players'}
      </Text>
      <View ref={(v) => void boxes.current.set(key, v)} style={[styles.card, { backgroundColor: c.surface, minHeight: 54 }]}>
        {list.length ? list.map(row) : <Text style={[styles.empty, { color: c.inkSoft }]}>{editing ? 'Drag players here' : 'No players'}</Text>}
      </View>
    </View>
  );

  return (
    <View style={[styles.page, { backgroundColor: c.chalk }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable style={[styles.round, { backgroundColor: c.surface }]} onPress={goBack} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.title, { color: c.ink }]}>Training groups</Text>
          <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }} numberOfLines={1}>
            {training.label} · {fmtDate(training.date)}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} scrollEnabled={!held}>
        {error ? <Text style={{ color: c.danger, fontFamily: fonts.regular, fontSize: 13 }}>{error}</Text> : null}
        {!groups ? (
          <View style={[styles.card, styles.start, { backgroundColor: c.surface }]}>
            <Ionicons name="people-outline" size={28} color={c.inkSoft} />
            <Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 16 }}>No groups yet</Text>
            <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center' }}>
              Divide the {present.length} present players into groups. Absent players are left out.
            </Text>
            <Pressable style={[styles.button, { backgroundColor: c.pitch, alignSelf: 'stretch' }]} onPress={() => setSheet(true)}>
              <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>Create groups</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={[styles.card, styles.row, { backgroundColor: c.surface, paddingLeft: 16 }]}>
              <Text style={{ flex: 1, color: c.ink, fontFamily: fonts.regular, fontSize: 16 }}>Number of groups</Text>
              <Text style={{ color: c.ink, fontFamily: fonts.semi, fontSize: 16, marginRight: 12 }}>{groups.groupIds.length}</Text>
              <Pressable
                style={[styles.edit, { backgroundColor: editing ? c.pitch : c.surface2 }]}
                onPress={() => setEditing(!editing)}
                accessibilityLabel={editing ? 'Done editing' : 'Edit the groups'}
              >
                {editing ? null : <Ionicons name="pencil" size={13} color={c.ink} />}
                <Text style={{ color: editing ? c.onPitch : c.ink, fontFamily: fonts.medium, fontSize: 14 }}>{editing ? 'Done' : 'Edit'}</Text>
              </Pressable>
            </View>
            {editing ? (
              <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13, marginHorizontal: 4 }}>
                Drag a player by its handle onto another group.
              </Text>
            ) : null}
            {groups.groupIds.map((ids, i) =>
              box(
                i,
                `Group ${i + 1}`,
                ids.map((pid) => byId.get(pid)).filter((p): p is Player => !!p),
              ),
            )}
            {loose.length ? box(OUTSIDE, 'Not in a group', loose) : null}
            <Pressable style={[styles.button, { backgroundColor: c.surface, marginTop: 8 }]} onPress={() => setSheet(true)}>
              <Ionicons name="shuffle" size={18} color={c.pitch} />
              <Text style={{ color: c.pitch, fontFamily: fonts.medium, fontSize: 16 }}>Regenerate</Text>
            </Pressable>
            <Pressable style={[styles.button, { backgroundColor: c.surface }]} onPress={remove}>
              <Ionicons name="trash-outline" size={18} color={c.danger} />
              <Text style={{ color: c.danger, fontFamily: fonts.medium, fontSize: 16 }}>Remove groups</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {/* How the groups are made. */}
      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setSheet(false)} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.grabber, { backgroundColor: c.line }]} />
          <Text style={[styles.title, { color: c.ink }]}>{groups ? 'Regenerate groups' : 'Create groups'}</Text>
          <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>Made from the {present.length} present players.</Text>
          <Text style={[styles.group, { color: c.inkSoft, marginTop: 10 }]}>Number of groups</Text>
          <View style={styles.counts}>
            {COUNTS.map((n) => (
              <Pressable
                key={n}
                style={[styles.count, { backgroundColor: n === count ? c.pitch : c.surface2 }]}
                onPress={() => setCount(n)}
                accessibilityLabel={`${n} ${n === 1 ? 'group' : 'groups'}`}
              >
                <Text style={{ color: n === count ? c.onPitch : c.ink, fontFamily: fonts.semi, fontSize: 16 }}>{n}</Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.row, { marginTop: 6 }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontFamily: fonts.regular, fontSize: 16 }}>Divide the goalkeepers</Text>
              <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>
                {splitGoalies ? 'Spread over the groups' : 'All together in group 1'}
              </Text>
            </View>
            <Switch value={splitGoalies} onValueChange={setSplitGoalies} trackColor={{ true: c.pitch }} />
          </View>
          {groups ? (
            <Text style={{ color: c.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>The current groups and any changes you made are replaced.</Text>
          ) : null}
          <Pressable style={[styles.button, { backgroundColor: c.pitch, marginTop: 8 }, saving && { opacity: 0.6 }]} onPress={generate} disabled={saving || present.length === 0}>
            {saving ? (
              <ActivityIndicator color={c.onPitch} />
            ) : (
              <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>{groups ? 'Regenerate groups' : 'Create groups'}</Text>
            )}
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  round: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.medium, fontSize: 17 },
  content: { padding: 16, gap: 10, paddingBottom: 60 },
  card: { borderRadius: 14 },
  start: { alignItems: 'center', gap: 8, padding: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingLeft: 16, paddingRight: 12 },
  group: { fontFamily: fonts.medium, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, marginHorizontal: 4 },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  empty: { fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', paddingVertical: 17 },
  edit: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  button: { height: 50, borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 6,
    shadowColor: '#0E1320',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 8 },
  counts: { flexDirection: 'row', gap: 8 },
  count: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
