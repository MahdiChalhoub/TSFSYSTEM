'use client'

import { useState, useEffect } from 'react'
import { Palette, Sun, Moon, Monitor, Check, Layers, Type, Layout, Sparkles, RotateCcw, Building2 } from 'lucide-react'
import { useAppTheme } from '@/components/app/AppThemeProvider'
import { useDesignSystem } from '@/contexts/DesignSystemContext'
import { getOrgDefaultTheme } from '@/app/actions/settings/theme'
import { OrgThemeSettings } from './OrgThemeSettings'

// ── Category label map ────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  professional: 'Professional',
  creative: 'Creative',
  efficiency: 'Efficiency',
  specialized: 'Specialized',
  'design-system': '⭐ Design Systems',
  custom: 'Custom',
}

const CATEGORY_ORDER = ['professional', 'efficiency', 'creative', 'specialized', 'design-system', 'custom']

// ── Design system meta ────────────────────────────────────────────
const DS_META: Record<string, { icon: string; desc: string; btnRadius: string; cardRadius: string; badge: string }> = {
  'ant-design':      { icon: '🐜', desc: 'Sharp, rectangular enterprise UI', btnRadius: '2px',  cardRadius: '4px',  badge: 'Corporate' },
  'material-design': { icon: '◉',  desc: 'Expressive pill-shaped components',  btnRadius: '20px', cardRadius: '12px', badge: 'Expressive' },
  'apple-hig':       { icon: '',  desc: 'Clean, softly-rounded Apple style',   btnRadius: '8px',  cardRadius: '12px', badge: 'Refined' },
  'tailwind':        { icon: '🌊', desc: 'Utility-first, flexible defaults',   btnRadius: '6px',  cardRadius: '8px',  badge: 'Modern' },
}

// DesignSystemProvider lives in the privileged layout — no need to wrap here
export default function AppearancePage() {
  return <AppearancePageInner />
}

