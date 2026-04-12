// @ts-nocheck
'use client';

import React, { useState } from 'react';
import { useAppTheme, APP_THEMES } from './AppThemeProvider';
import type { AppThemeName, AppThemeInfo } from './AppThemeProvider';
import { Check, Palette, X, Lock } from 'lucide-react';
import { useHasPermission, PERMISSIONS } from '@/hooks/use-permissions';

// ── Mini swatch preview component ───────────────────────────────
function ThemeCard({
 info,
 isActive,
 onClick,
}: {
 info: AppThemeInfo;
 isActive: boolean;
 onClick: () => void;
}) {
 return (
 <button
 onClick={onClick}
 aria-label={`Switch to ${info.label} theme`}
 className="relative flex flex-col gap-2 rounded-xl p-3 border transition-all duration-200 text-left w-full"
 style={{
 background: info.bg,
 borderColor: isActive ? info.primary : 'rgba(128,128,128,0.2)',
 boxShadow: isActive
 ? `0 0 0 2px ${info.primary}33, 0 4px 16px rgba(0,0,0,0.2)`
 : '0 1px 4px rgba(0,0,0,0.1)',
 transform: isActive ? 'scale(1.02)' : 'scale(1)',
 }}
 >
 {/* Gradient preview strip */}
 <div
 className="w-full h-12 rounded-lg"
 style={{
 background: info.previewGradient,
 opacity: 0.9,
 }}
 />

 {/* Theme name */}
 <div className="flex items-center justify-between gap-1">
 <div>
 <p
 className="text-xs font-black tracking-tight leading-tight"
 style={{ color: info.primary }}
 >
 {info.label}
 </p>
 <p className="text-[10px] font-medium opacity-60 leading-tight" style={{ color: info.primary }}>
 {info.description}
 </p>
 </div>
 {isActive && (
 <div
 className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
 style={{ background: info.primary }}
 >
 <Check size={11} color="#fff" strokeWidth={3} />
 </div>
 )}
 </div>

 {/* Mode badge */}
 <span
 className="absolute top-2 right-2 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
 style={{
 background: info.mode === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)',
 color: info.primary,
 }}
 >
 {info.mode}
 </span>
 </button>
 );
}

// ── Full theme selector panel ────────────────────────────────────
export function AppThemeSelector({ onClose }: { onClose?: () => void }) {
 const { theme, setTheme, themes } = useAppTheme();
 const canChangeTheme = useHasPermission(PERMISSIONS.APP.CHANGE_THEME);

 // If the user doesn't have permission, hide the selector entirely
 if (!canChangeTheme) return null;

 return (
 <div
 className="app-glass rounded-2xl p-4 w-72"
 style={{ border: '1px solid var(--app-border)' }}
 >
 {/* Header */}
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <div
 className="w-7 h-7 rounded-lg flex items-center justify-center"
 style={{ background: 'var(--app-primary-light)' }}
 >
 <Palette size={14} style={{ color: 'var(--app-primary)' }} />
 </div>
 <span
 className="text-sm font-black tracking-tight"
 style={{ color: 'var(--app-text)' }}
 >
 UI Theme
 </span>
 </div>
 {onClose && (
 <button
 onClick={onClose}
 className="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
 style={{
 background: 'var(--app-surface-2)',
 color: 'var(--app-text-muted)',
 }}
 >
 <X size={12} />
 </button>
 )}
 </div>

 {/* Theme grid */}
 <div className="grid grid-cols-2 gap-2">
 {themes.map((info) => (
 <ThemeCard
 key={info.name}
 info={info}
 isActive={theme === info.name}
 onClick={() => setTheme(info.name)}
 />
 ))}
 </div>

 {/* Footer hint */}
 <p
 className="text-[10px] font-medium text-center mt-3"
 style={{ color: 'var(--app-text-faint)' }}
 >
 Theme is saved automatically
 </p>
 </div>
 );
}

// ── Compact trigger button (for sidebar footer) ──────────────────
export function AppThemeTrigger() {
 const [open, setOpen] = useState(false);
 const { themeInfo } = useAppTheme();
 const canChangeTheme = useHasPermission(PERMISSIONS.APP.CHANGE_THEME);

 // If no permission: show a read-only locked indicator (no popover)
 if (!canChangeTheme) {
 return (
 <div
 className="flex items-center gap-2 px-3 py-2 rounded-xl w-full opacity-60 cursor-not-allowed"
 style={{
 border: '1px solid var(--app-border)',
 color: 'var(--app-sidebar-text)',
 }}
 title="Theme change requires app.change_theme permission"
 >
 <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: themeInfo.primary }} />
 <span className="text-xs font-semibold truncate flex-1 text-left">{themeInfo.label}</span>
 <Lock size={12} style={{ color: 'var(--app-sidebar-muted)' }} />
 </div>
 );
 }

 return (
 <div className="relative">
 <button
 onClick={() => setOpen((p) => !p)}
 className="flex items-center gap-2 px-3 py-2 rounded-xl w-full transition-all duration-200"
 style={{
 background: open ? 'var(--app-primary-light)' : 'transparent',
 border: '1px solid var(--app-border)',
 color: 'var(--app-sidebar-text)',
 }}
 aria-label="Open theme selector"
 >
 {/* Color swatch */}
 <div
 className="w-4 h-4 rounded-full flex-shrink-0"
 style={{ background: themeInfo.primary }}
 />
 <span className="text-xs font-semibold truncate flex-1 text-left">
 {themeInfo.label}
 </span>
 <Palette size={14} style={{ color: 'var(--app-sidebar-muted)' }} />
 </button>

 {/* Popover */}
 {open && (
 <div className="absolute bottom-full mb-2 left-0 z-50 animate-slide-up">
 <AppThemeSelector onClose={() => setOpen(false)} />
 </div>
 )}
 </div>
 );
}
