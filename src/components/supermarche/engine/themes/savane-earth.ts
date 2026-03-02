// ============================================================
// THEME: Savane Earth
// Vibe: Warm, West African market, natural amber + sienna
// Primary palette: Amber + Sienna on warm sand
// ============================================================
import type { SupermarcheThemeTokens } from './index';

export const savaneEarth: SupermarcheThemeTokens = {
 name: 'savane-earth',
 label: 'Savane Earth',
 description: 'Warm West African tones — amber, sienna, natural sand',
 preview: {
 bg: '#FEF3C7',
 primary: '#D97706',
 surface: '#FFFBEB',
 text: '#1C1917',
 },
 tokens: {
 '--sm-bg': '#FEF3C7',
 '--sm-surface': '#FFFBEB',
 '--sm-surface-2': 'rgba(217, 119, 6, 0.06)',
 '--sm-surface-hover': 'rgba(217, 119, 6, 0.1)',
 '--sm-primary': '#D97706',
 '--sm-primary-glow': 'rgba(217, 119, 6, 0.2)',
 '--sm-primary-dark': '#B45309',
 '--sm-accent': '#DC2626',
 '--sm-accent-glow': 'rgba(220, 38, 38, 0.15)',
 '--sm-danger': '#B91C1C',
 '--sm-text': '#1C1917',
 '--sm-text-muted': '#78716C',
 '--sm-text-subtle': '#A8A29E',
 '--sm-border': 'rgba(120, 80, 20, 0.12)',
 '--sm-border-strong': 'rgba(120, 80, 20, 0.22)',
 '--sm-radius': '1.25rem',
 '--sm-radius-sm': '0.75rem',
 '--sm-radius-lg': '2rem',
 '--sm-font': "'Outfit', sans-serif",
 '--sm-font-display': "'Playfair Display', 'Outfit', serif",
 '--sm-shadow': '0 4px 24px rgba(120, 80, 20, 0.15)',
 '--sm-shadow-sm': '0 2px 8px rgba(120, 80, 20, 0.1)',
 '--sm-shadow-glow': '0 0 24px rgba(217, 119, 6, 0.25)',
 '--sm-backdrop': 'blur(12px) saturate(140%) brightness(102%)',
 '--sm-transition': 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
 '--sm-numpad-bg': '#FDE68A',
 '--sm-numpad-key': '#FFFBEB',
 '--sm-numpad-key-hover': '#FEF3C7',
 '--sm-category-active': '#D97706',
 '--sm-cart-total-bg': 'linear-gradient(135deg, #B45309 0%, #D97706 100%)',
 },
};
