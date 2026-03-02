// ============================================================
// THEME: Arctic Glass
// Vibe: Ultra-modern, cold blue frosted glassmorphism
// Primary palette: Sky blue on frosted white
// ============================================================
import type { SupermarcheThemeTokens } from './index';

export const arcticGlass: SupermarcheThemeTokens = {
    name: 'arctic-glass',
    label: 'Arctic Glass',
    description: 'Ultra-modern frosted glass with cold sky tones',
    preview: {
        bg: '#F0F9FF',
        primary: '#0EA5E9',
        surface: 'rgba(255,255,255,0.7)',
        text: '#0C1A2E',
    },
    tokens: {
        '--sm-bg': 'linear-gradient(135deg, #E0F2FE 0%, #F0F9FF 50%, #EFF6FF 100%)',
        '--sm-surface': 'rgba(255, 255, 255, 0.65)',
        '--sm-surface-2': 'rgba(14, 165, 233, 0.06)',
        '--sm-surface-hover': 'rgba(14, 165, 233, 0.1)',
        '--sm-primary': '#0EA5E9',
        '--sm-primary-glow': 'rgba(14, 165, 233, 0.22)',
        '--sm-primary-dark': '#0284C7',
        '--sm-accent': '#6366F1',
        '--sm-accent-glow': 'rgba(99, 102, 241, 0.18)',
        '--sm-danger': '#EF4444',
        '--sm-text': '#0C1A2E',
        '--sm-text-muted': '#4B6280',
        '--sm-text-subtle': '#8BA3BF',
        '--sm-border': 'rgba(14, 165, 233, 0.15)',
        '--sm-border-strong': 'rgba(14, 165, 233, 0.28)',
        '--sm-radius': '1.125rem',
        '--sm-radius-sm': '0.625rem',
        '--sm-radius-lg': '1.75rem',
        '--sm-font': "'Sora', 'Outfit', sans-serif",
        '--sm-font-display': "'Sora', sans-serif",
        '--sm-shadow': '0 8px 32px rgba(14, 165, 233, 0.12)',
        '--sm-shadow-sm': '0 2px 10px rgba(14, 165, 233, 0.08)',
        '--sm-shadow-glow': '0 0 28px rgba(14, 165, 233, 0.25)',
        '--sm-backdrop': 'blur(28px) saturate(200%) brightness(108%)',
        '--sm-transition': 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        '--sm-numpad-bg': 'rgba(224, 242, 254, 0.8)',
        '--sm-numpad-key': 'rgba(255, 255, 255, 0.7)',
        '--sm-numpad-key-hover': 'rgba(224, 242, 254, 0.95)',
        '--sm-category-active': '#0EA5E9',
        '--sm-cart-total-bg': 'linear-gradient(135deg, #0284C7 0%, #0EA5E9 100%)',
    },
};
