// @ts-nocheck
'use client'

/**
 * BulkMoveDialog — built-in move dialog for TreeMasterPage.
 * =========================================================
 * Rendered automatically when `config.bulkMove` is provided.
 * Handles:
 *   - Target selection (dropdown of move targets)
 *   - PATCH calls for each selected item
 *   - Success/failure toasting
 *   - Selection cleanup on completion
 *
 * Consumers never touch this directly — they declare `bulkMove`
 * config and TreeMasterPage wires everything.
 */

import { useState } from 'react'
import { X, FolderTree, Loader2 } from 'lucide-react'
import { erpFetch } from '@/lib/erp-api'
import { toast } from 'sonner'
import type { BulkMoveConfig } from './master-page-config'

interface Props {
    config: BulkMoveConfig
    selectedIds: number[]
    /** All data items — used to show which items will be moved. */
    allItems?: any[]
    onClose: () => void
    onDone: () => void
}

export function BulkMoveDialog({ config, selectedIds, allItems, onClose, onDone }: Props) {
    const [target, setTarget] = useState<number | ''>('')
    const [running, setRunning] = useState(false)

    const selectedNames = allItems
        ? allItems.filter(i => selectedIds.includes(i.id)).map(i => i.name || `#${i.id}`)
        : selectedIds.map(id => `#${id}`)

    const run = async () => {
        setRunning(true)
        let ok = 0, fail = 0
        const payload = { [config.field]: target === '' ? null : target }
        for (const id of selectedIds) {
            try {
                await erpFetch(`${config.endpoint}/${id}/`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                ok++
            } catch {
                fail++
            }
        }
        setRunning(false)
        if (fail === 0) {
            toast.success(`Moved ${ok} item${ok !== 1 ? 's' : ''} to ${target === '' ? config.nullLabel || 'root' : config.targets.find(t => t.id === target)?.name || 'target'}`)
        } else {
            toast.warning(`${ok} moved, ${fail} failed`)
        }
        onDone()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
             onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-lg max-h-[92vh] rounded-2xl overflow-hidden flex flex-col"
                 style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>

                {/* ── Header ── */}
                <div className="px-5 py-3 flex items-center justify-between flex-shrink-0"
                     style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                             style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <FolderTree size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-app-foreground">Move to {config.targetLabel}</h3>
                            <p className="text-tp-xs font-bold text-app-muted-foreground">
                                {selectedIds.length} item{selectedIds.length !== 1 ? 's' : ''} selected
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose}
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <X size={16} />
                    </button>
                </div>

                {/* ── Body ── */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                    {/* Selected items chips */}
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                        {selectedNames.map((name, i) => (
                            <span key={i} className="text-tp-xs font-bold px-2 py-0.5 rounded"
                                  style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                {name}
                            </span>
                        ))}
                    </div>

                    {/* Target selector */}
                    <div>
                        <label className="text-tp-xxs font-bold uppercase tracking-widest mb-1.5 block"
                               style={{ color: 'var(--app-muted-foreground)' }}>
                            New {config.targetLabel}
                        </label>
                        <select value={target}
                                onChange={e => setTarget(e.target.value ? Number(e.target.value) : '')}
                                className="w-full px-3 py-2 rounded-xl text-tp-md font-bold outline-none"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                            {config.allowNull && (
                                <option value="">{config.nullLabel || '— None —'}</option>
                            )}
                            {!config.allowNull && <option value="" disabled>Select {config.targetLabel}…</option>}
                            {config.targets
                                .filter(t => !selectedIds.includes(t.id))
                                .map(t => (
                                    <option key={t.id} value={t.id}>{t.path || t.name}</option>
                                ))
                            }
                        </select>
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="px-5 py-3 flex items-center gap-2 flex-shrink-0"
                     style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 40%, var(--app-surface))' }}>
                    <div className="flex-1 text-tp-xs font-bold text-app-muted-foreground">
                        Moving {selectedIds.length} item{selectedIds.length !== 1 ? 's' : ''}
                    </div>
                    <button onClick={onClose} disabled={running}
                            className="px-4 py-2 rounded-xl text-tp-xs font-bold transition-all disabled:opacity-50"
                            style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                        Cancel
                    </button>
                    <button onClick={run}
                            disabled={running || (target === '' && !config.allowNull)}
                            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-tp-xs font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
                            style={{ background: 'var(--app-primary)', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                        {running ? <Loader2 size={13} className="animate-spin" /> : <FolderTree size={13} />}
                        Move
                    </button>
                </div>
            </div>
        </div>
    )
}
