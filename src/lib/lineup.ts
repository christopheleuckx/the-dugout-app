import type { Player } from './data';
import { POSITION_GROUPS } from './selection';

export type LineupParams = {
  bestPositionOnly: boolean;
  equalTime: boolean;
  equalStarting: boolean;
  // Per quarter: may players change after 10 minutes?
  subsAllowed: boolean[];
  // Players guaranteed 75% or more of the playing time.
  highMinuteIds: string[];
};
// Player id -> field position, per quarter, at the start and after 10 minutes.
export type GeneratedQuarter = { start: Record<string, string>; after: Record<string, string> };

const SLOT_GROUPS = [['3', '4'], ['6', '10'], ['7', '11'], ['9']];
const groupOf = (code: string) => POSITION_GROUPS.find((g) => g.positions.includes(code))?.label ?? null;

// A player's "own" role: the same line (3/4, 6/10 and 7/11 each count as one
// position), or a striker covering the 10.
function isOwnRole(p: Player, code: string) {
  if (code === p.bestPosition) return true;
  const own = groupOf(p.bestPosition);
  if (own && own === groupOf(code)) return true;
  return p.bestPosition === '9' && code === '10';
}

function shuffle<T>(list: T[]) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// The web app's line-up generator (computeGeneratedLineup): each quarter is
// one shift, or two when a change after 10 minutes is allowed, and every
// position goes to the best-fitting player who is furthest behind on minutes.
export function generateLineups(squad: Player[], quarterCount: number, quarterLength: number, params: LineupParams): GeneratedQuarter[] {
  const keepers = squad.filter((p) => p.bestPosition === 'K');
  const outfield = squad.filter((p) => p.bestPosition !== 'K');

  const shifts: { quarter: number; part: 'starting' | 'after10' | 'both'; minutes: number; isStart: boolean }[] = [];
  for (let q = 0; q < quarterCount; q++) {
    const first = Math.min(10, quarterLength);
    const second = Math.max(0, quarterLength - 10);
    if (params.subsAllowed[q] && second > 0) {
      shifts.push({ quarter: q, part: 'starting', minutes: first, isStart: true });
      shifts.push({ quarter: q, part: 'after10', minutes: second, isStart: false });
    } else shifts.push({ quarter: q, part: 'both', minutes: quarterLength, isStart: true });
  }
  const total = shifts.reduce((n, s) => n + s.minutes, 0);

  // Seven outfield spots share the minutes.
  const equalShare = outfield.length ? (total * 7) / outfield.length : 0;
  const target = new Map<string, number>();
  for (const p of outfield) {
    const high = params.highMinuteIds.includes(p.id);
    target.set(p.id, params.equalTime ? Math.max(Math.min(total, equalShare), high ? total * 0.75 : 0) : total * (high ? 0.75 : 0.5));
  }

  const minutes = new Map(squad.map((p) => [p.id, 0]));
  const roles = new Map(outfield.map((p) => [p.id, new Set<string>()]));
  const started = new Set<string>();
  const behind = (p: Player) => minutes.get(p.id)! / (target.get(p.id) || 1);

  // Lower is a better fit for the position.
  const tier = (p: Player, code: string) => {
    if (isOwnRole(p, code)) return 0;
    if (!groupOf(p.bestPosition)) return 1;
    if (params.bestPositionOnly) return 3;
    if (p.developingPosition && (p.developingPosition === code || (groupOf(p.developingPosition) && groupOf(p.developingPosition) === groupOf(code)))) return 1;
    const role = groupOf(code) ?? code;
    // At most two different roles per player.
    return roles.get(p.id)!.size < 2 || roles.get(p.id)!.has(role) ? 2 : 4;
  };

  const quarters: GeneratedQuarter[] = Array.from({ length: quarterCount }, () => ({ start: {}, after: {} }));
  for (const shift of shifts) {
    const assign: Record<string, string> = {};
    const used = new Set<string>();
    if (keepers.length) {
      const keeper = keepers[shift.quarter % keepers.length];
      assign.K = keeper.id;
      used.add(keeper.id);
      minutes.set(keeper.id, minutes.get(keeper.id)! + shift.minutes);
    }
    for (const code of SLOT_GROUPS.flat()) {
      const candidates = shuffle(outfield.filter((p) => !used.has(p.id)));
      if (!candidates.length) break;
      candidates.sort((a, b) => {
        if (tier(a, code) !== tier(b, code)) return tier(a, code) - tier(b, code);
        if (shift.isStart && params.equalStarting && started.has(a.id) !== started.has(b.id)) return started.has(a.id) ? 1 : -1;
        return behind(a) - behind(b);
      });
      assign[code] = candidates[0].id;
      used.add(candidates[0].id);
    }
    for (const [code, id] of Object.entries(assign)) {
      const quarter = quarters[shift.quarter];
      if (shift.part !== 'after10') quarter.start[id] = code;
      if (shift.part !== 'starting') quarter.after[id] = code;
      if (code === 'K') continue;
      const player = outfield.find((p) => p.id === id)!;
      minutes.set(id, minutes.get(id)! + shift.minutes);
      roles.get(id)!.add(isOwnRole(player, code) ? (groupOf(player.bestPosition) ?? player.bestPosition) : (groupOf(code) ?? code));
      if (shift.isStart) started.add(id);
    }
  }
  return quarters;
}
