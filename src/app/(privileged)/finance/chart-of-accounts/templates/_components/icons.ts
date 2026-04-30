import {
    Globe, Landmark, BookOpen, FileText, Flag, MapPin, Library, Layers, Scale, Building2,
} from 'lucide-react'

// ── Icon resolver ──────────────────────────────────────────
export const ICON_MAP: Record<string, any> = {
    Globe, Landmark, BookOpen, FileText, Flag, MapPin, Library, Layers, Scale, Building2,
}
export function resolveIcon(name?: string) {
    return (name && ICON_MAP[name]) || Globe
}

// ── Accent color map ───────────────────────────────
export const ACCENT_MAP: Record<string, string> = {
    IFRS_COA: 'var(--app-info, #3b82f6)',
    USA_GAAP: 'var(--app-info)',
    FRENCH_PCG: 'var(--app-primary)',
    SYSCOHADA_REVISED: 'var(--app-warning, #f59e0b)',
    LEBANESE_PCN: 'var(--app-error, #ef4444)',
}
