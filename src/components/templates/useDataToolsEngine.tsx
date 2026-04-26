'use client'

/**
 * useDataToolsEngine — Internal engine for the declarative DataTools system.
 *
 * This hook is consumed ONLY by TreeMasterPage and DajingoPageShell.
 * Pages never import this directly — they pass declarative config to the shell.
 *
 * Given a DataToolsConfig + data array, it returns:
 *   - resolved callbacks for the DataMenu dropdown
 *   - a JSX element with pre-wired PrintDialog + GenericCsvImportDialog modals
 */

import { useState, useMemo, useCallback, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { exportExcel } from '@/components/admin/_shared/excel-export'
import { GenericCsvImportDialog } from '@/components/admin/_shared/GenericCsvImportDialog'
import { PrintDialog, type PrintSpec } from '@/components/admin/_shared/PrintDialog'
import type { DataToolsConfig } from './master-page-config'

interface EngineInput {
    /** The DataToolsConfig from the page's config */
    dataTools: DataToolsConfig | undefined
    /** The full (unfiltered) dataset — needed for export/print */
    data: any[] | undefined
    /** Fallback filename prefix (derived from page title) */
    titleFallback?: string
}

interface EngineOutput {
    /** Resolved callbacks for the DataMenu component */
    menuCallbacks: {
        onExport?: () => void
        onExportExcel?: () => void
        onImport?: () => void
        onPrint?: () => void
        title?: string
    } | null
    /** Pre-wired modal JSX — render this anywhere in the component tree */
    modals: ReactNode
}

/* ── CSV helpers ──────────────────────────────────────────── */
const escapeCsv = (v: any) => {
    const s = (v ?? '').toString()
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function useDataToolsEngine({ dataTools, data, titleFallback }: EngineInput): EngineOutput {
    const router = useRouter()
    const [showImport, setShowImport] = useState(false)
    const [showPrint, setShowPrint] = useState(false)

    // Early exit — no dataTools config at all
    if (!dataTools) {
        return { menuCallbacks: null, modals: null }
    }

    const dt = dataTools
    const items = data || []
    const filenamePrefix = dt.exportFilename || titleFallback?.toLowerCase().replace(/\s+/g, '-') || 'export'

    /* ═══════════════════════════════════════════════════
     *  CSV EXPORT — auto-generated from exportColumns
     * ═══════════════════════════════════════════════════ */
    const handleExportCsv = dt.onExport || (dt.exportColumns ? () => {
        if (!items.length) { toast.info('No data to export'); return }
        const cols = dt.exportColumns!
        const headers = cols.map(c => c.label)
        const lines = [headers.map(escapeCsv).join(',')]
        items.forEach(item => {
            const row = cols.map(c => c.format ? c.format(item) : (item[c.key] ?? ''))
            lines.push(row.map(escapeCsv).join(','))
        })
        const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success(`Exported ${items.length} rows`)
    } : undefined)

    /* ═══════════════════════════════════════════════════
     *  EXCEL EXPORT — auto-generated from exportColumns
     * ═══════════════════════════════════════════════════ */
    const handleExportExcel = dt.onExportExcel || (dt.exportColumns ? () => {
        if (!items.length) { toast.info('No data to export'); return }
        const cols = dt.exportColumns!
        const rows = items.map(item =>
            cols.map(c => c.format ? c.format(item) : (item[c.key] ?? ''))
        )
        exportExcel({
            filename: `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.xls`,
            sheetName: titleFallback || 'Sheet1',
            columns: cols.map(c => c.label),
            rows,
        })
        toast.success(`Exported ${items.length} rows to Excel`)
    } : undefined)

    /* ═══════════════════════════════════════════════════
     *  IMPORT — open the GenericCsvImportDialog
     * ═══════════════════════════════════════════════════ */
    const handleImport = dt.onImport || (dt.import ? () => setShowImport(true) : undefined)

    /* ═══════════════════════════════════════════════════
     *  PRINT — open the PrintDialog
     * ═══════════════════════════════════════════════════ */
    const handlePrint = dt.onPrint || (dt.print ? () => setShowPrint(true) : undefined)

    /* ═══════════════════════════════════════════════════
     *  PRINT SPEC — built from declarative config + data
     * ═══════════════════════════════════════════════════ */
    const printSpec: PrintSpec | null = dt.print ? (() => {
        const pc = dt.print!
        let mapped = items.map(pc.rowMapper)
        if (pc.sortBy) {
            mapped = [...mapped].sort((a, b) =>
                String(a[pc.sortBy!] ?? '').localeCompare(String(b[pc.sortBy!] ?? ''))
            )
        }
        return {
            title: pc.title,
            subtitle: pc.subtitle,
            prefKey: pc.prefKey,
            columns: pc.columns,
            rows: mapped,
            filterLine: pc.filterLine,
        }
    })() : null

    /* ═══════════════════════════════════════════════════
     *  MODALS — pre-wired, rendered by the shell
     * ═══════════════════════════════════════════════════ */
    const modals = (
        <>
            {dt.import && (
                <GenericCsvImportDialog
                    isOpen={showImport}
                    onClose={() => setShowImport(false)}
                    onDone={() => { setShowImport(false); router.refresh() }}
                    entity={dt.import.entity}
                    entityPlural={dt.import.entityPlural}
                    endpoint={dt.import.endpoint}
                    columns={dt.import.columns}
                    sampleCsv={dt.import.sampleCsv}
                    previewColumns={dt.import.previewColumns}
                    buildPayload={dt.import.buildPayload}
                    tip={dt.import.tip}
                />
            )}
            {printSpec && (
                <PrintDialog
                    isOpen={showPrint}
                    onClose={() => setShowPrint(false)}
                    spec={printSpec}
                />
            )}
        </>
    )

    return {
        menuCallbacks: {
            onExport: handleExportCsv,
            onExportExcel: handleExportExcel,
            onImport: handleImport,
            onPrint: handlePrint,
            title: dt.title,
        },
        modals,
    }
}
