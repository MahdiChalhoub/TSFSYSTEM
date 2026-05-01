import {
    Banknote, Building, Smartphone, Briefcase, PiggyBank,
    Globe2, Lock, TrendingUp, Wallet, Layers, CreditCard,
    Zap, Cloud
} from 'lucide-react'

/* ── Icon Map ── */
export const ICON_MAP: Record<string, any> = {
    banknote: Banknote, building: Building, smartphone: Smartphone,
    briefcase: Briefcase, 'piggy-bank': PiggyBank, 'globe-2': Globe2,
    lock: Lock, 'trending-up': TrendingUp, wallet: Wallet, layers: Layers,
    'credit-card': CreditCard, zap: Zap, cloud: Cloud,
}
export const getIcon = (name: string) => ICON_MAP[name] || Wallet
export const DEFAULT_COLOR = 'var(--app-accent)'

export const ICON_OPTIONS = [
    { value: 'banknote', label: '💵 Banknote' },
    { value: 'building', label: '🏦 Building' },
    { value: 'smartphone', label: '📱 Smartphone' },
    { value: 'briefcase', label: '💼 Briefcase' },
    { value: 'piggy-bank', label: '🐷 Piggy Bank' },
    { value: 'globe-2', label: '🌍 Globe' },
    { value: 'lock', label: '🔒 Lock' },
    { value: 'trending-up', label: '📈 Trending Up' },
    { value: 'wallet', label: '👛 Wallet' },
    { value: 'credit-card', label: '💳 Credit Card' },
    { value: 'layers', label: '📚 Layers' },
    { value: 'zap', label: '⚡ Zap' },
    { value: 'cloud', label: '☁️ Cloud' },
]

export const COLOR_PRESETS = [
    'var(--app-primary)', 'var(--app-info)', 'var(--app-accent)', 'var(--app-warning)', 'var(--app-accent-cyan)',
    '#ec4899', 'var(--app-muted-foreground)', '#14b8a6', 'var(--app-accent)', 'var(--app-error)',
    '#84cc16', 'var(--app-warning)',
]

/* ══════════════════════════════════════════════════
 *  PROVIDER CONFIG FIELD TYPE (shared by category + account forms)
 *  The actual providers come from the DB API, not hardcoded.
 * ══════════════════════════════════════════════════ */
export type ProviderFieldDef = {
    key: string
    label: string
    type: 'text' | 'password' | 'select'
    placeholder?: string
    options?: { value: string; label: string }[]
    required?: boolean
}