function AppearancePageInner() {
  const {
    currentTheme,
    colorMode,
    systemThemes,
    customThemes,
    allThemes,
    isLoading,
    setTheme,
    toggleColorMode,
    setColorMode,
  } = useAppTheme()

  const {
    currentSystem,
    availableSystems,
    switchSystem,
    colorMode: dsColorMode,
    toggleColorMode: dsToggle,
  } = useDesignSystem()

  const [activeTab, setActiveTab] = useState<'color' | 'design-system' | 'typography' | 'org-default'>('color')
  const [search, setSearch] = useState('')
  const [mounted, setMounted] = useState(false)
  const [orgDefault, setOrgDefault] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    getOrgDefaultTheme().then(setOrgDefault).catch(() => {})
  }, [])

  // Group themes by category
  const allGrouped = CATEGORY_ORDER.reduce<Record<string, typeof allThemes>>((acc, cat) => {
    const matches = allThemes.filter(t => t.category === cat)
    const q = search.toLowerCase()
    const filtered = q ? matches.filter(t => t.name.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)) : matches
    if (filtered.length) acc[cat] = filtered
    return acc
  }, {})

  const totalThemes = systemThemes.length + customThemes.length

  return (
    <div className="min-h-full" style={{ background: 'var(--app-bg)', color: 'var(--app-foreground)' }}>

      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="px-8 pt-8 pb-6" style={{ borderBottom: '1px solid var(--app-border)' }}>
        <div className="flex items-center gap-4 mb-6">
          <div className="page-header-icon" style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)', boxShadow: '0 0 20px -5px var(--app-primary)' }}>
            <Palette size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>Settings</p>
            <h1 className="text-2xl font-black tracking-tight">Appearance <span style={{ color: 'var(--app-primary)' }}>&amp; Themes</span></h1>
          </div>

          {/* Context-aware active pill — shows color theme OR design system depending on tab */}
          {mounted && (
            <div className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
              <div className="w-3 h-3 rounded-full" style={{ background: 'var(--app-primary)' }} />
              {activeTab === 'design-system' ? (
                <>
                  <span className="text-sm font-semibold">{DS_META[currentSystem]?.badge ?? currentSystem}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>Design System</span>
                </>
              ) : currentTheme ? (
                <>
                  <span className="text-sm font-semibold">{currentTheme.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>Color Theme</span>
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1">
          {[
            { id: 'color',         icon: Palette,    label: 'Color Themes' },
            { id: 'design-system', icon: Layers,     label: 'Design System' },
            { id: 'typography',    icon: Type,       label: 'Mode' },
            { id: 'org-default',   icon: Building2,  label: 'Tenant Default' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={activeTab === tab.id ? {
                background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                color: 'var(--app-primary)',
                border: '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)',
              } : {
                color: 'var(--app-muted-foreground)',
                border: '1px solid transparent',
              }}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="px-8 py-6">

        {/* ══ TAB: COLOR THEMES ══ */}
        {activeTab === 'color' && (
          <div className="space-y-8">
            {/* Search */}
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search themes..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 max-w-sm px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{
                  background: 'var(--app-surface)',
                  border: '1px solid var(--app-border)',
                  color: 'var(--app-foreground)',
                }}
              />
              <span className="text-sm" style={{ color: 'var(--app-muted-foreground)' }}>
                {isLoading ? 'Loading...' : `${totalThemes} themes`}
              </span>
            </div>

            {isLoading && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: 'var(--app-surface)' }} />
                ))}
              </div>
            )}

            {!isLoading && Object.entries(allGrouped).map(([cat, themes]) => (
              <div key={cat}>
                <h3 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--app-muted-foreground)' }}>
                  {CATEGORY_LABELS[cat] || cat}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {themes.map(theme => {
                    const isActive = currentTheme?.slug === theme.slug
                    const mode = colorMode === 'auto' ? 'dark' : colorMode
                    const colors = theme.presetData?.colors?.[mode] || theme.presetData?.colors?.dark
                    return (
                      <button
                        key={theme.id ?? theme.slug}
                        onClick={() => setTheme(theme.slug)}
                        className="relative rounded-xl p-3 text-left transition-all hover:scale-[1.03] hover:-translate-y-0.5"
                        style={{
                          background: colors?.surface || 'var(--app-surface)',
                          border: isActive
                            ? `2px solid ${colors?.primary || 'var(--app-primary)'}`
                            : '2px solid transparent',
                          boxShadow: isActive
                            ? `0 0 16px -4px ${colors?.primary || 'var(--app-primary)'}66`
                            : '0 1px 4px rgba(0,0,0,0.15)',
                          outline: 'none',
                        }}
                      >
                        {/* Color preview bar */}
                        <div className="w-full h-10 rounded-lg mb-2.5 overflow-hidden">
                          <div className="h-full" style={{
                            background: `linear-gradient(135deg, ${colors?.bg || '#020617'} 0%, ${colors?.surface || '#0F172A'} 40%, ${colors?.primary || '#10B981'} 100%)`
                          }} />
                        </div>

                        {/* Swatches */}
                        <div className="flex gap-1 mb-2">
                          {[colors?.primary, colors?.text, colors?.border].map((c, i) => (
                            <div key={i} className="w-4 h-4 rounded-full border border-black/10" style={{ background: c || '#888' }} />
                          ))}
                        </div>

                        <p className="text-xs font-bold truncate" style={{ color: colors?.text || '#F1F5F9' }}>
                          {theme.name}
                        </p>
                        <p className="text-[10px] truncate mt-0.5" style={{ color: colors?.textMuted || '#94A3B8' }}>
                          {theme.category}
                        </p>

                        {isActive && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: colors?.primary || 'var(--app-primary)' }}>
                            <Check size={10} color="#fff" />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            {!isLoading && Object.keys(allGrouped).length === 0 && (
              <div className="text-center py-16" style={{ color: 'var(--app-muted-foreground)' }}>
                <Sparkles size={32} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No themes found</p>
                <p className="text-sm mt-1">Try a different search term</p>
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: DESIGN SYSTEM ══ */}
        {activeTab === 'design-system' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold mb-1">Design Language</h2>
              <p className="text-sm" style={{ color: 'var(--app-muted-foreground)' }}>
                Controls <strong>component shapes, spacing and corner radius</strong> across the whole app — independent of the color theme. Click a card to apply it.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableSystems.map(system => {
                const isActive = currentSystem === system.id
                const meta = DS_META[system.id] || { icon: '◆', desc: system.description, btnRadius: '6px', cardRadius: '8px', badge: '' }
                return (
                  <button
                    key={system.id}
                    onClick={() => switchSystem(system.id as any)}
                    className="flex flex-col p-5 rounded-2xl text-left transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                    style={isActive ? {
                      background: 'color-mix(in srgb, var(--app-primary) 8%, var(--app-surface))',
                      border: '2px solid var(--app-primary)',
                      boxShadow: '0 0 0 4px color-mix(in srgb, var(--app-primary) 10%, transparent)',
                    } : {
                      background: 'var(--app-surface)',
                      border: '2px solid var(--app-border)',
                    }}
                  >
                    {/* Header row */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: 'var(--app-surface-2)' }}>
                        {meta.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm">{system.name}</span>
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: 'var(--app-surface-2)', color: 'var(--app-muted-foreground)' }}>
                            {meta.badge}
                          </span>
                          {isActive && (
                            <span className="text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--app-primary) 15%, transparent)', color: 'var(--app-primary)' }}>
                              ✓ Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>{meta.desc}</p>
                      </div>
                    </div>

                    {/* Shape preview */}
                    <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'var(--app-surface-2)' }}>
                      {/* Simulated button */}
                      <div className="px-3 py-1.5 text-[11px] font-semibold text-white shrink-0"
                        style={{ background: 'var(--app-primary)', borderRadius: meta.btnRadius }}>
                        Button
                      </div>
                      {/* Simulated input */}
                      <div className="flex-1 h-7 border px-2 flex items-center text-[10px]"
                        style={{ borderRadius: meta.btnRadius, borderColor: 'var(--app-border)', color: 'var(--app-muted-foreground)', background: 'var(--app-surface)' }}>
                        Input field
                      </div>
                      {/* Simulated badge */}
                      <div className="px-2 py-0.5 text-[10px] font-semibold shrink-0"
                        style={{ borderRadius: meta.cardRadius, background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
                        Tag
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ══ TAB: COLOR MODE ══ */}
        {activeTab === 'typography' && (
          <div className="space-y-6 max-w-lg">
            <div>
              <h2 className="text-lg font-bold mb-1">Color Mode</h2>
              <p className="text-sm" style={{ color: 'var(--app-muted-foreground)' }}>
                Controls light/dark rendering across all pages.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'dark',  icon: Moon,    label: 'Dark',   desc: 'Dark backgrounds' },
                { id: 'light', icon: Sun,     label: 'Light',  desc: 'Light backgrounds' },
                { id: 'auto',  icon: Monitor, label: 'System', desc: 'Match OS setting' },
              ].map(opt => {
                const isActive = colorMode === opt.id
                return (
                  <button
                    key={opt.id}
                    onClick={() => setColorMode(opt.id as any)}
                    className="flex flex-col items-center gap-3 p-5 rounded-2xl transition-all"
                    style={isActive ? {
                      background: 'color-mix(in srgb, var(--app-primary) 8%, var(--app-surface))',
                      border: '2px solid var(--app-primary)',
                    } : {
                      background: 'var(--app-surface)',
                      border: '2px solid var(--app-border)',
                    }}
                  >
                    <opt.icon size={24} style={{ color: isActive ? 'var(--app-primary)' : 'var(--app-muted-foreground)' }} />
                    <div className="text-center">
                      <p className="text-sm font-bold">{opt.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>{opt.desc}</p>
                    </div>
                    {isActive && <Check size={14} style={{ color: 'var(--app-primary)' }} />}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {/* ══ TAB: TENANT DEFAULT ══ */}
        {activeTab === 'org-default' && (
          <OrgThemeSettings currentOrgDefault={orgDefault} />
        )}

      </div>
    </div>
  )
}
