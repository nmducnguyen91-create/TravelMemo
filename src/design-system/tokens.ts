/** Mirrors specs/design-tokens.json. Full theme system arrives in S01-01. */
export const palette = {
  light: {
    background: '#F8F7F3',
    surface: '#FFFFFF',
    text: '#252824',
    secondary: '#626A63',
    primary: '#173B34',
    border: '#DEDCD3',
    error: '#A33D3D',
  },
  dark: {
    background: '#101714',
    surface: '#1B2420',
    text: '#F5F0E5',
    secondary: '#A9B4AC',
    primary: '#9CBDB0',
    border: '#35413B',
    error: '#E49A94',
  },
} as const;

export type ThemeColors = (typeof palette)['light'];

export const spacing = [4, 8, 12, 16, 20, 24, 32, 40] as const;
export const radius = [8, 12, 16, 20, 28] as const;
export const touchTarget = 44;
