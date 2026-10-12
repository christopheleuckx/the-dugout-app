import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { fonts } from './theme';

// The walkthrough of the app. Each slide shows one or more small screens of
// the app with made-up content (a national team instead of the club's own
// players and games), and points out parts of them one at a time.
//
// To add a slide for a new feature: append it to TOUR_SLIDES with "since" set
// to one more than the current highest. Coaches who already saw the tour then
// only get the newer slides; new coaches get all of them.

// A part of a small screen. With "spot" it is pointed out, with that text.
// "joined" removes the gap above it, to make it look part of the block before.
export type TourBlock = { key: string; node: ReactNode; spot?: string; joined?: boolean };
export type TourSlide = { since: number; title: string; text: string; scenes: TourBlock[][] };

const BELGIUM = require('../../assets/tour/belgium.jpg');
const FRANCE = require('../../assets/tour/france.jpg');
const SPAIN = require('../../assets/tour/spain.jpg');

// The small screens are always drawn in the app's light colours.
const ink = '#101828';
const soft = '#5A6578';
const line = '#E0E5EE';
const navy = '#14306B';
const blue = '#1E4289';
const win = '#1F8A4C';
const danger = '#B5473F';
const training = '#1E7D82';

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  cardTop: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingVertical: 2, paddingBottom: 0 },
  cardBottom: { borderTopLeftRadius: 0, borderTopRightRadius: 0, paddingVertical: 0, paddingBottom: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  heading: { fontFamily: fonts.medium, fontSize: 13, color: ink },
  hello: { fontFamily: fonts.semi, fontSize: 15, color: ink },
  strong: { fontFamily: fonts.medium, fontSize: 11.5, color: ink },
  text: { fontFamily: fonts.regular, fontSize: 11.5, color: ink },
  mute: { fontFamily: fonts.regular, fontSize: 10.5, color: soft },
  row: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 5 },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: line },
  pill: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  pillText: { fontFamily: fonts.medium, fontSize: 10 },
  match: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { width: 72, alignItems: 'center', gap: 3 },
  logoWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logo: { width: 30, height: 30 },
  sideName: { fontFamily: fonts.regular, fontSize: 10.5, textAlign: 'center' },
  score: { fontFamily: fonts.semi, fontSize: 20, color: ink },
  badge: { width: 20, height: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontFamily: fonts.semi, fontSize: 11 },
  icon: { width: 20, height: 20, borderRadius: 6, backgroundColor: '#EAEFF6', alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingVertical: 2 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, minHeight: 20, justifyContent: 'center' },
  pitch: { height: 196, borderRadius: 10, backgroundColor: '#2F7D4F', borderWidth: 2, borderColor: '#fff' },
  spot: { position: 'absolute', width: 60, marginLeft: -30, marginTop: -16, alignItems: 'center' },
  shirt: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shirtText: { color: navy, fontFamily: fonts.semi, fontSize: 10 },
  spotName: { color: '#fff', fontFamily: fonts.regular, fontSize: 9.5 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#EAEFF6' },
  tile: { flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 7, alignItems: 'center' },
  tileValue: { fontFamily: fonts.semi, fontSize: 16, color: ink },
  thumb: { width: 38, height: 26, borderRadius: 6, backgroundColor: navy, alignItems: 'center', justifyContent: 'center' },
});

const Card = ({ children, style }: { children: ReactNode; style?: object }) => <View style={[s.card, style]}>{children}</View>;
const Heading = ({ children }: { children: string }) => <Text style={s.heading}>{children}</Text>;
const Pill = ({ label, color, solid }: { label: string; color: string; solid?: boolean }) => (
  <View style={[s.pill, { backgroundColor: solid ? color : color + '22' }]}>
    <Text style={[s.pillText, { color: solid ? '#fff' : color }]}>{label}</Text>
  </View>
);
const Row = ({ title, sub, right, first }: { title: string; sub?: string; right?: ReactNode; first?: boolean }) => (
  <View style={[s.row, !first && s.rowLine]}>
    <View style={{ flex: 1 }}>
      <Text style={s.strong}>{title}</Text>
      {sub ? <Text style={s.mute}>{sub}</Text> : null}
    </View>
    {right}
  </View>
);
const Side = ({ logo, name, color = ink }: { logo: ImageSourcePropType; name: string; color?: string }) => (
  <View style={s.side}>
    <View style={s.logoWrap}>
      <Image source={logo} style={s.logo} resizeMode="contain" />
    </View>
    <Text style={[s.sideName, { color }]}>{name}</Text>
  </View>
);
const Badge = ({ score, color }: { score: number; color: string }) => (
  <View style={[s.badge, { backgroundColor: color }]}>
    <Text style={s.badgeText}>{score}</Text>
  </View>
);
const Chevron = () => <Ionicons name="chevron-forward" size={11} color={soft} />;
const Bar = ({ title, sub }: { title: string; sub: string }) => (
  <View style={{ alignItems: 'center' }}>
    <Text style={s.heading}>{title}</Text>
    <Text style={s.mute}>{sub}</Text>
  </View>
);
const MatchCard = () => (
  <Card>
    <View style={s.match}>
      <Side logo={BELGIUM} name="Belgium" />
      <View style={{ alignItems: 'center' }}>
        <Text style={s.mute}>END</Text>
        <Text style={s.score}>2 - 0</Text>
      </View>
      <Side logo={SPAIN} name="Spain" />
    </View>
  </Card>
);

