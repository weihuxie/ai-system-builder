import { create } from 'zustand';
import type { Brand, Lang, Solution } from '@asb/shared';

// ───────────────────────────────────────────
// Global UI state (non-persisted; server is source of truth for data)
//   - lang / brand: display config (lang echoed to localStorage so reload keeps pick)
//   - userInput: current textarea content (lifted to store so MicButton can write into it
//                without prop drilling)
//   - solution: last successful AI output (kept after generate so user can re-read while
//               scrolling; cleared when they type a new query)
// ───────────────────────────────────────────

interface AppStore {
  lang: Lang;
  brand: Brand;
  userInput: string;
  solution: Solution | null;

  setLang: (lang: Lang) => void;
  setBrand: (brand: Brand) => void;
  setUserInput: (v: string) => void;
  setSolution: (s: Solution | null) => void;
  resetForNewQuery: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  lang: 'zh-CN',
  brand: 'google',
  userInput: '',
  solution: null,

  setLang: (lang) => {
    try {
      localStorage.setItem('asb.lang', lang);
    } catch {
      // ignore SecurityError in private mode
    }
    set({ lang });
  },
  setBrand: (brand) => set({ brand }),
  setUserInput: (userInput) => set({ userInput }),
  setSolution: (solution) => set({ solution }),
  resetForNewQuery: () => set({ solution: null }),
}));
