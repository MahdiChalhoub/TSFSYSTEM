// ============================================================
// THEME: Neon Rush
// Vibe: Cyberpunk, high energy, violet + cyan glows
// Primary palette: Violet + Cyan on near-black
// ============================================================
import type { SupermarcheThemeTokens } from './index';

export const neonRush: SupermarcheThemeTokens = {
 name: 'neon-rush',
 label: 'Neon Rush',
 description: 'Cyberpunk energy — violet glows on near-black',
 preview: {
 bg: '#09090B',
 primary: '#8B5CF6',
 surface: '#111113',
 text: '#FAFAFA',
 },
 tokens: {
 '--sm-bg': '#09090B',
 '--sm-surface': '#111113',
 '--sm-surface-2': 'rgba(139, 92, 246, 0.06)',
 '--sm-surface-hover': 'rgba(139, 92, 246, 0.1)',
 '--sm-primary': '#8B5CF6',
 '--sm-primary-glow': 'rgba(139, 92, 246, 0.35)',
 '--sm-primary-dark': '#7C3AED',
 '--sm-accent': '#22D3EE',
 '--sm-accent-glow': 'rgba(34, 211, 238, 0.25)',
 '--sm-danger': '#FF4D6D',
 '--sm-text': '#FAFAFA',
 '--sm-text-muted': '#A1A1AA',
 '--sm-text-subtle': '#52525B',
 '--sm-border': 'rgba(139, 92, 246, 0.15)',
 '--sm-border-strong': 'rgba(139, 92, 246, 0.3)',
 '--sm-radius': '0.5rem',
 '--sm-radius-sm': '0.25rem',
 '--sm-radius-lg': '0.75rem',
 '--sm-font': "'Rajdhani', 'Outfit', sans-serif",
 '--sm-font-display': "'Rajdhani', sans-serif",
 '--sm-shadow': '0 8px 40px rgba(0, 0, 0, 0.8)',
 '--sm-shadow-sm': '0 2px 12px rgba(0, 0, 0, 0.6)',
 '--sm-shadow-glow': '0 0 32px rgba(139, 92, 246, 0.4)',
 '--sm-backdrop': 'blur(20px) saturate(160%)',
 '--sm-transition': 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
 '--sm-numpad-bg': '#0A0A0D',
 '--sm-numpad-key': '#1A1A1F',
 '--sm-numpad-key-hover': '#2A1F4A',
 '--sm-category-active': '#8B5CF6',
 '--sm-cart-total-bg': 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 50%, #22D3EE 100%)',
 },
};
