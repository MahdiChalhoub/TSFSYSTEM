import type { ThemeConfig } from '../../engine/types'

const config: ThemeConfig = {
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
}

export default config
