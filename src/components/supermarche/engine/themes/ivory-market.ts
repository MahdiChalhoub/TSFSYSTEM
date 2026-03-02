// ============================================================
// THEME: Ivory Market
// Vibe: Clean, minimal, Apple-like light mode
// Primary palette: Indigo on pure White
// ============================================================
import type { SupermarcheThemeTokens } from './index';

export const ivoryMarket: SupermarcheThemeTokens = {
    name: 'ivory-market',
    label: 'Ivory Market',
    description: 'Clean minimal light mode with indigo precision',
    preview: {
        bg: '#FAFAFA',
        primary: '#6366F1',
        surface: '#FFFFFF',
        text: '#0F172A',
    },
    tokens: {
        '--sm-bg': '#F1F5F9',
        '--sm-surface': '#FFFFFF',
        '--sm-surface-2': 'rgba(99, 102, 241, 0.04)',
        '--sm-surface-hover': 'rgba(99, 102, 241, 0.07)',
        '--sm-primary': '#6366F1',
        '--sm-primary-glow': 'rgba(99, 102, 241, 0.18)',
        '--sm-primary-dark': '#4F46E5',
        '--sm-accent': '#EC4899',
        '--sm-accent-glow': 'rgba(236, 72, 153, 0.15)',
        '--sm-danger': '#EF4444',
        '--sm-text': '#0F172A',
        '--sm-text-muted': '#64748B',
        '--sm-text-subtle': '#94A3B8',
        '--sm-border': 'rgba(15, 23, 42, 0.08)',
        '--sm-border-strong': 'rgba(15, 23, 42, 0.16)',
        '--sm-radius': '0.875rem',
        '--sm-radius-sm': '0.5rem',
        '--sm-radius-lg': '1.25rem',
        '--sm-font': "'Inter', 'Outfit', sans-serif",
        '--sm-font-display': "'Inter', sans-serif",
        '--sm-shadow': '0 4px 24px rgba(15, 23, 42, 0.08)',
        '--sm-shadow-sm': '0 1px 6px rgba(15, 23, 42, 0.06)',
        '--sm-shadow-glow': '0 0 20px rgba(99, 102, 241, 0.2)',
        '--sm-backdrop': 'blur(16px) saturate(200%) brightness(105%)',
        '--sm-transition': 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
        '--sm-numpad-bg': '#F8FAFC',
        '--sm-numpad-key': '#FFFFFF',
        '--sm-numpad-key-hover': '#EEF2FF',
        '--sm-category-active': '#6366F1',
        '--sm-cart-total-bg': 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
    },
};
