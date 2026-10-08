// Builds every app icon file in ../assets from one drawing.
// Run: node design/build-icons.mjs   (macOS: uses Quick Look to rasterise SVG)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { PNG } = createRequire(import.meta.url)('pngjs');
const here = dirname(fileURLToPath(import.meta.url));
const assets = join(here, '..', 'assets');
const tmp = mkdtempSync(join(tmpdir(), 'dugout-icons-'));

// The app's navy, with the red of the "next game" label for the opponent.
const NAVY = '#14306B';
const BAND = '#1B3C82';
const RED = '#F2545F';

const pitch = `
  <rect width="1024" height="1024" fill="${NAVY}"/>
  <g fill="${BAND}">
    <rect y="0" width="1024" height="128"/><rect y="256" width="1024" height="128"/>
    <rect y="512" width="1024" height="128"/><rect y="768" width="1024" height="128"/>
  </g>`;

// Opponent (X), our player (O) and the run around them, over the centre circle.
const board = (x, line) => `
  <g fill="none" stroke="${line}" stroke-opacity="0.28" stroke-width="20">
    <line x1="-600" y1="512" x2="1624" y2="512"/><circle cx="512" cy="512" r="330"/>
  </g>
  <g stroke="${x}" stroke-width="64" stroke-linecap="round">
    <line x1="300" y1="210" x2="440" y2="350"/><line x1="440" y1="210" x2="300" y2="350"/>
  </g>
  <circle cx="290" cy="730" r="92" fill="none" stroke="#FFFFFF" stroke-width="64"/>
  <g fill="none" stroke="#FFFFFF" stroke-width="64" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 500 740 C 680 730 780 570 722 352"/>
    <path d="M 640 452 L 722 352 L 836 414"/>
  </g>`;

const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`;
// Android crops adaptive icons to the middle two thirds, so the drawing is scaled down there.
const inset = (body) => `<g transform="translate(512 512) scale(0.6) translate(-512 -512)">${body}</g>`;

function render(name, markup, size = 1024) {
  const file = join(tmp, `${name}.svg`);
  writeFileSync(file, markup);
  execFileSync('qlmanage', ['-t', '-s', String(size), '-o', tmp, file], { stdio: 'ignore' });
  return PNG.sync.read(readFileSync(`${file}.png`));
}
// Opaque by default: the App Store rejects an app icon with an alpha channel.
const save = (name, png, alpha = false) =>
  writeFileSync(join(assets, name), PNG.sync.write(png, { colorType: alpha ? 6 : 2 }));

save('icon.png', render('icon', svg(pitch + board(RED, '#FFFFFF'))));
save('favicon.png', render('favicon', svg(pitch + board(RED, '#FFFFFF')), 48));
save('android-icon-background.png', render('background', svg(pitch)));
save('android-icon-foreground.png', render('foreground', svg(pitch + inset(board(RED, '#FFFFFF')))));

// Themed (monochrome) icon: white shapes whose opacity is the drawing's brightness.
const mono = render('mono', svg(`<rect width="1024" height="1024" fill="#000"/>` + inset(board('#FFFFFF', '#000000'))));
for (let i = 0; i < mono.data.length; i += 4) {
  mono.data[i + 3] = mono.data[i];
  mono.data[i] = mono.data[i + 1] = mono.data[i + 2] = 255;
}
save('android-icon-monochrome.png', mono, true);

// Splash screen: only the markings, on the splash's own dark blue (the same
// colour as its background in app.json and Splash.tsx), so no tile is visible.
const SPLASH_BG = '#0C1F4A';
save('splash-icon.png', render('splash', svg(`<rect width="1024" height="1024" fill="${SPLASH_BG}"/>` + board(RED, '#FFFFFF').replace('x1="-600"', 'x1="0"').replace('x2="1624"', 'x2="1024"'))));

writeFileSync(join(here, 'app-icon.svg'), svg(pitch + board(RED, '#FFFFFF')));
console.log('icons written to', assets);
