import {
    flattenAccounts, normalizeName, wordSimilarity,
    type FlatAccount, type MappingEntry, type MappingTarget,
} from './helpers'

// ── Build full auto-mapping with ZERO unmapped ──
// Pure function — extracted verbatim from MigrationView's useMemo body
export function buildAutoMapping(
    sourceKey: string,
    targetKey: string,
    templatesMap: Record<string, any>,
    migrationMaps: Record<string, Record<string, string>>,
): MappingEntry[] {
    if (!sourceKey || !targetKey) return []
    const srcAccounts = flattenAccounts(templatesMap[sourceKey]?.accounts || [])
    const tgtAccounts = flattenAccounts(templatesMap[targetKey]?.accounts || [])
    const hints = migrationMaps[`${sourceKey}→${targetKey}`] || {}

    // Build target indexes
    const tgtByCode: Record<string, FlatAccount> = {}
    const tgtByNorm: Record<string, FlatAccount[]> = {}
    const tgtByType: Record<string, FlatAccount[]> = {}
    for (const t of tgtAccounts) {
        tgtByCode[t.code] = t
        const norm = normalizeName(t.name)
        if (!tgtByNorm[norm]) tgtByNorm[norm] = []
        tgtByNorm[norm].push(t)
        if (!tgtByType[t.type]) tgtByType[t.type] = []
        tgtByType[t.type].push(t)
    }

    // Track how many sources map to each target (for merge detection)
    const targetUsageCount: Record<string, number> = {}
    const usedTargets = new Set<string>()

    // ── Pass 1: Unique 1:1 matches (HINT, CODE, NAME) ──
    const pass1: { src: FlatAccount; match: FlatAccount | null; level: MappingEntry['matchLevel'] }[] = []

    for (const src of srcAccounts) {
        let match: FlatAccount | null = null
        let level: MappingEntry['matchLevel'] = 'MERGE' // will be resolved in pass 2

        // Level 1: JSON hint override
        if (hints[src.code]) {
            const hintTarget = tgtByCode[hints[src.code]]
            if (hintTarget) { match = hintTarget; level = 'HINT' }
        }

        // Level 2: Exact code match
        if (!match && tgtByCode[src.code]) {
            const candidate = tgtByCode[src.code]
            if (candidate.type === src.type || !candidate.type || !src.type) {
                match = candidate; level = 'CODE'
            }
        }

        // Level 3: Normalized name match
        if (!match) {
            const srcNorm = normalizeName(src.name)
            const candidates = tgtByNorm[srcNorm] || []
            const sameType = candidates.find(c => c.type === src.type && !usedTargets.has(c.code))
            const anyUnused = candidates.find(c => !usedTargets.has(c.code))
            const anyUsed = candidates.find(c => c.type === src.type) || candidates[0]
            const chosen = sameType || anyUnused || anyUsed
            if (chosen) { match = chosen; level = 'NAME' }
        }

        if (match) {
            usedTargets.add(match.code)
            targetUsageCount[match.code] = (targetUsageCount[match.code] || 0) + 1
        }

        pass1.push({ src, match, level })
    }

    // ── Pass 2: Resolve remaining unmapped via MERGE or SPLIT ──
    const result: MappingEntry[] = []

    for (const { src, match, level } of pass1) {
        if (match) {
            // Detected N:1 merge if multiple sources point to same target
            const isMerge = (targetUsageCount[match.code] || 0) > 1
            result.push({
                srcCode: src.code, srcName: src.name, srcType: src.type,
                targets: [{ code: match.code, name: match.name, type: match.type, pct: 100 }],
                matchLevel: isMerge ? 'MERGE' : level,
                isMerge, isSplit: false,
            })
        } else {
            // ── SPLIT: Find multiple target accounts of same type via word similarity ──
            const candidates = (tgtByType[src.type] || [])
                .map(c => ({ ...c, sim: wordSimilarity(src.name, c.name) }))
                .sort((a, b) => b.sim - a.sim)

            if (candidates.length >= 2) {
                // Take top 2-3 by similarity, split equally
                const top = candidates.slice(0, Math.min(3, candidates.length)).filter(c => c.sim > 0)
                if (top.length === 0) {
                    // No word similarity — just pick first of same type
                    const fallback = candidates[0]
                    targetUsageCount[fallback.code] = (targetUsageCount[fallback.code] || 0) + 1
                    result.push({
                        srcCode: src.code, srcName: src.name, srcType: src.type,
                        targets: [{ code: fallback.code, name: fallback.name, type: fallback.type, pct: 100 }],
                        matchLevel: 'MERGE', isMerge: true, isSplit: false,
                    })
                } else if (top.length === 1) {
                    const t = top[0]
                    targetUsageCount[t.code] = (targetUsageCount[t.code] || 0) + 1
                    result.push({
                        srcCode: src.code, srcName: src.name, srcType: src.type,
                        targets: [{ code: t.code, name: t.name, type: t.type, pct: 100 }],
                        matchLevel: 'MERGE', isMerge: true, isSplit: false,
                    })
                } else {
                    // Real split: distribute evenly
                    const pct = Math.round(100 / top.length)
                    const targets: MappingTarget[] = top.map((t, idx) => {
                        targetUsageCount[t.code] = (targetUsageCount[t.code] || 0) + 1
                        return { code: t.code, name: t.name, type: t.type, pct: idx === top.length - 1 ? (100 - pct * (top.length - 1)) : pct }
                    })
                    result.push({
                        srcCode: src.code, srcName: src.name, srcType: src.type,
                        targets, matchLevel: 'SPLIT', isMerge: false, isSplit: true,
                    })
                }
            } else if (candidates.length === 1) {
                const t = candidates[0]
                targetUsageCount[t.code] = (targetUsageCount[t.code] || 0) + 1
                result.push({
                    srcCode: src.code, srcName: src.name, srcType: src.type,
                    targets: [{ code: t.code, name: t.name, type: t.type, pct: 100 }],
                    matchLevel: 'MERGE', isMerge: true, isSplit: false,
                })
            } else {
                // Absolute last resort: pick ANY unused or least-used target
                const allByUsage = tgtAccounts
                    .map(t => ({ ...t, usage: targetUsageCount[t.code] || 0 }))
                    .sort((a, b) => a.usage - b.usage)
                const fallback = allByUsage[0]
                if (fallback) {
                    targetUsageCount[fallback.code] = (targetUsageCount[fallback.code] || 0) + 1
                    result.push({
                        srcCode: src.code, srcName: src.name, srcType: src.type,
                        targets: [{ code: fallback.code, name: fallback.name, type: fallback.type, pct: 100 }],
                        matchLevel: 'MERGE', isMerge: true, isSplit: false,
                    })
                }
            }
        }
    }

    return result
}
