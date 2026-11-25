/** Semantic tokens mirroring specs/design-tokens.json. Components must use these, never raw hex. */
export const brand = {
  forest: '#173B34',
  paper: '#F5F0E5',
  sand: '#D5C6AE',
  ink: '#252824',
  sage: '#779B94',
  clay: '#A86C4C',
} as const;

export interface ThemeColors {
  readonly background: string;
  readonly surface: string;
  readonly text: string;
  readonly secondary: string;
  readonly primary: string;
  readonly onPrimary: string;
  readonly border: string;
  readonly error: string;
  /** Atlas fill for regions with a confirmed visit. */
  readonly visited: string;
  /** Atlas fill for regions without a confirmed visit. */
  readonly unvisited: string;
  readonly accent: string;
}

export const palette: { readonly light: ThemeColors; readonly dark: ThemeColors } = {
  light: {
    background: '#F8F7F3',
    surface: '#FFFFFF',
    text: '#252824',
    secondary: '#626A63',
    primary: '#173B34',
    onPrimary: '#F5F0E5',
    border: '#DEDCD3',
    error: '#A33D3D',
    visited: '#779B94',
    unvisited: '#E9E4D8',
    accent: '#A86C4C',
  },
  dark: {
    background: '#101714',
    surface: '#1B2420',
    text: '#F5F0E5',
    secondary: '#A9B4AC',
    primary: '#9CBDB0',
    onPrimary: '#101714',
    border: '#35413B',
    error: '#E49A94',
    visited: '#5F8A80',
    unvisited: '#26302B',
    accent: '#D29B7C',
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const touchTarget = 44;

export const typography = {
  display: { fontSize: 30, fontWeight: '700', lineHeight: 36 },
  title: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  heading: { fontSize: 17, fontWeight: '600', lineHeight: 22 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
} as const;
