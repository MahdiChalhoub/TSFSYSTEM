import type { ThemeConfig } from '../../engine/types'

const config: ThemeConfig = {
    id: 'midnight',
    name: 'Midnight',
    description: 'Premium dark e-commerce theme with emerald accents. Sleek, modern, and luxurious.',
    author: 'TSF Platform',
    version: '1.0.0',
    colors: {
        primary: '#10b981',
        secondary: '#6366f1',
        accent: '#f59e0b',
        background: '#020617',
        surface: '#0f172a',
        text: '#ffffff',
    },
    supports: ['b2c', 'b2b', 'catalog_quote', 'hybrid'],
    fonts: {
        heading: 'Inter, system-ui, sans-serif',
        body: 'Inter, system-ui, sans-serif',
    },
}

export default config
