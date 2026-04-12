/**
 * Theme Switcher Component
 * ========================
 * Unified theme selector with dark/light toggle.
 *
 * FIXED BUGS (April 2026):
 * 1. All --theme-* CSS vars replaced with --app-* (the actual vars set by UnifiedThemeEngine)
 * 2. Inconsistent --theme-muted vs --theme-text-muted unified to --app-text-muted
 * 3. Active theme comparison unified to slug (was id in expanded, slug in dropdown)
 * 4. Color preview now respects current colorMode (was hardcoded to dark)
 * 5. Empty categories skipped in dropdown (was only guarded in expanded view)
 * 6. Compact/Simple views now dynamically render ALL categories incl. design-system + custom
 * 7. CompactThemeSwitcher now includes customThemes
 * 8. Fallback slug corrected from 'finance-pro' to 'ant-design'
 * 9. Escape key closes dropdown
 * 10. Tailwind bg-[var()]/N opacity replaced with color-mix() for runtime CSS vars
 * 11. Loading states added to Compact/Simple views
 * 12. isLoading guard added to SimpleThemeSwitcher
 */

'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAppTheme } from '@/components/app/AppThemeProvider'
import { Button } from '@/components/ui/button'
import { Moon, Sun, Palette, Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ═══════════════════════════════════════════════════════════
 *  SHARED HELPERS
 * ═══════════════════════════════════════════════════════════ */

/** Build grouped categories from system + custom themes (pure function, NOT a hook) */
function buildThemeCategories(systemThemes: any[], customThemes: any[]) {
  const categories = [
    { id: 'professional', name: 'Professional', themes: systemThemes.filter(t => t.category === 'professional') },
    { id: 'creative', name: 'Creative', themes: systemThemes.filter(t => t.category === 'creative') },
    { id: 'efficiency', name: 'Efficiency', themes: systemThemes.filter(t => t.category === 'efficiency') },
    { id: 'specialized', name: 'Specialized', themes: systemThemes.filter(t => t.category === 'specialized') },
    { id: 'design-system', name: '⭐ Design Systems', themes: systemThemes.filter(t => t.category === 'design-system') },
  ]

  if (customThemes.length > 0) {
    categories.push({ id: 'custom', name: 'Custom', themes: customThemes })
  }

  // Only return categories that have at least 1 theme
  return categories.filter(c => c.themes.length > 0)
}

const DEFAULT_SLUG = 'ant-design'

/* ═══════════════════════════════════════════════════════════
 *  MAIN THEME SWITCHER
 * ═══════════════════════════════════════════════════════════ */

interface ThemeSwitcherProps {
  className?: string
  showLabel?: boolean
  compact?: boolean
  expanded?: boolean  // Always show all themes (for settings page)
}

export function ThemeSwitcher({
  className,
  showLabel = true,
  compact = false,
  expanded = false,
}: ThemeSwitcherProps) {
  const {
    currentTheme,
    colorMode,
    systemThemes,
    customThemes,
    toggleColorMode,
    setTheme,
    isLoading,
  } = useAppTheme()

  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Build categories BEFORE any early returns (React hook ordering rules)
  const categories = buildThemeCategories(systemThemes, customThemes)

  // Close dropdown on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsOpen(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 animate-pulse rounded-md bg-app-surface" />
        {!compact && (
          <div className="h-8 w-32 animate-pulse rounded-md bg-app-surface" />
        )}
      </div>
    )
  }

  if (compact) {
    return <CompactThemeSwitcher />
  }

  // Show error if no themes loaded
  if (systemThemes.length === 0 && !isLoading) {
    return (
      <div className="p-4 rounded-lg border"
        style={{
          background: 'color-mix(in srgb, var(--app-error) 8%, var(--app-surface))',
          borderColor: 'color-mix(in srgb, var(--app-error) 30%, transparent)',
        }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--app-error)' }}>
          ⚠️ Theme System Error
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--app-text-muted)' }}>
          No themes loaded from backend. Check console for errors.
        </p>
        <p className="text-xs mt-2 font-mono" style={{ color: 'var(--app-text-muted)' }}>
          systemThemes: {systemThemes.length}, customThemes: {customThemes.length}
        </p>
      </div>
    )
  }

  // Resolve preview colors using current color mode
  const previewColorKey = colorMode === 'light' ? 'light' : 'dark'

  // EXPANDED VIEW (for settings page)
  if (expanded) {
    return (
      <div className={cn('space-y-6', className)}>
        {/* Dark/Light Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg"
          style={{
            background: 'var(--app-surface)',
            border: '1px solid var(--app-border)',
          }}>
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--app-text)' }}>Color Mode</h3>
            <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>Switch between dark and light mode</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleColorMode}
            className="gap-2"
          >
            {colorMode === 'dark' ? (
              <>
                <Moon className="h-4 w-4" />
                <span>Dark</span>
              </>
            ) : (
              <>
                <Sun className="h-4 w-4" />
                <span>Light</span>
              </>
            )}
          </Button>
        </div>

        {/* Theme Categories - Always Visible */}
        <div className="space-y-6">
          {categories.map((category) => (
            <div key={category.id}>
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-3"
                style={{ color: 'var(--app-text-muted)' }}>
                {category.name}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {category.themes.map((theme) => {
                  const isActive = currentTheme?.slug === theme.slug
                  return (
                    <button
                      key={theme.slug}
                      onClick={() => setTheme(theme.slug)}
                      className={cn(
                        'relative p-4 rounded-lg border-2 transition-all hover:scale-[1.02]',
                      )}
                      style={isActive ? {
                        borderColor: 'var(--app-primary)',
                        background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)',
                      } : {
                        borderColor: 'var(--app-border)',
                      }}
                    >
                      {isActive && (
                        <div className="absolute top-2 right-2">
                          <Check className="h-4 w-4" style={{ color: 'var(--app-primary)' }} />
                        </div>
                      )}
                      <div className="text-left">
                        <h4 className="font-semibold mb-1" style={{ color: 'var(--app-text)' }}>
                          {theme.name}
                        </h4>
                        <p className="text-xs line-clamp-2" style={{ color: 'var(--app-text-muted)' }}>
                          {theme.description}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // COMPACT/DROPDOWN VIEW (for header/nav)
  return (
    <div className={cn('relative flex items-center gap-2', className)}>
      {/* Dark/Light Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleColorMode}
        title={`Switch to ${colorMode === 'dark' ? 'light' : 'dark'} mode`}
        className="h-9 w-9"
      >
        {colorMode === 'dark' ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </Button>

      {/* Theme Selector */}
      <div className="relative" ref={dropdownRef}>
        <Button
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}
          className="gap-2"
        >
          <Palette className="h-4 w-4" />
          {showLabel && currentTheme && (
            <span className="max-w-[120px] truncate">{currentTheme.name}</span>
          )}
          <ChevronDown className={cn('h-4 w-4 opacity-50 transition-transform', isOpen && 'rotate-180')} />
        </Button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <div className="absolute right-0 mt-2 w-[320px] max-h-[500px] overflow-auto rounded-lg shadow-lg z-50"
              style={{
                border: '1px solid var(--app-border)',
                background: 'var(--app-surface)',
              }}>
              {/* Header */}
              <div className="sticky top-0 px-4 py-3"
                style={{
                  background: 'var(--app-surface)',
                  borderBottom: '1px solid var(--app-border)',
                }}>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--app-text)' }}>
                  Choose Theme
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                  {systemThemes.length + customThemes.length} themes available
                </p>
              </div>

              {/* Theme List — categories with empty guard */}
              <div className="p-2">
                {categories.map((category) => (
                  <div key={category.id} className="mb-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider px-2 mb-2"
                      style={{ color: 'var(--app-text-muted)' }}>
                      {category.name}
                    </h4>
                    <div className="space-y-1">
                      {category.themes.map((theme) => {
                        const isActive = currentTheme?.slug === theme.slug
                        return (
                          <button
                            key={theme.slug}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setTheme(theme.slug)
                              setIsOpen(false)
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors"
                            style={isActive ? {
                              background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                              color: 'var(--app-primary)',
                            } : {
                              color: 'var(--app-text)',
                            }}
                          >
                            {/* Color Preview — uses current colorMode */}
                            <div
                              className="w-8 h-8 rounded flex-shrink-0"
                              style={{
                                border: '1px solid var(--app-border)',
                                background: `linear-gradient(135deg, ${theme.presetData?.colors?.[previewColorKey]?.primary || theme.presetData?.colors?.dark?.primary || '#6366F1'} 0%, ${theme.presetData?.colors?.[previewColorKey]?.surface || theme.presetData?.colors?.dark?.surface || '#0F172A'} 100%)`,
                              }}
                            />

                            {/* Theme Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">
                                  {theme.name}
                                </span>
                                {isActive && (
                                  <Check className="h-4 w-4 flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs truncate" style={{ color: 'var(--app-text-muted)' }}>
                                {theme.description}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Compact Theme Switcher (icon + dropdown only)
 * Now dynamically renders ALL categories including design-system and custom.
 */
export function CompactThemeSwitcher() {
  const { currentTheme, colorMode, systemThemes, customThemes, toggleColorMode, setTheme, isLoading } =
    useAppTheme()

  const categories = buildThemeCategories(systemThemes, customThemes)

  if (isLoading) {
    return (
      <div className="flex items-center gap-1">
        <div className="h-8 w-8 animate-pulse rounded-md bg-app-surface" />
        <div className="h-8 w-24 animate-pulse rounded-md bg-app-surface" />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      {/* Dark/Light Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleColorMode}
        className="h-8 w-8"
      >
        {colorMode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      {/* Dynamic Select — all categories */}
      <select
        value={currentTheme?.slug || DEFAULT_SLUG}
        onChange={(e) => setTheme(e.target.value)}
        className="h-8 px-2 text-xs rounded-md cursor-pointer"
        style={{
          border: '1px solid var(--app-border)',
          background: 'var(--app-surface)',
          color: 'var(--app-text)',
        }}
      >
        {categories.map(cat => (
          <optgroup key={cat.id} label={cat.name}>
            {cat.themes.map((theme) => (
              <option key={theme.slug} value={theme.slug}>
                {theme.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}

/**
 * Simple Theme Switcher (dropdown only, no dark/light toggle)
 * Now dynamically renders ALL categories including design-system and custom.
 */
export function SimpleThemeSwitcher() {
  const { currentTheme, systemThemes, customThemes, setTheme, isLoading } = useAppTheme()

  const categories = buildThemeCategories(systemThemes, customThemes)

  if (isLoading) {
    return (
      <div className="h-9 w-40 animate-pulse rounded-md bg-app-surface" />
    )
  }

  return (
    <select
      value={currentTheme?.slug || DEFAULT_SLUG}
      onChange={(e) => setTheme(e.target.value)}
      className="px-3 py-2 rounded-md text-sm"
      style={{
        border: '1px solid var(--app-border)',
        background: 'var(--app-surface)',
        color: 'var(--app-text)',
      }}
    >
      {categories.map(cat => (
        <optgroup key={cat.id} label={cat.name}>
          {cat.themes.map((theme) => (
            <option key={theme.slug} value={theme.slug}>
              {theme.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
