/**
 * Theme Switcher Component
 * ========================
 * Unified theme selector with dark/light toggle.
 */

'use client'

import React, { useState } from 'react'
import { useUnifiedThemeEngine } from '@/contexts/UnifiedThemeEngine'
import { Button } from '@/components/ui/button'
import { Moon, Sun, Palette, Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  } = useUnifiedThemeEngine()

  const [isOpen, setIsOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 animate-pulse rounded-md bg-[var(--theme-surface)]" />
        {!compact && (
          <div className="h-8 w-32 animate-pulse rounded-md bg-[var(--theme-surface)]" />
        )}
      </div>
    )
  }

  if (compact) {
    return <CompactThemeSwitcher />
  }

  const categories = [
    { id: 'professional', name: 'Professional', themes: systemThemes.filter(t => t.category === 'professional') },
    { id: 'creative', name: 'Creative', themes: systemThemes.filter(t => t.category === 'creative') },
    { id: 'efficiency', name: 'Efficiency', themes: systemThemes.filter(t => t.category === 'efficiency') },
    { id: 'specialized', name: 'Specialized', themes: systemThemes.filter(t => t.category === 'specialized') },
    { id: 'design-system', name: '⭐ Industry Design Systems', themes: systemThemes.filter(t => t.category === 'design-system') },
  ]

  if (customThemes.length > 0) {
    categories.push({ id: 'custom', name: 'Custom', themes: customThemes })
  }

  // Show error if no themes loaded
  if (systemThemes.length === 0 && !isLoading) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-sm font-semibold text-red-900 dark:text-red-200">
          ⚠️ Theme System Error
        </p>
        <p className="text-xs text-red-700 dark:text-red-300 mt-1">
          No themes loaded from backend. Check console for errors.
        </p>
        <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-mono">
          systemThemes: {systemThemes.length}, customThemes: {customThemes.length}
        </p>
      </div>
    )
  }

  // EXPANDED VIEW (for settings page)
  if (expanded) {
    return (
      <div className={cn('space-y-6', className)}>
        {/* Dark/Light Toggle */}
        <div className="flex items-center justify-between p-4 bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-lg">
          <div>
            <h3 className="font-semibold text-[var(--theme-text)]">Color Mode</h3>
            <p className="text-sm text-[var(--theme-muted)]">Switch between dark and light mode</p>
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
          {categories.map((category) => {
            if (category.themes.length === 0) return null

            return (
              <div key={category.id}>
                <h3 className="text-sm font-semibold text-[var(--theme-muted)] uppercase tracking-wider mb-3">
                  {category.name}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {category.themes.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => setTheme(theme.slug)}
                      className={cn(
                        'relative p-4 rounded-lg border-2 transition-all hover:scale-[1.02]',
                        currentTheme?.id === theme.id
                          ? 'border-[var(--theme-primary)] bg-[var(--theme-primary)]/5'
                          : 'border-[var(--theme-border)] hover:border-[var(--theme-primary)]/50'
                      )}
                    >
                      {currentTheme?.id === theme.id && (
                        <div className="absolute top-2 right-2">
                          <Check className="h-4 w-4 text-[var(--theme-primary)]" />
                        </div>
                      )}
                      <div className="text-left">
                        <h4 className="font-semibold text-[var(--theme-text)] mb-1">
                          {theme.name}
                        </h4>
                        <p className="text-xs text-[var(--theme-muted)] line-clamp-2">
                          {theme.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
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
      <div className="relative">
        <Button
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}
          className="gap-2"
        >
          <Palette className="h-4 w-4" />
          {showLabel && currentTheme && (
            <span className="max-w-[120px] truncate">{currentTheme.name}</span>
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <div className="absolute right-0 mt-2 w-[320px] max-h-[500px] overflow-auto rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-lg z-50">
              {/* Header */}
              <div className="sticky top-0 bg-[var(--theme-surface)] border-b border-[var(--theme-border)] px-4 py-3">
                <h3 className="text-sm font-semibold text-[var(--theme-text)]">
                  Choose Theme
                </h3>
                <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">
                  {systemThemes.length + customThemes.length} themes available
                </p>
              </div>

              {/* Theme List */}
              <div className="p-2">
                {categories.map((category) => (
                  <div key={category.id} className="mb-4">
                    <h4 className="text-xs font-semibold text-[var(--theme-text-muted)] uppercase tracking-wider px-2 mb-2">
                      {category.name}
                    </h4>
                    <div className="space-y-1">
                      {category.themes.map((theme) => (
                        <button
                          key={theme.slug}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setTheme(theme.slug)
                            setIsOpen(false)
                          }}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors',
                            currentTheme?.slug === theme.slug
                              ? 'bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]'
                              : 'hover:bg-[var(--theme-surface-hover)] text-[var(--theme-text)]'
                          )}
                        >
                          {/* Color Preview */}
                          <div
                            className="w-8 h-8 rounded flex-shrink-0 border border-[var(--theme-border)]"
                            style={{
                              background: `linear-gradient(135deg, ${theme.presetData?.colors?.dark?.primary || '#6366F1'} 0%, ${theme.presetData?.colors?.dark?.surface || '#0F172A'} 100%)`,
                            }}
                          />

                          {/* Theme Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">
                                {theme.name}
                              </span>
                              {currentTheme?.slug === theme.slug && (
                                <Check className="h-4 w-4 flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-[var(--theme-text-muted)] truncate">
                              {theme.description}
                            </p>
                          </div>
                        </button>
                      ))}
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
 */
export function CompactThemeSwitcher() {
  const { currentTheme, colorMode, systemThemes, toggleColorMode, setTheme } =
    useUnifiedThemeEngine()

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

      {/* Simple Select */}
      <select
        value={currentTheme?.slug || 'finance-pro'}
        onChange={(e) => setTheme(e.target.value)}
        className="h-8 px-2 text-xs rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)] cursor-pointer"
      >
        <optgroup label="Professional">
          {systemThemes
            .filter((t) => t.category === 'professional')
            .map((theme) => (
              <option key={theme.slug} value={theme.slug}>
                {theme.name}
              </option>
            ))}
        </optgroup>
        <optgroup label="Creative">
          {systemThemes
            .filter((t) => t.category === 'creative')
            .map((theme) => (
              <option key={theme.slug} value={theme.slug}>
                {theme.name}
              </option>
            ))}
        </optgroup>
        <optgroup label="Efficiency">
          {systemThemes
            .filter((t) => t.category === 'efficiency')
            .map((theme) => (
              <option key={theme.slug} value={theme.slug}>
                {theme.name}
              </option>
            ))}
        </optgroup>
        <optgroup label="Specialized">
          {systemThemes
            .filter((t) => t.category === 'specialized')
            .map((theme) => (
              <option key={theme.slug} value={theme.slug}>
                {theme.name}
              </option>
            ))}
        </optgroup>
      </select>
    </div>
  )
}

/**
 * Simple Theme Switcher (dropdown only, no dark/light toggle)
 */
export function SimpleThemeSwitcher() {
  const { currentTheme, systemThemes, setTheme } = useUnifiedThemeEngine()

  return (
    <select
      value={currentTheme?.slug || 'finance-pro'}
      onChange={(e) => setTheme(e.target.value)}
      className="px-3 py-2 rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)] text-sm"
    >
      <optgroup label="Professional">
        {systemThemes
          .filter((t) => t.category === 'professional')
          .map((theme) => (
            <option key={theme.slug} value={theme.slug}>
              {theme.name}
            </option>
          ))}
      </optgroup>
      <optgroup label="Creative">
        {systemThemes
          .filter((t) => t.category === 'creative')
          .map((theme) => (
            <option key={theme.slug} value={theme.slug}>
              {theme.name}
            </option>
          ))}
      </optgroup>
      <optgroup label="Efficiency">
        {systemThemes
          .filter((t) => t.category === 'efficiency')
          .map((theme) => (
            <option key={theme.slug} value={theme.slug}>
              {theme.name}
            </option>
          ))}
      </optgroup>
      <optgroup label="Specialized">
        {systemThemes
          .filter((t) => t.category === 'specialized')
          .map((theme) => (
            <option key={theme.slug} value={theme.slug}>
              {theme.name}
            </option>
          ))}
      </optgroup>
    </select>
  )
}
