import { useColorScheme } from 'react-native';

import { palette, type ThemeColors } from './tokens';

export interface Theme {
  readonly scheme: 'light' | 'dark';
  readonly colors: ThemeColors;
}

export function useTheme(): Theme {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: palette[scheme] };
}
