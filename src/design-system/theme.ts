import { useColorScheme } from 'react-native';
import { create } from 'zustand';

import { palette, type ThemeColors } from './tokens';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Theme {
  readonly scheme: 'light' | 'dark';
  readonly colors: ThemeColors;
}

const STORAGE_KEY = 'travelmemo.theme';

function readPreference(): ThemePreference {
  try {
    const v = globalThis.localStorage?.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

/** Device-only display preference (not part of the travel archive, never synced). */
export const useThemePreference = create<{ preference: ThemePreference; setPreference: (p: ThemePreference) => void }>((set) => ({
  preference: readPreference(),
  setPreference: (preference) => {
    try {
      if (preference === 'system') globalThis.localStorage?.removeItem(STORAGE_KEY);
      else globalThis.localStorage?.setItem(STORAGE_KEY, preference);
    } catch {
      // Storage blocked (private mode): the choice still applies for this session.
    }
    set({ preference });
  },
}));

export function useTheme(): Theme {
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  const preference = useThemePreference((s) => s.preference);
  const scheme = preference === 'system' ? system : preference;
  return { scheme, colors: palette[scheme] };
}
