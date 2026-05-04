/**
 * Units — shared DataTools config factory
 * ========================================
 * Builds the full Export / Import / Print configuration once, so the
 * desktop and mobile units pages don't drift over time. The 2-pass
 * runImport (forward-reference safe + id round-trip) lives here, so
 * any tweak — new column, sample CSV change, etc. — propagates to both
 * surfaces with zero copy/paste.
 *
 * The factory needs the live `data` array (current units in the tenant)
 * because:
 *   - export's `base_unit_code` column resolves the parent's code
 *   - import's pass-1 seeds the codeToId map from existing units
 */
import { erpFetch } from '@/lib/erp-api'
import type { UnitNode } from '../components/UnitRow'
import type { DataToolsConfig } from '@/components/templates/master-page-config'

const asUnit = (item: Record<string, unknown>) => item as unknown as UnitNode

export function buildUnitsDataTools(data: UnitNode[]): DataToolsConfig {
    return {
        title: 'Unit Data',
        exportFilename: 'units',
        exportColumns: [
            // `id` and `base_unit_id` are the immutable round-trip keys —
            // a re-import on the same instance updates rows by id and
            // wires the base-unit FK by id (immune to code renames).
            // `base_unit_code` is kept as a human-readable fallback for
            // cross-instance imports.
            { key: 'id', label: 'ID', format: (item) => asUnit(item).id ?? '' },
            { key: 'name', label: 'Name' },
            { key: 'code', label: 'Code' },
            { key: 'short_name', label: 'Short Name', format: (item) => asUnit(item).short_name || '' },
            { key: 'type', label: 'Type' },
            { key: 'conversion_factor', label: 'Conversion', format: (item) => asUnit(item).conversion_factor ?? 1 },
            { key: 'base_unit_id', label: 'Base Unit ID', format: (item) => asUnit(item).base_unit ?? '' },
            { key: 'base_unit_code', label: 'Base Unit', format: (item) => {
                const u = asUnit(item)
                const base = u.base_unit ? data.find((x) => x.id === u.base_unit) : null
                return base ? (base.code || base.name || '') : ''
            }},
            { key: 'allow_fraction', label: 'Allow Fraction', format: (item) => (item as { allow_fraction?: boolean }).allow_fraction ? 'true' : 'false' },
            { key: 'needs_balance', label: 'Needs Balance', format: (item) => asUnit(item).needs_balance ? 'true' : 'false' },
            { key: 'product_count', label: 'Products', format: (item) => asUnit(item).product_count || 0 },
        ],
        print: {
            title: 'Units of Measure',
            subtitle: 'Conversion Tree',
            prefKey: 'print.units',
            sortBy: 'code',
            columns: [
                { key: 'name', label: 'Name', defaultOn: true },
                { key: 'code', label: 'Code', mono: true, defaultOn: true, width: '90px' },
                { key: 'short', label: 'Short', mono: true, defaultOn: true, width: '80px' },
                { key: 'type', label: 'Type', defaultOn: true, width: '80px' },
                { key: 'conv', label: 'Conv.', mono: true, align: 'right', defaultOn: true, width: '80px' },
                { key: 'base', label: 'Base Unit', mono: true, defaultOn: true, width: '90px' },
                { key: 'products', label: 'Products', align: 'right', defaultOn: true, width: '80px' },
            ],
            rowMapper: (item) => {
                const u = asUnit(item)
                return {
                    name: u.name,
                    code: u.code || '',
                    short: u.short_name || '',
                    type: u.type || '',
                    conv: u.conversion_factor ?? 1,
                    base: (() => {
                        const base = u.base_unit ? data.find((x) => x.id === u.base_unit) : null
                        return base ? (base.code || base.name || '') : ''
                    })(),
                    products: u.product_count || 0,
                }
            },
        },
        import: {
            entity: 'unit',
            endpoint: 'units/',
            columns: [
                { name: 'id',                required: false, desc: 'Existing unit id — when set, the row is updated (PATCH) instead of created (POST). Leave blank for new rows.', example: '42' },
                { name: 'name',              required: true,  desc: 'Display name',                                            example: 'Kilogram' },
                { name: 'code',              required: true,  desc: 'Unique unit code',                                        example: 'KG' },
                { name: 'short_name',        required: false, desc: 'Short label (e.g. on labels)',                            example: 'kg' },
                { name: 'type',              required: false, desc: 'COUNT / WEIGHT / VOLUME / LENGTH / AREA / TIME / OTHER',  example: 'WEIGHT' },
                { name: 'conversion_factor', required: false, desc: 'How many base units this is worth (default 1)',           example: '1' },
                { name: 'base_unit_id',      required: false, desc: 'Parent unit id — preferred over base_unit_code when both are present; immune to code renames.', example: '17' },
                { name: 'base_unit_code',    required: false, desc: 'Parent unit code (fallback if base_unit_id is empty). Leave blank for base units.', example: 'G' },
                { name: 'allow_fraction',    required: false, desc: 'true / false — allow decimal qtys (default true)',        example: 'true' },
                { name: 'needs_balance',     required: false, desc: 'true / false — uses scale at POS (default false)',         example: 'false' },
            ],
            sampleCsv:
                'id,name,code,short_name,type,conversion_factor,base_unit_id,base_unit_code,allow_fraction,needs_balance\n' +
                ',Gram,G,g,WEIGHT,1,,,true,false\n' +
                ',Kilogram,KG,kg,WEIGHT,1000,,G,true,true\n' +
                ',Piece,PC,pc,COUNT,1,,,false,false',
            previewColumns: [
                { key: 'name',        label: 'Name' },
                { key: 'code',        label: 'Code', mono: true },
                { key: 'type',        label: 'Type', mono: true },
                { key: 'conversion_factor', label: 'Conv.', mono: true },
                { key: 'base_unit_code',    label: 'Base', mono: true },
            ],
            // Used only when no id/peer-FK logic is needed. The 2-pass
            // `runImport` below uses its own builder so it can strip
            // `base_unit` for pass 1.
            buildPayload: (row: Record<string, string>) => {
                const baseCode = (row.base_unit_code || '').trim()
                const baseId = (row.base_unit_id || '').trim()
                const baseUnit = baseId
                    ? Number(baseId)
                    : baseCode
                        ? (data.find((u) => (u.code || '').toLowerCase() === baseCode.toLowerCase())?.id ?? null)
                        : null
                const truthy = (v: string | undefined, def: boolean) => {
                    if (v == null || v === '') return def
                    return /^(true|1|yes|y)$/i.test(v.trim())
                }
                return {
                    name: row.name,
                    code: row.code,
                    short_name: row.short_name || null,
                    type: (row.type || 'COUNT').toUpperCase(),
                    conversion_factor: row.conversion_factor ? Number(row.conversion_factor) : 1,
                    base_unit: baseUnit,
                    allow_fraction: truthy(row.allow_fraction, true),
                    needs_balance: truthy(row.needs_balance, false),
                }
            },
            // Two-pass runner: solves the forward-reference and code-rename
            // problems baked into the simple loop.
            //   Pass 1 — POST/PATCH each row WITHOUT base_unit so no row
            //            depends on a peer that hasn't been created yet.
            //            PATCH when the row carries an `id` (upsert),
            //            POST otherwise. Capture the resulting id in a
            //            code→id map.
            //   Pass 2 — wire `base_unit` per row using id-first,
            //            code-fallback. Failures here flip the row's
            //            result to "Saved, but base_unit wiring failed:..."
            //            so the operator can fix it.
            runImport: async (rows) => {
                const truthy = (v: string | undefined, def: boolean) => {
                    if (v == null || v === '') return def
                    return /^(true|1|yes|y)$/i.test(v.trim())
                }
                const codeToId: Record<string, number> = {}
                for (const u of data) {
                    if (u.code) codeToId[u.code.toLowerCase()] = u.id
                }
                const pass1: { row: Record<string, string>; id: number | null; result: { name: string; ok: boolean; error?: string } }[] = []
                // ── Pass 1: create / update rows without FK ──
                for (const row of rows) {
                    const csvId = (row.id || '').trim()
                    const baseShallow = {
                        name: row.name,
                        code: row.code,
                        short_name: row.short_name || null,
                        type: (row.type || 'COUNT').toUpperCase(),
                        conversion_factor: row.conversion_factor ? Number(row.conversion_factor) : 1,
                        base_unit: null as number | null,
                        allow_fraction: truthy(row.allow_fraction, true),
                        needs_balance: truthy(row.needs_balance, false),
                    }
                    try {
                        let resultId: number
                        if (csvId) {
                            const updated = await erpFetch(`units/${csvId}/`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(baseShallow),
                            })
                            resultId = Number(updated?.id ?? csvId)
                        } else {
                            const created = await erpFetch('units/', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(baseShallow),
                            })
                            resultId = Number(created?.id)
                        }
                        if (row.code) codeToId[row.code.toLowerCase()] = resultId
                        pass1.push({ row, id: resultId, result: { name: row.name, ok: true } })
                    } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : String(e ?? 'failed')
                        pass1.push({ row, id: null, result: { name: row.name, ok: false, error: msg } })
                    }
                }
                // ── Pass 2: wire base_unit FK ──
                for (const p of pass1) {
                    if (!p.id) continue
                    const baseId = (p.row.base_unit_id || '').trim()
                    const baseCode = (p.row.base_unit_code || '').trim()
                    const resolved = baseId
                        ? Number(baseId)
                        : baseCode
                            ? codeToId[baseCode.toLowerCase()]
                            : null
                    if (!resolved) continue // row is a base unit (no parent)
                    if (resolved === p.id) continue // a unit can't be its own parent
                    try {
                        await erpFetch(`units/${p.id}/`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ base_unit: resolved }),
                        })
                    } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : String(e ?? 'FK failed')
                        p.result.ok = false
                        p.result.error = `Saved, but base_unit wiring failed: ${msg}`
                    }
                }
                return pass1.map(p => p.result)
            },
            tip: (
                <>
                    <strong>Tip:</strong> Order doesn&apos;t matter — the importer wires <code>base_unit</code> in a second pass.
                    Re-importing an exported CSV updates rows by <code>id</code>; <code>base_unit_id</code> is preferred over <code>base_unit_code</code>.
                </>
            ),
        },
    }
}
