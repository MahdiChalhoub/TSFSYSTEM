import {
    Banknote, Building, Smartphone, Briefcase, PiggyBank,
    Globe2, Lock, TrendingUp, Wallet, Layers, CreditCard,
} from 'lucide-react'

/* ── Icon Map ── */
export const ICON_MAP: Record<string, any> = {
    banknote: Banknote, building: Building, smartphone: Smartphone,
    briefcase: Briefcase, 'piggy-bank': PiggyBank, 'globe-2': Globe2,
    lock: Lock, 'trending-up': TrendingUp, wallet: Wallet, layers: Layers,
    'credit-card': CreditCard,
}
export const getIcon = (name: string) => ICON_MAP[name] || Wallet
export const DEFAULT_COLOR = '#6366f1'

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
]

export const COLOR_PRESETS = [
    '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4',
    '#ec4899', '#64748b', '#14b8a6', '#6366f1', '#ef4444',
    '#84cc16', '#f97316',
]
