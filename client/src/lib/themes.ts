import type { BrandTheme, Brand } from '@asb/shared';

// ───────────────────────────────────────────
// Brand themes (runtime switchable).
// Apply by setting CSS variables on :root — see applyTheme() below.
// ───────────────────────────────────────────

export const THEMES: Record<Brand, BrandTheme> = {
  google: {
    id: 'google',
    logoUrl: '/logos/google-summit.svg',
    headerTitle: {
      'zh-CN': 'Google Summit | Build Your Business System with AI',
      'zh-HK': 'Google Summit | Build Your Business System with AI',
      en: 'Google Summit | Build Your Business System with AI',
      ja: 'Google Summit | Build Your Business System with AI',
    },
    accent: '#3b82f6', // blue-500
    accentMuted: 'rgba(59,130,246,0.40)',
  },
  aws: {
    id: 'aws',
    logoUrl: '/logos/aws-summit.svg',
    headerTitle: {
      'zh-CN': 'AWS Summit | Build Your Business System with AI',
      'zh-HK': 'AWS Summit | Build Your Business System with AI',
      en: 'AWS Summit | Build Your Business System with AI',
      ja: 'AWS Summit | Build Your Business System with AI',
    },
    accent: '#ff9900', // AWS orange
    accentMuted: 'rgba(255,153,0,0.40)',
  },
};

export function applyTheme(brand: Brand): void {
  const theme = THEMES[brand];
  const root = document.documentElement;
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--accent-muted', theme.accentMuted);
  root.dataset.brand = brand;
}
