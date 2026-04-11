import type { ThemeConfig } from './types'

export const THEME_CONFIGS: Record<string, ThemeConfig> = {
    midnight: {
        id: 'midnight',
        name: 'Midnight',
        description: 'Premium dark e-commerce theme with emerald accents. Sleek, modern, and luxurious.',
        author: 'TSF Platform',
        version: '1.0.0',
        colors: {
            primary: '#10b981',    // emerald-500
            secondary: '#6366f1',  // indigo-500
            accent: '#f59e0b',     // amber-500
            background: '#020617', // slate-950
            surface: '#0f172a',    // slate-900
            text: '#ffffff',
        },
        supports: ['b2c', 'b2b', 'catalog_quote', 'hybrid'],
        fonts: {
            heading: 'Inter, system-ui, sans-serif',
            body: 'Inter, system-ui, sans-serif',
        },
    },
    boutique: {
        id: 'boutique',
        name: 'Boutique',
        description: 'Clean, light, and elegant. A refined storefront for curated collections and premium brands.',
        author: 'TSF Platform',
        version: '1.0.0',
        colors: {
            primary: '#8b5cf6',    // violet-500
            secondary: '#ec4899',  // pink-500
            accent: '#f97316',     // orange-500
            background: '#faf5ff', // violet-50
            surface: '#ffffff',
            text: '#1e1b4b',       // indigo-950
        },
        supports: ['b2c', 'b2b', 'catalog_quote', 'hybrid'],
        fonts: {
            heading: "'Playfair Display', Georgia, serif",
            body: "'DM Sans', system-ui, sans-serif",
        },
    },
    emporium: {
        id: 'emporium',
        name: 'Emporium',
        description: 'Elite marketplace theme for massive catalogs. Features mega-menus, flash sales, and industrial-strength navigation.',
        author: 'TSF Platform',
        version: '1.0.0',
        colors: {
            primary: '#facc15',    // yellow-400 (Marketplace Gold)
            secondary: '#1e293b',  // slate-800
            accent: '#f97316',     // orange-500
            background: '#f8fafc', // slate-50
            surface: '#ffffff',
            text: '#0f172a',       // slate-900
        },
        supports: ['b2c', 'b2b', 'catalog_quote', 'hybrid'],
        fonts: {
            heading: 'Outfit, system-ui, sans-serif',
            body: 'Inter, system-ui, sans-serif',
        },
    },
}
