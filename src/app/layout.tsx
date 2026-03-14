import type { Metadata } from "next";
import { Outfit } from 'next/font/google';
import "./globals.css";

const outfit = Outfit({ subsets: ['latin'] });

import { PLATFORM_CONFIG } from "@/lib/branding";

export const metadata: Metadata = {
  title: `${PLATFORM_CONFIG.name} | Global System`,
  description: "Multi-Tenant Enterprise OS",
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        {/* ⚡ Synchronous theme injection — MUST be first in <head> to prevent flash */}
        <script dangerouslySetInnerHTML={{
          __html: `
(function(){
  try {
    var s = localStorage.getItem('unified-theme-preference');
    if (!s) return;
    var d = JSON.parse(s);
    var t = d.currentTheme;
    var m = d.colorMode || 'dark';
    if (!t) return;
    // presetData is camelCase (as saved by UnifiedThemeEngine)
    var pd = t.presetData;
    if (!pd || !pd.colors) return;
    var c = pd.colors[m] || pd.colors.dark || {};
    var r = document.documentElement.style;
    // ── Core colors ──
    r.setProperty('--app-primary', c.primary || '#10B981');
    r.setProperty('--app-primary-dark', c.primaryDark || '#059669');
    r.setProperty('--app-primary-light', c.primary ? c.primary + '1f' : 'rgba(16,185,129,0.12)');
    r.setProperty('--app-primary-glow', c.primary ? c.primary + '59' : 'rgba(16,185,129,0.35)');
    r.setProperty('--app-bg', c.bg || '#020617');
    r.setProperty('--app-surface', c.surface || '#0F172A');
    r.setProperty('--app-surface-2', c.surface || '#0F172A');
    r.setProperty('--app-surface-hover', c.surfaceHover || 'rgba(255,255,255,0.07)');
    r.setProperty('--app-text', c.text || '#F1F5F9');
    r.setProperty('--app-text-muted', c.textMuted || '#94A3B8');
    r.setProperty('--app-text-faint', c.textMuted || '#94A3B8');
    r.setProperty('--app-border', c.border || 'rgba(255,255,255,0.08)');
    r.setProperty('--app-border-strong', c.border || 'rgba(255,255,255,0.08)');
    // ── Sidebar ──
    r.setProperty('--app-sidebar-bg', c.surface || '#0F172A');
    r.setProperty('--app-sidebar-surface', c.surface || '#0F172A');
    r.setProperty('--app-sidebar-text', c.text || '#F1F5F9');
    r.setProperty('--app-sidebar-muted', c.textMuted || '#94A3B8');
    r.setProperty('--app-sidebar-active', c.primary || '#10B981');
    r.setProperty('--app-sidebar-border', c.border || 'rgba(255,255,255,0.08)');
    // ── Status ──
    r.setProperty('--app-success', c.success || '#10B981');
    r.setProperty('--app-warning', c.warning || '#F59E0B');
    r.setProperty('--app-error', c.error || '#EF4444');
    r.setProperty('--app-info', '#3B82F6');
    // ── Components ──
    var comp = pd.components || {};
    if (comp.cards) {
      r.setProperty('--card-radius', comp.cards.borderRadius || '0.625rem');
      r.setProperty('--card-shadow', comp.cards.shadow || '0 1px 3px rgba(0,0,0,0.08)');
      r.setProperty('--card-padding', comp.cards.padding || '1rem');
    }
    if (comp.buttons) {
      r.setProperty('--button-radius', comp.buttons.borderRadius || '0.5rem');
      r.setProperty('--button-height', comp.buttons.height || '2.5rem');
    }
    if (comp.inputs) {
      r.setProperty('--input-radius', comp.inputs.borderRadius || '0.5rem');
      r.setProperty('--input-height', comp.inputs.height || '2.5rem');
    }
    if (comp.typography) {
      r.setProperty('--font-heading', comp.typography.headingFont || 'Inter, sans-serif');
      r.setProperty('--font-body', comp.typography.bodyFont || 'Inter, sans-serif');
      r.setProperty('--font-size-h1', comp.typography.h1Size || '2rem');
      r.setProperty('--font-size-body', comp.typography.bodySize || '0.875rem');
    }
    // ── Layout ──
    var lay = pd.layout || {};
    if (lay.spacing) {
      r.setProperty('--layout-container-padding', lay.spacing.container || '1.5rem');
      r.setProperty('--layout-card-padding', lay.spacing.card || '1.25rem');
      r.setProperty('--layout-element-gap', lay.spacing.element || '0.875rem');
    }
    // ── Data attributes for CSS targeting ──
    var root = document.documentElement;
    if (t.slug) root.setAttribute('data-theme', t.slug);
    root.setAttribute('data-color-mode', m);
    if (lay.density) root.setAttribute('data-layout-density', lay.density);
  } catch(e) {}
})();
                    `
        }} />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#10B981" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="TSFSYSTEM" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={outfit.className}>
        {children}
        <script dangerouslySetInnerHTML={{
          __html: `
 if ('serviceWorker' in navigator) {
 window.addEventListener('load', function() {
 navigator.serviceWorker.register('/sw.js').then(function(reg) {
 console.log('[SW] Registered:', reg.scope);
 }).catch(function(err) {
 console.warn('[SW] Registration failed:', err);
 });
 });
 }
 `}} />
      </body>
    </html>
  );
}
