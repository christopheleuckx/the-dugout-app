// The game formats: which positions stand on the pitch and where (percent of
// width and height, our goal at the bottom). 8v8 is the web app's pitch.
export type Format = '8v8' | '9v9' | '11v11';
type Spot = { x: number; y: number };

export const FORMATS: Format[] = ['8v8', '9v9', '11v11'];
export const asFormat = (value: unknown): Format => (FORMATS.includes(value as Format) ? (value as Format) : '8v8');

const COORDS: Record<Format, Record<string, Spot>> = {
  '8v8': {
    K: { x: 50, y: 90 },
    '3': { x: 62, y: 62 },
    '4': { x: 38, y: 62 },
    '6': { x: 60, y: 40 },
    '10': { x: 40, y: 40 },
    '7': { x: 72, y: 22 },
    '11': { x: 28, y: 22 },
    '9': { x: 50, y: 9 },
  },
  '9v9': {
    K: { x: 50, y: 90 },
    '2': { x: 80, y: 62 },
    '3': { x: 50, y: 66 },
    '5': { x: 20, y: 62 },
    '6': { x: 62, y: 43 },
    '10': { x: 38, y: 43 },
    '7': { x: 80, y: 23 },
    '11': { x: 20, y: 23 },
    '9': { x: 50, y: 10 },
  },
  '11v11': {
    K: { x: 50, y: 91 },
    '2': { x: 85, y: 66 },
    '3': { x: 62, y: 72 },
    '4': { x: 38, y: 72 },
    '5': { x: 15, y: 66 },
    '6': { x: 50, y: 54 },
    '8': { x: 70, y: 40 },
    '10': { x: 30, y: 40 },
    '7': { x: 83, y: 20 },
    '11': { x: 17, y: 20 },
    '9': { x: 50, y: 10 },
  },
};

// Back to front, as the positions are listed everywhere.
const ORDER: Record<Format, string[]> = {
  '8v8': ['K', '3', '4', '6', '10', '7', '11', '9'],
  '9v9': ['K', '2', '3', '5', '6', '10', '7', '11', '9'],
  '11v11': ['K', '2', '3', '4', '5', '6', '8', '10', '7', '11', '9'],
};

// An unknown or missing format draws the 8v8 pitch.
export const positionsOf = (format: Format) => ORDER[asFormat(format)];
export const coordsOf = (format: Format) => COORDS[asFormat(format)];
// A position of any format; everything else is the bench.
export const onPitch = (position: string) => FORMATS.some((f) => position in COORDS[f]);
