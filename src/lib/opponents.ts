// Finding opponents that are probably the same club under two spellings
// ("AA Gent" and "KAA Gent"), to suggest them for a merge.

// The short club-type words in front of or behind a name, which differ most
// between two spellings of the same club.
const TYPE_WORDS = new Set([
  'k', 'r', 'kaa', 'aa', 'fc', 'kfc', 'rfc', 'sk', 'ksk', 'vk', 'kvk', 'sv', 'ksv', 'rsc', 'sc', 'ksc', 'vc', 'kvc',
  'krc', 'rc', 'kv', 'tk', 'vv', 'kvv', 'raec', 'rwd', 'kho', 'united', 'utd',
]);

// A name reduced to what identifies the club: no capitals, accents,
// punctuation or club-type words.
export function coreName(name: string) {
  const words = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  const core = words.filter((w) => !TYPE_WORDS.has(w));
  return (core.length ? core : words).join(' ');
}

// How many letters have to change to turn one word into the other.
function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const keep = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = keep;
    }
  }
  return row[b.length];
}

// Lower is more alike; null when the two names don't look like the same club.
export function likeness(a: string, b: string): number | null {
  const x = coreName(a);
  const y = coreName(b);
  if (!x || !y) return null;
  if (x === y) return 0;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  // One name inside the other, as whole words: "Gent" in "Gent Zeehaven".
  if (short.length >= 4 && ` ${long} `.includes(` ${short} `)) return 1;
  const typos = distance(x, y);
  return typos <= Math.max(1, Math.floor(short.length / 5)) ? 1 + typos : null;
}

export function lookAlikes<T extends { id: string; name: string }>(of: T, all: T[]): T[] {
  return all
    .filter((other) => other.id !== of.id)
    .map((other) => ({ other, score: likeness(of.name, other.name) }))
    .filter((r): r is { other: T; score: number } => r.score !== null)
    .sort((a, b) => a.score - b.score || a.other.name.localeCompare(b.other.name))
    .map((r) => r.other);
}
