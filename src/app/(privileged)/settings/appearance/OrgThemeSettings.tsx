'use client';
/**
 * OrgThemeSettings — /settings/appearance client component
 * Allows org admins to set a default theme for all users.
 * Uses Unified Theme Engine (backend-driven with 20 presets)
 */

import { useState, useTransition } from 'react';
import { useUnifiedThemeEngine } from '@/contexts/UnifiedThemeEngine';
import type { ThemePreset, ColorMode } from '@/types/theme';
import { setOrgDefaultTheme } from '@/app/actions/settings/theme';
import { useHasPermission, PERMISSIONS } from '@/hooks/use-permissions';
import { Check, Building2, Palette, RotateCcw, Loader2, AlertCircle } from 'lucide-react';

// ── Mini theme card ──────────────────────────────────────────────────────────
function OrgThemeCard({
  theme,
  isOrgDefault,
  isUserTheme,
  colorMode,
  onSelect,
}: {
  theme: ThemePreset;
  isOrgDefault: boolean;
  isUserTheme: boolean;
  colorMode: ColorMode;
  onSelect: () => void;
}) {
  const mode = colorMode === 'auto' ? 'dark' : colorMode;
  const colors = theme.presetData?.colors?.[mode] ?? {
    primary: '#6366F1', primaryDark: '#4F46E5', bg: '#020617',
    surface: '#0F172A', surfaceHover: 'rgba(255,255,255,0.07)',
    text: '#F1F5F9', textMuted: '#94A3B8', border: 'rgba(255,255,255,0.08)',
  };

  return (
    <button
      onClick={onSelect}
      aria-label={`Set ${theme.name} as org default theme`}
      className="relative flex flex-col gap-2 rounded-xl p-3 border transition-all duration-200 text-left w-full hover:scale-105"
      style={{
        background: colors.surface,
        borderColor: isOrgDefault ? colors.primary : colors.border,
        boxShadow: isOrgDefault
          ? `0 0 0 2px ${colors.primary}44, 0 4px 20px ${colors.border}`
          : `0 1px 4px ${colors.border}`,
        transform: isOrgDefault ? 'scale(1.03)' : 'scale(1)',
      }}
    >
      {/* Preview strip with gradient */}
      <div
        className="w-full h-12 rounded-lg"
        style={{
          background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 50%, ${colors.accent || colors.primary} 100%)`,
          opacity: 0.9,
        }}
      />

      {/* Labels */}
      <div className="flex items-center justify-between gap-1">
        <div>
          <p className="text-xs font-black tracking-tight leading-tight" style={{ color: colors.text }}>
            {theme.name}
          </p>
          <p className="text-[10px] font-medium opacity-60 leading-tight" style={{ color: colors.textMuted }}>
            {theme.description || theme.category}
          </p>
        </div>
        {isOrgDefault && (
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: colors.primary }}
          >
            <Check size={11} color="#fff" strokeWidth={3} />
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="flex gap-1 flex-wrap">
        {isOrgDefault && (
          <span
            className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full flex items-center gap-1"
            style={{ background: colors.primary + '22', color: colors.primary }}
          >
            <Building2 size={8} /> Org Default
          </span>
        )}
        {isUserTheme && (
          <span
            className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
            style={{ background: colors.border, color: colors.primary }}
          >
            Your Theme
          </span>
        )}
        <span
          className="absolute top-2 right-2 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
          style={{
            background: colors.surface,
            color: colors.primary,
            border: `1px solid ${colors.border}`,
          }}
        >
          {theme.category}
        </span>
      </div>
    </button>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function OrgThemeSettings({ currentOrgDefault }: { currentOrgDefault: string | null }) {
  const { currentTheme, colorMode, systemThemes, setTheme } = useUnifiedThemeEngine();
  const canManage = useHasPermission(PERMISSIONS.APP.CHANGE_THEME);
  const [orgDefault, setOrgDefault] = useState<string | null>(currentOrgDefault);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  function handleSelect(slug: string) {
    if (!canManage) return;
    // Apply immediately to current session (visual confirmation)
    setTheme(slug);
    startTransition(async () => {
      setFeedback(null);
      const result = await setOrgDefaultTheme(slug);
      if (result.ok) {
        setOrgDefault(slug);
        const themeName = systemThemes.find((t) => t.slug === slug)?.name || slug;
        setFeedback({
          type: 'success',
          msg: `"${themeName}" is now the org default and your active theme.`,
        });
      } else {
        setFeedback({ type: 'error', msg: result.error ?? 'Failed to update org default theme.' });
      }
    });
  }

  function handleClear() {
    if (!canManage) return;
    startTransition(async () => {
      setFeedback(null);
      const result = await setOrgDefaultTheme(null);
      if (result.ok) {
        setOrgDefault(null);
        setFeedback({
          type: 'success',
          msg: 'Org default theme cleared. Users will fall back to Finance Pro.',
        });
      } else {
        setFeedback({ type: 'error', msg: result.error ?? 'Failed to clear org default.' });
      }
    });
  }

  if (!canManage) {
    return (
      <div className="rounded-2xl p-6 flex items-center gap-4 mt-6 bg-app-surface border border-app-border">
        <AlertCircle size={20} className="text-app-muted-foreground" />
        <p className="text-sm text-app-muted-foreground">
          You don't have permission to manage organization themes. Contact your admin.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-6 flex flex-col gap-5 mt-6 bg-app-surface border border-app-border">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-app-primary/10">
            <Building2 size={18} className="text-app-primary" />
          </div>
          <div>
            <p className="text-sm font-black tracking-tight text-app-foreground">
              Organisation Default Theme
            </p>
            <p className="text-[11px] text-app-muted-foreground">
              New users see this theme on first login. Personal picks always override it.
            </p>
          </div>
        </div>

        {orgDefault && (
          <button
            onClick={handleClear}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80 bg-app-surface-hover text-app-muted-foreground border border-app-border"
            title="Remove org default — users fall back to Finance Pro"
          >
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
            Reset to system default
          </button>
        )}
      </div>

      {/* Priority chain explanation */}
      <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-medium bg-app-primary/10 text-app-primary">
        <Palette size={13} />
        <span>
          Priority: <strong>User pick</strong> → <strong>Org default (below)</strong> → System default
          (Finance Pro)
        </span>
      </div>

      {/* Theme grid organized by category */}
      <div className="space-y-4">
        {['professional', 'creative', 'efficiency', 'specialized'].map((category) => {
          const categoryThemes = systemThemes.filter((t) => t.category === category);
          if (categoryThemes.length === 0) return null;

          return (
            <div key={category}>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2 text-app-muted-foreground">
                {category}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {categoryThemes.map((theme) => (
                  <OrgThemeCard
                    key={theme.slug}
                    theme={theme}
                    isOrgDefault={orgDefault === theme.slug}
                    isUserTheme={currentTheme?.slug === theme.slug}
                    colorMode={colorMode}
                    onSelect={() => handleSelect(theme.slug)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Feedback */}
      {isPending && (
        <div className="flex items-center gap-2 text-xs text-app-muted-foreground">
          <Loader2 size={13} className="animate-spin" /> Saving org default...
        </div>
      )}
      {!isPending && feedback && (
        <div
          className={`flex items-center gap-2 text-xs font-semibold rounded-lg px-3 py-2 ${feedback.type === 'success'
            ? 'bg-app-primary/10 text-app-primary'
            : 'bg-app-error-bg text-app-error'
            }`}
        >
          {feedback.type === 'success' ? <Check size={13} /> : <AlertCircle size={13} />}
          {feedback.msg}
        </div>
      )}

      {/* Current status */}
      <p className="text-[10px] text-app-muted-foreground">
        {orgDefault
          ? `Org default: ${systemThemes.find((t) => t.slug === orgDefault)?.name ?? orgDefault
          }. Users without a personal pick will see this theme.`
          : 'No org default set — new users see Finance Pro (system default).'}
      </p>
    </div>
  );
}
