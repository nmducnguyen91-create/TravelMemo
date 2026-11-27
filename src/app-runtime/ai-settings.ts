import { create } from 'zustand';

import { DEFAULT_AI_SETTINGS, parseAiSettings, type AiSettings } from '../core/ai/ai-settings';

/**
 * The AI key is kept in this browser's localStorage only: never in SQLite, so it is not in backups and never synced.
 */
const STORAGE_KEY = 'travelmemo.ai.v1';

function load(): AiSettings {
  try {
    return parseAiSettings(globalThis.localStorage?.getItem(STORAGE_KEY) ?? null);
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export const useAiSettings = create<{ settings: AiSettings; save: (s: AiSettings) => void; forget: () => void }>((set) => ({
  settings: load(),
  save: (settings) => {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage blocked: keep for this session only.
    }
    set({ settings });
  },
  forget: () => {
    try {
      globalThis.localStorage?.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    set({ settings: DEFAULT_AI_SETTINGS });
  },
}));
