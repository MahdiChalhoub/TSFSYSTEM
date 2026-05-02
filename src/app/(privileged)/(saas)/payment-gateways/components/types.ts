/* ═══════════════════════════════════════════════════════════
 *  SHARED TYPES — Payment Gateways (SaaS)
 *
 *  Two synthetic trees feed TreeMasterPage:
 *    - By Gateway:  family-root → gateway-leaf
 *    - By Country:  region-root → country-leaf
 *  Both share a single tree-node shape so the shell stays one
 *  call site and the row/detail components branch on `_kind`.
 * ═══════════════════════════════════════════════════════════ */

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

export type ViewMode = 'gateway' | 'country'

/* ── Synthetic tree node — one shape for all four kinds ── */
export type GatewayTreeNode = {
    /** Synthetic tree id — string-prefixed to avoid collisions across kinds. */
    id: string
    /** Tree parent id, or null for roots. */
    parent: string | null
    /** Display name used by the row + search. */
    name: string
    /** Discriminates rendering in row + detail panel. */
    _kind: 'family' | 'gateway' | 'region' | 'country'
    /** Optional code shown in the row meta strip. */
    code?: string
    /** Search shadow fields (description, ISO codes, etc.). */
    description?: string
    iso2?: string
    iso3?: string
    region?: string
    subregion?: string | null
    /** Original payload — used by detail panel and row actions. */
    _gw?: RefGateway
    _country?: RefCountryLite
    /** Pre-computed counts so KPIs and row badges don't recompute on every render. */
    _gatewayCount?: number
    _activeCount?: number
    _countryCount?: number
    /** For country rows: the REGIONAL gateways listed for this country (excludes worldwide). */
    _gateways?: RefGateway[]
    /** For country rows: count of worldwide gateways that also apply here. */
    _globalCount?: number
    /** Tree builder output. */
    children?: GatewayTreeNode[]
}

/* ── Helpers ───────────────────────────────────────────────── */
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
    'Other': 'var(--app-muted-foreground)',
}

/* ── Tree builders ────────────────────────────────────────── */
export function buildGatewayTreeData(gateways: RefGateway[]): GatewayTreeNode[] {
    const familyMap = new Map<string, RefGateway[]>()
    gateways.forEach(g => {
        const fam = g.provider_family || 'Other'
        if (!familyMap.has(fam)) familyMap.set(fam, [])
        familyMap.get(fam)!.push(g)
    })

    const out: GatewayTreeNode[] = []
    const families = [...familyMap.keys()].sort((a, b) => a.localeCompare(b))
    families.forEach(family => {
        const fid = `fam:${family}`
        const list = familyMap.get(family)!
        out.push({
            id: fid,
            parent: null,
            name: family,
            _kind: 'family',
            _gatewayCount: list.length,
            _activeCount: list.filter(g => g.is_active).length,
        })
        list.forEach(gw => {
            out.push({
                id: `gw:${gw.id}`,
                parent: fid,
                name: gw.name,
                code: gw.code,
                description: gw.description,
                _kind: 'gateway',
                _gw: gw,
            })
        })
    })
    return out
}

export function buildCountryTreeData(
    countries: RefCountryLite[],
    gateways: RefGateway[],
): GatewayTreeNode[] {
    const globalCount = gateways.filter(g => g.is_global).length
    const byIso2 = new Map<string, RefGateway[]>()
    gateways.forEach(g => {
        if (g.is_global) return
        ;(g.country_codes || []).forEach(cc => {
            const k = cc.toUpperCase()
            if (!byIso2.has(k)) byIso2.set(k, [])
            byIso2.get(k)!.push(g)
        })
    })

    // Show all countries — those without regional gateways are still visible
    // so the user can see the full coverage map, but their chip strip stays
    // empty (the worldwide banner above the tree explains why).
    const regionMap = new Map<string, RefCountryLite[]>()
    countries.forEach(c => {
        const r = c.region || 'Other'
        if (!regionMap.has(r)) regionMap.set(r, [])
        regionMap.get(r)!.push(c)
    })

    const out: GatewayTreeNode[] = []
    const regions = [...regionMap.keys()].sort((a, b) => a.localeCompare(b))
    regions.forEach(region => {
        const rid = `reg:${region}`
        const list = regionMap.get(region)!.sort((a, b) => a.name.localeCompare(b.name))
        const regionalSum = list.reduce((sum, c) => sum + (byIso2.get(c.iso2.toUpperCase())?.length || 0), 0)
        out.push({
            id: rid,
            parent: null,
            name: region,
            _kind: 'region',
            region,
            _countryCount: list.length,
            _gatewayCount: regionalSum,
        })
        list.forEach(c => {
            const regional = byIso2.get(c.iso2.toUpperCase()) || []
            out.push({
                id: `cty:${c.iso2.toUpperCase()}`,
                parent: rid,
                name: c.name,
                code: c.iso2.toUpperCase(),
                _kind: 'country',
                iso2: c.iso2,
                iso3: c.iso3,
                region: c.region,
                subregion: c.subregion ?? null,
                _country: c,
                _gateways: regional,
                _globalCount: globalCount,
                _gatewayCount: regional.length,
                _activeCount: regional.filter(g => g.is_active).length,
            })
        })
    })
    return out
}
