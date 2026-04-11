// ============================================================
// THEME: Midnight Pro
// Vibe: Dark luxury, emerald glow, glassmorphism
// Primary palette: Emerald on Slate-950
// ============================================================
import type { SupermarcheThemeTokens } from './index';

export const midnightPro: SupermarcheThemeTokens = {
 name: 'midnight-pro',
 label: 'Midnight Pro',
 description: 'Dark luxury with emerald glass accents',
 preview: {
 bg: '#020617',
 primary: '#10B981',
 surface: '#0F172A',
 text: '#F1F5F9',
 },
 tokens: {
 '--sm-bg': '#020617',
 '--sm-surface': '#0F172A',
 '--sm-surface-2': 'rgba(255, 255, 255, 0.04)',
 '--sm-surface-hover': 'rgba(255, 255, 255, 0.07)',
 '--sm-primary': '#10B981',
 '--sm-primary-glow': 'rgba(16, 185, 129, 0.25)',
 '--sm-primary-dark': '#059669',
 '--sm-accent': '#F59E0B',
 '--sm-accent-glow': 'rgba(245, 158, 11, 0.2)',
 '--sm-danger': '#EF4444',
 '--sm-text': '#F1F5F9',
 '--sm-text-muted': '#94A3B8',
 '--sm-text-subtle': '#475569',
 '--sm-border': 'rgba(255, 255, 255, 0.07)',
 '--sm-border-strong': 'rgba(255, 255, 255, 0.14)',
 '--sm-radius': '1rem',
 '--sm-radius-sm': '0.625rem',
 '--sm-radius-lg': '1.5rem',
 '--sm-font': "'Outfit', sans-serif",
 '--sm-font-display': "'Outfit', sans-serif",
 '--sm-shadow': '0 8px 40px rgba(0, 0, 0, 0.7)',
 '--sm-shadow-sm': '0 2px 12px rgba(0, 0, 0, 0.5)',
 '--sm-shadow-glow': '0 0 28px rgba(16, 185, 129, 0.3)',
 '--sm-backdrop': 'blur(24px) saturate(180%)',
 '--sm-transition': 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
 '--sm-numpad-bg': '#0A1628',
 '--sm-numpad-key': '#1E293B',
 '--sm-numpad-key-hover': '#1E3A5F',
 '--sm-category-active': '#10B981',
 '--sm-cart-total-bg': 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
 },
};
