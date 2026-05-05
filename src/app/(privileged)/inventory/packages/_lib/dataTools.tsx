/**
 * Packages — shared DataTools config factory
 * ===========================================
 * Builds the full Export / Import / Print configuration once. Same
 * pattern as `units/_lib/dataTools.tsx`: desktop and mobile reuse the
 * exact same factory so a CSV exported from one round-trips on the
 * other.
 *
 * Self-referencing FK risk: UnitPackage has a `parent` field that
 * forms a chain (pc → pack → box → pallet). The 2-pass importer
 * creates rows shallow first (no parent), then wires the parent FK
 * once every row's id is known. Order in the CSV doesn't matter.
 */
import { erpFetch } from '@/lib/erp-api'
import type { DataToolsConfig } from '@/components/templates/master-page-config'

type Tpl = {
    id: number
    unit: number
    unit_name?: string
    unit_code?: string
    parent?: number | null
    parent_name?: string | null
    parent_ratio?: number | null
    name: string
    code?: string | null
    ratio: number
    is_default?: boolean
    order?: number
    notes?: string | null
}

type UnitOpt = { id: number; name: string; code?: string }

export function buildPackagesDataTools(
    templates: Tpl[],
    units: UnitOpt[],
): DataToolsConfig {
    const tplsById = new Map(templates.map(t => [t.id, t]))
    const unitsByCode: Record<string, number> = {}
    for (const u of units) {
        if (u.code) unitsByCode[u.code.toLowerCase()] = u.id
    }

    return {
        title: 'Template Data',
        exportFilename: 'package-templates',
        exportColumns: [
            // `id`, `unit_id`, `parent_id` are immutable round-trip keys.
            // The text twins (`unit_code`, `parent_code`) are kept for
            // human-readable cross-instance imports — operators can
            // hand-edit a CSV without touching numeric ids.
            { key: 'id', label: 'ID', format: (item) => (item as Tpl).id ?? '' },
            { key: 'name', label: 'Name' },
            { key: 'code', label: 'Code', format: (item) => (item as Tpl).code ?? '' },
            { key: 'unit_id', label: 'Unit ID', format: (item) => (item as Tpl).unit ?? '' },
            { key: 'unit_code', label: 'Unit', format: (item) => (item as Tpl).unit_code ?? '' },
            { key: 'parent_id', label: 'Parent ID', format: (item) => (item as Tpl).parent ?? '' },
            { key: 'parent_name', label: 'Parent', format: (item) => {
                const t = item as Tpl
                if (t.parent_name) return t.parent_name
                if (t.parent && tplsById.get(t.parent)) return tplsById.get(t.parent)!.name
                return ''
            }},
            { key: 'parent_ratio', label: 'Parent Ratio', format: (item) => (item as Tpl).parent_ratio ?? '' },
            { key: 'ratio', label: 'Ratio (base units)', format: (item) => (item as Tpl).ratio ?? 1 },
            { key: 'is_default', label: 'Default', format: (item) => (item as Tpl).is_default ? 'true' : 'false' },
            { key: 'order', label: 'Order', format: (item) => (item as Tpl).order ?? 0 },
            { key: 'notes', label: 'Notes', format: (item) => (item as Tpl).notes ?? '' },
        ],
        print: {
            title: 'Package Templates',
            subtitle: 'Per-Unit Packaging Catalog',
            prefKey: 'print.unit-packages',
            sortBy: 'unit_code',
            columns: [
                { key: 'unit_code', label: 'Unit', mono: true, defaultOn: true, width: '70px' },
                { key: 'name', label: 'Template', defaultOn: true },
                { key: 'code', label: 'Code', mono: true, defaultOn: true, width: '80px' },
                { key: 'parent', label: 'Parent', mono: true, defaultOn: true, width: '100px' },
                { key: 'ratio', label: 'Ratio', mono: true, align: 'right', defaultOn: true, width: '80px' },
                { key: 'is_default', label: 'Default', defaultOn: false, width: '70px' },
            ],
            rowMapper: (item) => {
                const t = item as Tpl
                return {
                    unit_code: t.unit_code || '',
                    name: t.name,
                    code: t.code || '',
                    parent: t.parent_name || (t.parent && tplsById.get(t.parent)?.name) || '—',
                    ratio: t.ratio,
                    is_default: t.is_default ? '✓' : '',
                }
            },
        },
        import: {
            entity: 'template',
            entityPlural: 'templates',
            endpoint: 'unit-packages/',
            columns: [
                { name: 'id',           required: false, desc: 'Existing template id — when set, the row is updated (PATCH). Leave blank for new rows.', example: '12' },
                { name: 'name',         required: true,  desc: 'Display name (e.g. "Pack of 6")', example: 'Pack of 6' },
                { name: 'code',         required: false, desc: 'Short code (e.g. "PK6")', example: 'PK6' },
                { name: 'unit_id',      required: false, desc: 'Unit id — preferred over unit_code when both are present.', example: '4' },
                { name: 'unit_code',    required: false, desc: 'Unit code (fallback when unit_id is empty). Either unit_id OR unit_code is required for new rows.', example: 'PC' },
                { name: 'parent_id',    required: false, desc: 'Parent template id (chain link). Leave blank for the base level.', example: '8' },
                { name: 'parent_name',  required: false, desc: 'Parent template name (fallback when parent_id is empty). Resolved within the same unit family.', example: 'Pack of 6' },
                { name: 'parent_ratio', required: false, desc: 'Multiplier vs parent (e.g. 4 boxes per pallet)', example: '4' },
                { name: 'ratio',        required: false, desc: 'Total base units this level contains (auto-derived from chain when parent is set).', example: '24' },
                { name: 'is_default',   required: false, desc: 'true / false — primary template for this unit (max one per unit)', example: 'false' },
                { name: 'order',        required: false, desc: 'Display order within the unit (ascending)', example: '0' },
                { name: 'notes',        required: false, desc: 'Free-text notes', example: '' },
            ],
            sampleCsv:
                'id,name,code,unit_id,unit_code,parent_id,parent_name,parent_ratio,ratio,is_default,order,notes\n' +
                ',Piece,PC,,PC,,,,1,true,0,\n' +
                ',Pack of 6,PK6,,PC,,Piece,6,6,false,1,\n' +
                ',Box of 24,BX24,,PC,,Pack of 6,4,24,false,2,\n' +
                ',Pallet of 144,PL144,,PC,,Box of 24,6,144,false,3,',
            previewColumns: [
                { key: 'name',         label: 'Name' },
                { key: 'unit_code',    label: 'Unit', mono: true },
                { key: 'parent_name',  label: 'Parent', mono: true },
                { key: 'ratio',        label: 'Ratio', mono: true },
                { key: 'is_default',   label: 'Default', mono: true },
            ],
            // Used only when no parent / id logic is needed. The 2-pass
            // `runImport` below uses its own builder so it can strip
            // `parent` and `parent_ratio` for pass 1.
            buildPayload: (row: Record<string, string>) => {
                const truthy = (v: string | undefined, def: boolean) => {
                    if (v == null || v === '') return def
                    return /^(true|1|yes|y)$/i.test(v.trim())
                }
                const unitId = (row.unit_id || '').trim()
                const unitCode = (row.unit_code || '').trim()
                const unit = unitId
                    ? Number(unitId)
                    : unitCode
                        ? unitsByCode[unitCode.toLowerCase()]
                        : null
                return {
                    name: row.name,
                    code: row.code || null,
                    unit,
                    ratio: row.ratio ? Number(row.ratio) : 1,
                    is_default: truthy(row.is_default, false),
                    order: row.order ? Number(row.order) : 0,
                    notes: row.notes || null,
                }
            },
            // Two-pass runner — solves the forward-reference problem
            // baked into the simple loop. Same shape as the Units one.
            //   Pass 1 — POST/PATCH each row WITHOUT parent / parent_ratio.
            //            PATCH when the row carries an `id` (upsert), POST
            //            otherwise. Capture the resulting id in name→id
            //            and code→id maps (scoped per unit so duplicate
            //            template names across units don't collide).
            //   Pass 2 — PATCH each row's `parent` + `parent_ratio` using
            //            id-first, name-fallback within the same unit.
            //            Failures here flip the row's result to "Saved,
            //            but parent wiring failed:..." so the operator
            //            can fix it.
            runImport: async (rows) => {
                const truthy = (v: string | undefined, def: boolean) => {
                    if (v == null || v === '') return def
                    return /^(true|1|yes|y)$/i.test(v.trim())
                }
                // Map of unitId → (lower-name → templateId), seeded from
                // existing templates so cross-instance imports referencing
                // a parent that's already in the tenant resolve correctly.
                const nameToId: Map<number, Map<string, number>> = new Map()
                for (const t of templates) {
                    const u = t.unit
                    if (!nameToId.has(u)) nameToId.set(u, new Map())
                    if (t.name) nameToId.get(u)!.set(t.name.toLowerCase(), t.id)
                }
                const pass1: { row: Record<string, string>; id: number | null; unit: number | null; result: { name: string; ok: boolean; error?: string } }[] = []

                for (const row of rows) {
                    const csvId = (row.id || '').trim()
                    const unitId = (row.unit_id || '').trim()
                    const unitCode = (row.unit_code || '').trim()
                    const resolvedUnit = unitId
                        ? Number(unitId)
                        : unitCode
                            ? unitsByCode[unitCode.toLowerCase()]
                            : null
                    if (!csvId && !resolvedUnit) {
                        pass1.push({ row, id: null, unit: null, result: { name: row.name, ok: false, error: 'unit_id or unit_code is required for new rows.' } })
                        continue
                    }
                    const baseShallow: Record<string, unknown> = {
                        name: row.name,
                        code: row.code || null,
                        unit: resolvedUnit,
                        ratio: row.ratio ? Number(row.ratio) : 1,
                        is_default: truthy(row.is_default, false),
                        order: row.order ? Number(row.order) : 0,
                        notes: row.notes || null,
                        // Strip parent for pass 1.
                        parent: null,
                        parent_ratio: null,
                    }
                    try {
                        let resultId: number
                        let resultUnit: number | null = resolvedUnit
                        if (csvId) {
                            const updated = await erpFetch(`unit-packages/${csvId}/`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(baseShallow),
                            })
                            resultId = Number(updated?.id ?? csvId)
                            resultUnit = Number(updated?.unit ?? resolvedUnit)
                        } else {
                            const created = await erpFetch('unit-packages/', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(baseShallow),
                            })
                            resultId = Number(created?.id)
                            resultUnit = Number(created?.unit ?? resolvedUnit)
                        }
                        if (resultUnit && row.name) {
                            if (!nameToId.has(resultUnit)) nameToId.set(resultUnit, new Map())
                            nameToId.get(resultUnit)!.set(row.name.toLowerCase(), resultId)
                        }
                        pass1.push({ row, id: resultId, unit: resultUnit, result: { name: row.name, ok: true } })
                    } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : String(e ?? 'failed')
                        pass1.push({ row, id: null, unit: null, result: { name: row.name, ok: false, error: msg } })
                    }
                }

                // ── Pass 2: wire parent + parent_ratio ──
                for (const p of pass1) {
                    if (!p.id || !p.unit) continue
                    const parentId = (p.row.parent_id || '').trim()
                    const parentName = (p.row.parent_name || '').trim()
                    const resolvedParent = parentId
                        ? Number(parentId)
                        : parentName
                            ? nameToId.get(p.unit)?.get(parentName.toLowerCase())
                            : null
                    const parentRatioRaw = (p.row.parent_ratio || '').trim()
                    if (!resolvedParent && !parentRatioRaw) continue
                    if (resolvedParent === p.id) continue // can't be its own parent
                    const patch: Record<string, unknown> = {}
                    if (resolvedParent) patch.parent = resolvedParent
                    if (parentRatioRaw) patch.parent_ratio = Number(parentRatioRaw)
                    try {
                        await erpFetch(`unit-packages/${p.id}/`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(patch),
                        })
                    } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : String(e ?? 'parent FK failed')
                        p.result.ok = false
                        p.result.error = `Saved, but parent wiring failed: ${msg}`
                    }
                }
                return pass1.map(p => p.result)
            },
            tip: (
                <>
                    <strong>Tip:</strong> Order doesn&apos;t matter — the importer wires <code>parent</code> in a second pass.
                    Re-importing an exported CSV updates rows by <code>id</code>; <code>parent_id</code> is preferred over <code>parent_name</code>.
                </>
            ),
        },
    }
}
