// ══════════════════════════════════════════════════════════════════
// Migration helpers — pure utilities + types
// ══════════════════════════════════════════════════════════════════

export type FlatAccount = { code: string; name: string; type: string; subType?: string }

// Flatten hierarchical accounts tree into a flat array
export function flattenAccounts(accounts: any[], parentType?: string): FlatAccount[] {
    const result: FlatAccount[] = []
    for (const acct of accounts) {
        result.push({ code: acct.code, name: acct.name, type: acct.type || parentType || '', subType: acct.subType })
        if (acct.children) {
            result.push(...flattenAccounts(acct.children, acct.type || parentType))
        }
    }
    return result
}

// Normalize name for fuzzy matching
export function normalizeName(name: string): string {
    return name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

// Word-overlap similarity (0..1)
export function wordSimilarity(a: string, b: string): number {
    const wa = new Set(normalizeName(a).split(' ').filter(Boolean))
    const wb = new Set(normalizeName(b).split(' ').filter(Boolean))
    if (wa.size === 0 || wb.size === 0) return 0
    let overlap = 0
    for (const w of wa) { if (wb.has(w)) overlap++ }
    return overlap / Math.max(wa.size, wb.size)
}

export type MappingTarget = { code: string; name: string; type: string; pct: number }
export type MappingEntry = {
    srcCode: string; srcName: string; srcType: string
    targets: MappingTarget[]
    matchLevel: 'HINT' | 'CODE' | 'NAME' | 'MERGE' | 'SPLIT'
    isMerge: boolean  // N:1 — this target already used by another source
    isSplit: boolean  // 1:N — this source maps to multiple targets
}

// ── Helper: Find account name by code in hierarchical tree ──
export function findAccountName(accounts: any[] | undefined, code: string): string {
    if (!accounts) return code
    for (const acct of accounts) {
        if (acct.code === code) return acct.name
        if (acct.children) {
            const found = findAccountName(acct.children, code)
            if (found !== code) return found
        }
    }
    return code
}
