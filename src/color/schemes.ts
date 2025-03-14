export type ThemeMode = 'light' | 'dark';

export const categoricalLight = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#4a3aa7',
  '#e34948',
] as const;

export const categoricalDark = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
] as const;

export const sequentialBlue = [
  '#cde2fb',
  '#9ec5f4',
  '#6da7ec',
  '#3987e5',
  '#256abf',
  '#184f95',
  '#0d366b',
] as const;

export const sequentialOrange = [
  '#fbe0d1',
  '#f7c0a4',
  '#f39f76',
  '#eb6834',
  '#c2501f',
  '#963c16',
  '#68280e',
] as const;

export const divergingBlueRed = {
  light: ['#184f95', '#3987e5', '#9ec5f4', '#f0efec', '#f0a6a5', '#e34948', '#a52d2c'],
  dark: ['#3987e5', '#6da7ec', '#b7d3f6', '#383835', '#e89998', '#e66767', '#c23a39'],
} as const;

export const statusColors = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
} as const;

export type StatusRole = keyof typeof statusColors;

export const chrome = {
  light: {
    surface: '#fcfcfb',
    plane: '#f9f9f7',
    textPrimary: '#0b0b0b',
    textSecondary: '#52514e',
    textMuted: '#898781',
    gridline: '#e1e0d9',
    axis: '#c3c2b7',
    border: 'rgba(11, 11, 11, 0.1)',
  },
  dark: {
    surface: '#1a1a19',
    plane: '#0d0d0d',
    textPrimary: '#ffffff',
    textSecondary: '#c3c2b7',
    textMuted: '#898781',
    gridline: '#2c2c2a',
    axis: '#383835',
    border: 'rgba(255, 255, 255, 0.1)',
  },
} as const;

export interface Theme {
  readonly mode: ThemeMode;
  readonly categorical: readonly string[];
  readonly sequential: readonly string[];
  readonly diverging: readonly string[];
  readonly status: Readonly<Record<StatusRole, string>>;
  readonly surface: string;
  readonly plane: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textMuted: string;
  readonly gridline: string;
  readonly axis: string;
  readonly border: string;
}

export const lightTheme: Theme = {
  mode: 'light',
  categorical: categoricalLight,
  sequential: sequentialBlue,
  diverging: divergingBlueRed.light,
  status: statusColors,
  ...chrome.light,
};

export const darkTheme: Theme = {
  mode: 'dark',
  categorical: categoricalDark,
  sequential: sequentialBlue,
  diverging: divergingBlueRed.dark,
  status: statusColors,
  ...chrome.dark,
};

export function themeFor(mode: ThemeMode): Theme {
  return mode === 'dark' ? darkTheme : lightTheme;
}

export const MAX_CATEGORICAL_SLOTS = 8;

export const ALL_PAIRS_CATEGORICAL_LIMIT = 3;

export function categoricalSlots(count: number, mode: ThemeMode = 'light'): string[] {
  const palette = mode === 'dark' ? categoricalDark : categoricalLight;
  const usable = Math.min(count, MAX_CATEGORICAL_SLOTS);
  return palette.slice(0, usable);
}

export function exceedsCategoricalCapacity(count: number): boolean {
  return count > MAX_CATEGORICAL_SLOTS;
}
