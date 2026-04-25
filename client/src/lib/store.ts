import { create } from 'zustand';
import type { Brand, GenerateResponse, Lang } from '@asb/shared';

// ───────────────────────────────────────────
// Global UI state (non-persisted; server is source of truth for data)
//   - lang / brand: display config (lang echoed to localStorage so reload keeps pick)
//   - userInput: current textarea content (lifted to store so MicButton can write into it
//                without prop drilling)
//   - solution: last successful AI output + meta (provider/model/latency).
//               Stored as GenerateResponse (not just Solution) so RecommendationGrid
//               can display "by <model> · 1.2s" subtitle for transparency.
//               Cleared when user types a new query.
// ───────────────────────────────────────────

interface AppStore {
  lang: Lang;
  brand: Brand;
  userInput: string;
  solution: GenerateResponse | null;

  setLang: (lang: Lang) => void;
  setBrand: (brand: Brand) => void;
  setUserInput: (v: string) => void;
  setSolution: (s: GenerateResponse | null) => void;
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
