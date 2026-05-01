export type RefGatewayConfigField = {
    key: string
    label?: string
    type?: string
    required?: boolean
    [key: string]: unknown
}

export type RefGateway = {
    id: number
    name: string
    code: string
    is_active: boolean
    is_global?: boolean
    provider_family?: string
    description?: string
    config_schema?: RefGatewayConfigField[]
    color?: string
    logo_emoji?: string
    country_codes?: string[]
    website_url?: string
    [key: string]: unknown
}

export type RefCountryLite = {
    id: number
    name: string
    iso2: string
    iso3?: string
    region?: string
    subregion?: string | null
    [key: string]: unknown
}

export function getFlagEmoji(code?: string | null): string {
    if (!code || code.length < 2) return '🌍'
    const cc = code.toUpperCase().slice(0, 2)
    return String.fromCodePoint(...[...cc].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
}

export const REGION_COLORS: Record<string, string> = {
    'Africa': 'var(--app-warning)',
    'Americas': 'var(--app-info, #3b82f6)',
    'Asia': 'var(--app-error, #ef4444)',
    'Europe': 'var(--app-success, #22c55e)',
    'Oceania': 'var(--app-accent)',
    '': 'var(--app-muted-foreground)',
}