// Eight against eight, back to front; left and right as seen from the keeper.
const TEAM: [string, string, number, number][] = [
  ['K', 'Courtois', 50, 90],
  ['3', 'Mechele', 24, 70],
  ['4', 'Ngoy', 76, 70],
  ['6', 'Leiva', 50, 56],
  ['11', 'De Cuyper', 15, 36],
  ['10', 'De Bruyne', 50, 34],
  ['7', 'Doku', 85, 36],
  ['9', 'Lukaku', 50, 13],
];
const MINUTES: [string, number, string, string][] = [
  ['Courtois', 100, win, "80'"],
  ['Mechele', 75, win, "60'"],
  ['Doku', 50, '#B8722A', "40'"],
];

export const TOUR_SLIDES: TourSlide[] = [
  {
    since: 1,
    title: 'Your week at a glance',
    text: 'Home shows the next games, everything planned this week and your latest results.',
    scenes: [
      [
        {
          key: 'hello',
          node: (
            <Text style={s.hello}>
              Good morning, <Text style={{ color: blue }}>Coach</Text>
            </Text>
          ),
        },
        { key: 'h1', node: <Heading>Upcoming games</Heading> },
        {
          key: 'next',
          spot: 'The next game, with a countdown',
          node: (
            <View style={[s.card, { backgroundColor: navy }]}>
              <Text style={[s.strong, { color: '#fff' }]}>Competition</Text>
              <Text style={[s.mute, { color: '#B5C7EA', marginBottom: 6 }]}>Sat 17 Oct · Home</Text>
              <View style={s.match}>
                <Side logo={BELGIUM} name="Belgium" color="#fff" />
                <View style={{ alignItems: 'center', gap: 2 }}>
                  <Pill label="In 5 days" color="#C81E2E" solid />
                  <Text style={[s.score, { color: '#fff' }]}>12:00</Text>
                </View>
                <Side logo={FRANCE} name="France" color="#fff" />
              </View>
            </View>
          ),
        },
        { key: 'h2', node: <Heading>This week</Heading> },
        {
          key: 'week',
          spot: 'Games and trainings of this week',
          node: (
            <Card>
              <Row first title="Tactical Training" sub="Mon · 17:30 · Tubeke" right={<Pill label="Training" color={training} />} />
              <Row title="Technical Training" sub="Tue · 17:30 · Tubeke" right={<Pill label="Training" color={training} />} />
              <Row title="France" sub="Sat · 12:00 · Home" right={<Pill label="Game" color={blue} />} />
            </Card>
          ),
        },
        { key: 'h3', node: <Heading>Recent results</Heading> },
        {
          key: 'results',
          spot: 'How the last games went',
          node: (
            <Card>
              <Text style={s.strong}>Friendly</Text>
              <Text style={[s.mute, { marginBottom: 6 }]}>Sat 10 Oct · Home</Text>
              <View style={s.match}>
                <Side logo={BELGIUM} name="Belgium" />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Text style={[s.score, { fontSize: 17 }]}>2 - 0</Text>
                  <Pill label="W" color={win} />
                </View>
                <Side logo={SPAIN} name="Spain" />
              </View>
            </Card>
          ),
        },
      ],
    ],
  },
  {
    since: 1,
    title: 'Selection and line-ups',
    text: 'Pick who plays or let the app make a fair selection, then build the line-up per quarter.',
    scenes: [
      [
        {
          key: 'quarters',
          spot: 'One line-up per quarter, or generate them',
          node: (
            <View style={s.chips}>
              {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => (
                <View key={q} style={[s.chip, { backgroundColor: i ? '#fff' : blue }]}>
                  <Text style={[s.pillText, { color: i ? ink : '#fff' }]}>{q}</Text>
                </View>
              ))}
              <View style={[s.chip, { backgroundColor: '#fff' }]}>
                <Ionicons name="sparkles-outline" size={11} color={blue} />
              </View>
            </View>
          ),
        },
        {
          key: 'pitch',
          spot: 'Tap a spot to place a player',
          node: (
            <View style={s.pitch}>
              {TEAM.map(([number, name, x, y]) => (
                <View key={number} style={[s.spot, { left: `${x}%`, top: `${y}%` }]}>
                  <View style={s.shirt}>
                    <Text style={s.shirtText}>{number}</Text>
                  </View>
                  <Text style={s.spotName} numberOfLines={1}>
                    {name}
                  </Text>
                </View>
              ))}
            </View>
          ),
        },
        { key: 'h1', node: <Heading>Playing time</Heading> },
        {
          key: 'minutes',
          spot: 'Everyone gets a fair share of minutes',
          node: (
            <Card>
              {MINUTES.map(([name, share, color, minutes], i) => (
                <View key={name} style={[s.row, i > 0 && s.rowLine]}>
                  <Text style={[s.text, { width: 52 }]}>{name}</Text>
                  <View style={s.track}>
                    <View style={{ height: 6, borderRadius: 3, width: `${share}%`, backgroundColor: color }} />
                  </View>
                  <Text style={[s.mute, { width: 52, textAlign: 'right' }]}>
                    {share}% · {minutes}
                  </Text>
                </View>
              ))}
            </Card>
          ),
        },
      ],
    ],
  },
  {
    since: 1,
    title: 'After the game',
    text: 'Fill in the score and goal scorers, rate the team and your players, and write your report.',
    scenes: [
      [
        { key: 'match', node: <MatchCard /> },
        {
          key: 'scores',
          spot: 'Score and goal scorers per quarter',
          node: (
            <Card>
              <Row first title="Q1   1 - 0" sub="De Bruyne" right={<Pill label="W" color={win} />} />
              <Row title="Q3   1 - 0" sub="Lukaku" right={<Pill label="W" color={win} />} />
            </Card>
          ),
        },
        { key: 'h1', node: <Heading>Game report</Heading> },
        {
          key: 'team',
          spot: 'Rate the team performance',
          node: (
            <Card style={s.inline}>
              <Badge score={4} color="#7CC576" />
              <Text style={[s.strong, { flex: 1 }]}>Dominant Team Performance</Text>
            </Card>
          ),
        },
        {
          key: 'player',
          spot: 'Rate each player and add feedback',
          node: (
            <Card style={[s.inline, { alignItems: 'flex-start' }]}>
              <Badge score={5} color="#1F5C2E" />
              <View style={{ flex: 1 }}>
                <Text style={s.strong}>De Bruyne</Text>
                <Text style={s.mute}>Brave on the ball, great pressing all game.</Text>
              </View>
            </Card>
          ),
        },
        {
          key: 'report',
          spot: 'Write what went well and what to improve',
          node: (
            <Card style={[s.inline, { justifyContent: 'center' }]}>
              <Ionicons name="create-outline" size={12} color={blue} />
              <Text style={[s.strong, { color: blue }]}>Write your report</Text>
            </Card>
          ),
        },
      ],
    ],
  },
  {
    since: 1,
    title: 'Trainings',
    text: 'See who is coming, set the themes of the session and mark who is absent.',
    scenes: [
      [
        { key: 'bar', node: <Bar title="Tactical Training" sub="Mon 12 Oct · 17:30 – 19:00 · Tubeke" /> },
        {
          key: 'tiles',
          spot: 'Who is coming, at a glance',
          node: (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[
                ['22', 'Players'],
                ['3', 'Goalkeepers'],
                ['2', 'Absent'],
              ].map(([value, label]) => (
                <View key={label} style={s.tile}>
                  <Text style={s.tileValue}>{value}</Text>
                  <Text style={s.mute}>{label}</Text>
                </View>
              ))}
            </View>
          ),
        },
        {
          key: 'pitch',
          spot: 'Where you train',
          node: (
            <Card style={[s.inline, { justifyContent: 'space-between' }]}>
              <Text style={s.text}>Pitch</Text>
              <Text style={s.strong}>Tubeke</Text>
            </Card>
          ),
        },
        { key: 'h1', node: <Heading>Training themes</Heading> },
        {
          key: 'themes',
          spot: 'The themes of this training',
          node: (
            <Card>
              <Row first title="Major" sub="Building up from the back" />
              <Row title="Minor" sub="Pressing as a team" />
            </Card>
          ),
        },
        { key: 'h2', node: <Heading>Attendance</Heading> },
        {
          key: 'attendance',
          spot: 'Tap a player to mark them absent',
          node: (
            <Card>
              <Row first title="Courtois" right={<Pill label="Present" color={win} />} />
              <Row title="Mechele" right={<Pill label="Present" color={win} />} />
              <Row title="Doku" right={<Pill label="School" color={danger} />} />
            </Card>
          ),
        },
      ],
    ],
  },
  {
    since: 1,
    title: 'Videos',
    text: 'Upload a video from your phone to a game or a training, and watch it with your fellow coaches.',
    scenes: [
      // First the game, where Videos is found…
      [
        { key: 'bar', node: <Bar title="vs Spain" sub="Sat 10 Oct · Home" /> },
        { key: 'match', node: <MatchCard /> },
        { key: 'h1', node: <Heading>Game report</Heading> },
        {
          key: 'report',
          node: (
            <View style={[s.card, s.cardTop]}>
              <View style={s.row}>
                <Badge score={4} color="#7CC576" />
                <Text style={[s.strong, { flex: 1 }]}>Dominant Team Performance</Text>
                <Chevron />
              </View>
              <View style={[s.row, s.rowLine]}>
                <View style={s.icon}>
                  <Ionicons name="people-outline" size={11} color={ink} />
                </View>
                <Text style={[s.strong, { flex: 1 }]}>Line-ups and subs</Text>
                <Chevron />
              </View>
            </View>
          ),
        },
        {
          key: 'videos',
          joined: true,
          spot: 'Open Videos in the game report',
          node: (
            <View style={[s.card, s.cardBottom]}>
              <View style={[s.row, s.rowLine]}>
                <View style={s.icon}>
                  <Ionicons name="videocam-outline" size={11} color={ink} />
                </View>
                <Text style={[s.strong, { flex: 1 }]}>
                  Videos <Text style={s.mute}>(2)</Text>
                </Text>
                <Chevron />
              </View>
            </View>
          ),
        },
        { key: 'h2', node: <Heading>Selection</Heading> },
        {
          key: 'selection',
          node: (
            <Card>
              <Row first title="Courtois" right={<Chevron />} />
            </Card>
          ),
        },
      ],
      // …then the page it opens.
      [
        { key: 'bar', node: <Bar title="Video analysis" sub="Spain · Sat 10 Oct" /> },
        {
          key: 'list',
          spot: 'Tap a video to play it in the app',
          node: (
            <Card>
              {[
                ['Goals vs Spain', '28 MB'],
                ['Build-up, second quarter', '12 MB'],
              ].map(([name, size], i) => (
                <View key={name} style={[s.row, i > 0 && s.rowLine]}>
                  <View style={s.thumb}>
                    <Ionicons name="play" size={11} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.strong}>{name}</Text>
                    <Text style={s.mute}>{size} · added today</Text>
                  </View>
                  <Ionicons name="ellipsis-horizontal" size={12} color={soft} />
                </View>
              ))}
            </Card>
          ),
        },
        { key: 'space', node: <View style={{ height: 96 }} /> },
        {
          key: 'add',
          spot: 'Upload from your phone, or add a YouTube link',
          node: (
            <View style={[s.card, s.inline, { backgroundColor: blue, justifyContent: 'center' }]}>
              <Ionicons name="add" size={13} color="#fff" />
              <Text style={[s.strong, { color: '#fff' }]}>Add video</Text>
            </View>
          ),
        },
      ],
    ],
  },
];

// The version of the tour: the highest "since" of its slides.
export const TOUR_VERSION = Math.max(...TOUR_SLIDES.map((slide) => slide.since));

// What a coach gets: everything the first time (or when asked for it again),
// else only the slides added since they last saw the tour.
export function tourSlidesFor(seen: number, all = false) {
  return all || seen <= 0 ? TOUR_SLIDES : TOUR_SLIDES.filter((slide) => slide.since > seen);
}
