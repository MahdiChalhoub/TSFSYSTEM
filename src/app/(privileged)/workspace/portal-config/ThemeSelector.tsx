'use client'

import { useState } from 'react'
import { Palette, Check, Sparkles, Sun, Moon } from 'lucide-react'
import { updatePortalConfig } from '@/app/actions/client-portal'
import { THEME_CONFIGS } from '@/storefront/engine/ThemeConfigs'

interface ThemeSelectorProps {
 configId: string
 currentTheme: string
}

const THEME_ICONS: Record<string, any> = {
 midnight: Moon,
 boutique: Sun,
}

export default function ThemeSelector({ configId, currentTheme }: ThemeSelectorProps) {
 const [selected, setSelected] = useState(currentTheme || 'midnight')
 const [saving, setSaving] = useState(false)
 const [saved, setSaved] = useState(false)

 const themes = Object.values(THEME_CONFIGS)

 const handleSelect = async (themeId: string) => {
 if (themeId === selected) return
 setSelected(themeId)
 setSaving(true)
 setSaved(false)

 try {
 await updatePortalConfig(Number(configId), { storefront_theme: themeId })
 setSaved(true)
 setTimeout(() => setSaved(false), 3000)
 } catch (err) {
 console.error('[ThemeSelector] Failed to save:', err)
 setSelected(currentTheme) // Revert on failure
 } finally {
 setSaving(false)
 }
 }

 const cardStyle: React.CSSProperties = {
 background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
 borderRadius: 12,
 border: '1px solid var(--app-surface)',
 padding: '1.25rem',
 }

 return (
 <div style={cardStyle}>
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
 <Palette size={18} color="#a78bfa" />
 <h3 style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--app-foreground)', margin: 0 }}>
 🎨 Storefront Theme
 </h3>
 </div>
 {saved && (
 <span style={{
 display: 'inline-flex', alignItems: 'center', gap: 4,
 padding: '4px 12px', borderRadius: 20,
 background: 'color-mix(in srgb, var(--app-success) 15%, transparent)', color: 'var(--app-success)',
 fontSize: '0.75rem', fontWeight: 600,
 }}>
 <Check size={12} /> Saved
 </span>
 )}
 </div>

 <p style={{ color: 'var(--app-muted-foreground)', fontSize: '0.85rem', marginBottom: '1rem' }}>
 Choose a visual theme for your customer-facing storefront. Changes apply instantly.
 </p>

 <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(themes.length, 3)}, 1fr)`, gap: '1rem' }}>
 {themes.map(theme => {
 const isSelected = theme.id === selected
 const Icon = THEME_ICONS[theme.id] || Sparkles

 return (
 <button
 key={theme.id}
 onClick={() => handleSelect(theme.id)}
 disabled={saving}
 style={{
 display: 'flex', flexDirection: 'column', alignItems: 'stretch',
 padding: 0, cursor: saving ? 'wait' : 'pointer',
 border: isSelected ? '2px solid #8b5cf6' : '2px solid var(--app-surface)',
 borderRadius: 12, overflow: 'hidden', transition: 'all 0.2s',
 background: 'var(--app-background)',
 opacity: saving && !isSelected ? 0.5 : 1,
 boxShadow: isSelected ? '0 0 20px color-mix(in srgb, var(--app-primary) 20%, transparent)' : 'none',
 }}
 >
 {/* Color preview bar */}
 <div style={{
 height: 80, display: 'flex', position: 'relative', overflow: 'hidden',
 background: theme.colors.background,
 }}>
 {/* Simulated header */}
 <div style={{
 position: 'absolute', top: 0, left: 0, right: 0, height: 24,
 background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
 opacity: 0.3,
 }} />
 {/* Simulated product grid */}
 <div style={{
 display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center',
 width: '100%', padding: '28px 12px 8px',
 }}>
 {[0, 1, 2].map(i => (
 <div key={i} style={{
 width: 32, height: 40, borderRadius: 6,
 background: `linear-gradient(135deg, ${theme.colors.primary}40, ${theme.colors.accent}30)`,
 border: `1px solid ${theme.colors.primary}30`,
 }} />
 ))}
 </div>

 {/* Selected check */}
 {isSelected && (
 <div style={{
 position: 'absolute', top: 6, right: 6,
 width: 20, height: 20, borderRadius: '50%',
 background: 'var(--app-primary)', display: 'flex',
 alignItems: 'center', justifyContent: 'center',
 }}>
 <Check size={12} color="#fff" />
 </div>
 )}
 </div>

 {/* Theme info */}
 <div style={{ padding: '12px', textAlign: 'left' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
 <Icon size={14} color={theme.colors.primary} />
 <span style={{
 fontWeight: 700, fontSize: '0.85rem',
 color: isSelected ? 'var(--app-border)' : 'var(--app-muted-foreground)',
 }}>
 {theme.name}
 </span>
 </div>
 <p style={{
 fontSize: '0.72rem', color: 'var(--app-muted-foreground)',
 margin: 0, lineHeight: 1.4,
 display: '-webkit-box', WebkitLineClamp: 2,
 WebkitBoxOrient: 'vertical', overflow: 'hidden',
 }}>
 {theme.description}
 </p>

 {/* Color dots */}
 <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
 {[theme.colors.primary, theme.colors.secondary, theme.colors.accent, theme.colors.background].map((c, i) => (
 <div key={i} style={{
 width: 14, height: 14, borderRadius: '50%',
 background: c,
 border: '1px solid var(--app-surface)',
 }} />
 ))}
 </div>
 </div>
 </button>
 )
 })}
 </div>
 </div>
 )
}
