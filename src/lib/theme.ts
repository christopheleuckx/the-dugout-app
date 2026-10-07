import { useColorScheme } from 'react-native';

// Mirrors the :root colour tokens of the web app, light and dark.
const light = {
  pitch: '#1E4289',
  pitchStrong: '#14306B',
  ink: '#101828',
  inkSoft: '#5A6578',
  chalk: '#F3F5F9',
  surface: '#FFFFFF',
  surface2: '#EAEFF6',
  line: '#E0E5EE',
  amber: '#B8722A',
  danger: '#B5473F',
  win: '#1F8A4C',
  teamBlue: '#2E86DE',
  teamRed: '#C81E2E',
  training: '#1E7D82',
  onPitch: '#FFFFFF',
  calGameBg: '#DCEAFB',
};

const dark: typeof light = {
  pitch: '#6690E0',
  pitchStrong: '#9CC0FF',
  ink: '#E7ECF5',
  inkSoft: '#96A2B9',
  chalk: '#0A101B',
  surface: '#121A29',
  surface2: '#1A2436',
  line: '#233045',
  amber: '#E0954D',
  danger: '#D97A72',
  win: '#5CC58A',
  teamBlue: '#5CA8F2',
  teamRed: '#E2707A',
  training: '#4FC4C9',
  onPitch: '#0A101B',
  calGameBg: '#1A2A45',
};

export type Colors = typeof light;

// The navy shell behind the login screen and headers is the same in both themes.
export const shell = {
  bg: '#131A26',
  bg2: '#1A2438',
  border: '#262F42',
  text: '#E7ECF5',
  textSoft: '#93A2BE',
  active: '#1E4289',
};

export const fonts = {
  display: 'BarlowCondensed_700Bold',
  displaySemi: 'BarlowCondensed_600SemiBold',
};

export const radius = 14;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}
