import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EditIcon } from '../components/Icons';
import { NavRow, PlayerCard, PlayerFrame, PlayerSection } from '../components/PlayerPage';
import { useLook } from '../lib/appTheme';
import { injuryOn, todayIso, useData } from '../lib/data';
import { ATTITUDES, LEVEL_COLORS, LEVELS, playerGames, playerTrainings, positionGroup, shortName } from '../lib/playerProfile';
import { playerStats } from '../lib/playerStats';
import { supabase } from '../lib/supabase';
import { fonts, useColors } from '../lib/theme';

type Note = 'strengths' | 'primaryFocus' | 'remarks' | 'attitudeNote';
const NOTE_INFO: Record<Note, { label: string; empty: string }> = {
  strengths: { label: 'Strengths', empty: 'What the player is good at' },
  primaryFocus: { label: 'Working areas', empty: 'What to work on first' },
  attitudeNote: { label: 'Topsport attitudes', empty: 'A note on the attitude of the player' },
  remarks: { label: 'Remarks', empty: 'Anything else' },
};

// A player as the coaches of the team see them from the Squad: photo, age group
// and line, his rating, games and goals, links to his positions, games,
// training and injuries, the notes every coach can write, and his topsport attitudes.
export default function SquadPlayerScreen() {
  const t = useLook();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { players, games, goals, trainings, me, refresh } = useData();
  const player = players.find((p) => p.id === id);
  const stat = useMemo(() => (player ? playerStats([player], games, goals, trainings).stats[0] : null), [player, games, goals, trainings]);
  const gameInfo = useMemo(() => (player ? playerGames(player, games) : null), [player, games]);
  const trainingInfo = useMemo(() => (player ? playerTrainings(player, trainings) : null), [player, trainings]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState<{ key: Note; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  // The attitudes as just tapped, shown at once while they are saved.
  const [attitudes, setAttitudes] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (!player?.photoPath) return;
    supabase.storage
      .from('player-photos')
      .createSignedUrl(player.photoPath, 3600)
      .then(({ data }) => setPhoto(data?.signedUrl ?? null));
  }, [player?.photoPath]);

  if (!player || !stat || !gameInfo || !trainingInfo) {
    return (
      <PlayerFrame title="Player">
        <Text style={{ color: t.soft, fontFamily: fonts.regular, textAlign: 'center' }}>This player is not in the team on show.</Text>
      </PlayerFrame>
    );
  }

  const today = todayIso();
  const injured = injuryOn(player, today);
  const coming = player.injuries.filter((i) => i.startDate > today && !i.endedOn);
  const line = player.bestPosition ? positionGroup(player.bestPosition) : null;
  const shown = attitudes ?? player.attitudes;

  async function saveNote() {
    if (!note || !player) return;
    setSaving(true);
    setError('');
    const text = note.text.trim();
    const { error: failed } =
      note.key === 'attitudeNote'
        ? await supabase.rpc('update_player_attitudes', { p_id: player.id, p_attitudes: shown, p_note: text })
        : await supabase.rpc('update_player_notes', {
            p_id: player.id,
            p_strengths: note.key === 'strengths' ? text : player.strengths,
            p_primary_focus: note.key === 'primaryFocus' ? text : player.primaryFocus,
            p_remarks: note.key === 'remarks' ? text : player.remarks,
          });
    setSaving(false);
    if (failed) return setError(`Could not save: ${failed.message}`);
    setNote(null);
    refresh();
  }

  // Tapping a step sets that level; tapping the level it already has clears it.
  async function rate(key: string, level: number) {
    if (!player) return;
    const next = { ...shown };
    if (next[key] === level) delete next[key];
    else next[key] = level;
    setAttitudes(next);
    setError('');
    const { error: failed } = await supabase.rpc('update_player_attitudes', { p_id: player.id, p_attitudes: next, p_note: player.attitudeNote });
    if (failed) {
      setAttitudes(null);
      return setError(`Could not save: ${failed.message}`);
    }
    await refresh();
    setAttitudes(null);
  }

  const divider = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sport ? t.border : t.pill };
  const noteCard = (key: Note) => (
    <PlayerCard style={styles.note}>
      <Pressable style={styles.noteHead} onPress={() => (setError(''), setNote({ key, text: player[key] }))} accessibilityLabel={`Edit ${NOTE_INFO[key].label.toLowerCase()}`}>
        <Text style={{ flex: 1, color: player[key] ? t.ink : t.soft, fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 }}>{player[key] || NOTE_INFO[key].empty}</Text>
        <View style={[styles.edit, { backgroundColor: t.pill }]}>
          <EditIcon size={16} color={t.ink} />
        </View>
      </Pressable>
    </PlayerCard>
  );

  return (
    <PlayerFrame
      title={`${player.firstName} ${player.lastName}`}
      sub={me?.activeAgeGroup?.name}
      after={
        <Modal visible={!!note} transparent animationType="slide" onRequestClose={() => setNote(null)}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Pressable style={{ flex: 1 }} onPress={() => setNote(null)} accessibilityLabel="Close" />
            <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 16 }]}>
              <View style={[styles.grabber, { backgroundColor: c.line }]} />
              <Text style={[styles.title, { color: c.ink }]}>{note ? NOTE_INFO[note.key].label : ''}</Text>
              <TextInput
                value={note?.text ?? ''}
                onChangeText={(text) => note && setNote({ ...note, text })}
                placeholder={note ? NOTE_INFO[note.key].empty : ''}
                placeholderTextColor={c.inkSoft}
                multiline
                autoFocus
                style={[styles.area, { backgroundColor: c.surface2, color: c.ink }]}
              />
              {error ? <Text style={{ color: c.danger, fontFamily: fonts.regular, fontSize: 13 }}>{error}</Text> : null}
              <Pressable style={[styles.button, { backgroundColor: c.pitch }, saving && { opacity: 0.6 }]} onPress={saveNote} disabled={saving}>
                {saving ? <ActivityIndicator color={c.onPitch} /> : <Text style={{ color: c.onPitch, fontFamily: fonts.medium, fontSize: 16 }}>Save</Text>}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      }
    >
      <View style={{ alignItems: 'center', gap: 8 }}>
        <View style={[styles.photo, { backgroundColor: photo ? t.pill : t.feature, borderColor: t.card }]}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.photoImage} />
          ) : (
            <Text style={{ color: '#fff', fontFamily: fonts.semi, fontSize: 34 }}>
              {`${player.firstName.trim()[0] ?? ''}${player.lastName.trim()[0] ?? ''}`.toUpperCase()}
            </Text>
          )}
        </View>
        <Text style={{ color: t.ink, fontFamily: t.sport ? t.display : fonts.semi, fontSize: t.sport ? 34 : 24, lineHeight: t.sport ? 36 : 30 }}>
          {t.sport ? shortName(player).toUpperCase() : shortName(player)}
        </Text>
        <View style={styles.labels}>
          {me?.activeAgeGroup ? (
            <View style={[styles.label, { backgroundColor: t.tag }]}>
              <Text style={{ color: t.onAccent, fontFamily: fonts.medium, fontSize: 12.5 }}>{me.activeAgeGroup.name}</Text>
            </View>
          ) : null}
          {line ? (
            <View style={[styles.label, { backgroundColor: t.accent + '22' }]}>
              <Text style={{ color: t.accent, fontFamily: fonts.medium, fontSize: 12.5 }}>{line}</Text>
            </View>
          ) : null}
          {injured ? (
            <View style={[styles.label, { backgroundColor: c.danger, flexDirection: 'row', gap: 5 }]}>
              <Ionicons name="medkit" size={12} color="#fff" />
              <Text style={{ color: '#fff', fontFamily: fonts.medium, fontSize: 12.5 }}>Injured</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* His rating, games and goals in one block. */}
      <View style={[styles.stats, { backgroundColor: t.feature, borderRadius: t.radius + 2 }]}>
        {(
          [
            [gameInfo.average !== null ? String(gameInfo.average) : '–', 'Rating', gameInfo.rated ? `${gameInfo.rated} rated ${gameInfo.rated === 1 ? 'game' : 'games'}` : 'Not rated yet'],
            [String(stat.games), 'Games played', `of ${gameInfo.counted}`],
            [String(stat.goals), 'Goals', stat.goals && stat.games ? `${(stat.goals / stat.games).toFixed(2)} per game` : ''],
          ] as [string, string, string][]
        ).map(([value, label, sub], i) => (
          <View key={label} style={[styles.stat, i > 0 && { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.18)' }]}>
            <Text style={{ color: '#fff', fontFamily: t.display, fontSize: 40, lineHeight: 42 }}>{value}</Text>
            <Text style={{ color: '#fff', fontFamily: fonts.medium, fontSize: 13 }}>{label}</Text>
            {sub ? <Text style={{ color: t.featureSoft, fontFamily: fonts.regular, fontSize: 12 }}>{sub}</Text> : null}
          </View>
        ))}
      </View>

      <PlayerCard>
        <NavRow
          first
          icon="grid-outline"
          title="Positions"
          sub={[player.bestPosition && `Best ${player.bestPosition}`, player.developingPosition && `Developing ${player.developingPosition}`, player.preferredPosition && `Preferred ${player.preferredPosition}`].filter(Boolean).join(' · ') || 'Not filled in'}
          onPress={() => router.push({ pathname: '/player-positions', params: { id: player.id } })}
        />
        <NavRow
          icon="football-outline"
          title="Games"
          sub={`${gameInfo.played} of ${gameInfo.counted} played${gameInfo.rated ? ' · ratings' : ''}${(me?.activeAgeGroup?.teams.length ?? 1) > 1 ? ', Blue and Red' : ''}`}
          onPress={() => router.push({ pathname: '/player-games', params: { id: player.id } })}
        />
        <NavRow
          icon="walk-outline"
          title="Training"
          sub={trainingInfo.counting ? `${trainingInfo.percent}% attendance · ${trainingInfo.attended} of ${trainingInfo.counting}` : 'No trainings yet'}
          onPress={() => router.push({ pathname: '/player-training', params: { id: player.id } })}
        />
        <NavRow
          icon="medkit-outline"
          title="Injuries"
          sub={injured ? injured.note || 'Injured' : coming.length ? `From ${coming[0].startDate}` : 'Not injured'}
          onPress={() => router.push({ pathname: '/player-injuries', params: { id: player.id } })}
        />
      </PlayerCard>

      <PlayerSection>Strengths</PlayerSection>
      {noteCard('strengths')}
      <PlayerSection>Working areas</PlayerSection>
      {noteCard('primaryFocus')}

      <PlayerSection>Topsport attitudes</PlayerSection>
      <PlayerCard>
        {ATTITUDES.map((a, i) => {
          const level = shown[a.key] ?? 0;
          const color = level ? LEVEL_COLORS[level - 1] : t.soft;
          return (
            <View key={a.key} style={[styles.attitude, i > 0 && divider]}>
              <View style={styles.noteHead}>
                <Text style={{ flex: 1, color: t.ink, fontFamily: fonts.regular, fontSize: 15 }}>{a.label}</Text>
                <Text style={{ color: level ? color : t.soft, fontFamily: fonts.medium, fontSize: 12.5 }}>{level ? LEVELS[level - 1] : 'Not rated'}</Text>
              </View>
              <View style={styles.scale}>
                {LEVELS.map((name, n) => (
                  <Pressable key={name} style={styles.step} onPress={() => rate(a.key, n + 1)} hitSlop={{ top: 10, bottom: 10 }} accessibilityLabel={`${a.label}: ${name}`}>
                    <View style={[styles.stepBar, { backgroundColor: n < level ? color : t.pill }]} />
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
        <Pressable style={[styles.attNote, divider]} onPress={() => (setError(''), setNote({ key: 'attitudeNote', text: player.attitudeNote }))}>
          <Text style={{ flex: 1, color: player.attitudeNote ? t.ink : t.soft, fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 }}>{player.attitudeNote || 'A note on the attitude of the player'}</Text>
          <View style={[styles.edit, { backgroundColor: t.pill }]}>
            <EditIcon size={16} color={t.ink} />
          </View>
        </Pressable>
      </PlayerCard>

      <PlayerSection>Remarks</PlayerSection>
      {noteCard('remarks')}
      {error && !note ? <Text style={{ color: c.danger, fontFamily: fonts.regular, fontSize: 13 }}>{error}</Text> : null}
    </PlayerFrame>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.medium, fontSize: 17 },
  photo: { width: 112, height: 112, borderRadius: 56, borderWidth: 4, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  // Zoomed in on the face, like the small photos in the Squad.
  photoImage: { position: 'absolute', width: 150, height: 150, left: -19, top: -6 },
  labels: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  label: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, alignItems: 'center' },
  stats: { flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 6 },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  note: { paddingVertical: 12 },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  edit: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  attitude: { paddingVertical: 10 },
  scale: { flexDirection: 'row', gap: 4, marginTop: 8 },
  step: { flex: 1, paddingVertical: 4 },
  stepBar: { height: 8, borderRadius: 4 },
  attNote: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  button: { height: 50, borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
    shadowColor: '#0E1320',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 4 },
  area: { minHeight: 120, borderRadius: 12, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, fontFamily: fonts.regular, fontSize: 15, textAlignVertical: 'top' },
});
