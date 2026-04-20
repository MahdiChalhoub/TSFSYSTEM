import { Wallet, TrendingDown, Scale, TrendingUp, BarChart3 } from 'lucide-react'
import { ReactNode, createElement } from 'react'

export const TYPE_CONFIG: Record<string, { color: string; bg: string; icon: ReactNode; label: string }> = {
    ASSET:     { color: 'var(--app-info, #3B82F6)',    bg: 'color-mix(in srgb, var(--app-info, #3B82F6) 10%, transparent)',    icon: createElement(Wallet, { size: 13 }),       label: 'Asset' },
    LIABILITY: { color: 'var(--app-error, #EF4444)',   bg: 'color-mix(in srgb, var(--app-error, #EF4444) 10%, transparent)',   icon: createElement(TrendingDown, { size: 13 }), label: 'Liability' },
    EQUITY:    { color: '#8b5cf6',                     bg: 'color-mix(in srgb, #8b5cf6 10%, transparent)',                    icon: createElement(Scale, { size: 13 }),        label: 'Equity' },
    INCOME:    { color: 'var(--app-success, #10B981)', bg: 'color-mix(in srgb, var(--app-success, #10B981) 10%, transparent)', icon: createElement(TrendingUp, { size: 13 }),   label: 'Income' },
    EXPENSE:   { color: 'var(--app-warning, #F59E0B)', bg: 'color-mix(in srgb, var(--app-warning, #F59E0B) 10%, transparent)', icon: createElement(BarChart3, { size: 13 }),     label: 'Expense' },
    REVENUE:   { color: 'var(--app-success, #10B981)', bg: 'color-mix(in srgb, var(--app-success, #10B981) 10%, transparent)', icon: createElement(TrendingUp, { size: 13 }),   label: 'Revenue' },
}
