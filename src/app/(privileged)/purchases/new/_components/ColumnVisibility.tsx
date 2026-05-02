'use client'

/**
 * ColumnVisibility — Slide-in sidebar panel for toggling column visibility
 * in the PO Intelligence Grid.
 * 
 * This component is now a thin wrapper around the shared CustomizePanel template.
 * Any improvements to the shared template will automatically apply here.
 */

import { ListFilter } from 'lucide-react'
import { CustomizePanel } from '@/components/ui/CustomizePanel/CustomizePanel'
import type { POViewProfile } from '../_lib/profiles'
import { saveProfiles, saveActiveProfileId } from '../_lib/profiles'
import { COLUMN_DEFS, DEFAULT_VISIBLE, DEFAULT_ORDER } from '../_lib/columns'
import type { ColumnKey } from '../_lib/columns'

/* ────────────────────────────────────────────────────────────
 *  Toolbar Button (triggers panel open)
 * ──────────────────────────────────────────────────────────── */
type ButtonProps = {
    visibleColumns: Set<ColumnKey>
    onClick: () => void
}

export function ColumnVisibilityButton({ visibleColumns, onClick }: ButtonProps) {
    const hiddenCount = COLUMN_DEFS.filter(c => !c.alwaysVisible && !visibleColumns.has(c.key)).length
    return (
        <button type="button" onClick={onClick}
                className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all flex-shrink-0">
            <ListFilter size={13} />
            <span className="hidden md:inline">Cols</span>
            {hiddenCount > 0 && (
                <span className="ml-0.5 w-4 h-4 rounded-full text-[8px] font-black flex items-center justify-center text-white"
                      style={{ background: 'var(--app-primary)' }}>
                    {hiddenCount}
                </span>
            )}
        </button>
    )
}

/* ────────────────────────────────────────────────────────────
 *  Sidebar Panel Wrapper
 * ──────────────────────────────────────────────────────────── */
type PanelProps = {
    isOpen: boolean
    onClose: () => void
    visibleColumns: Set<ColumnKey>
    onToggle: (key: ColumnKey) => void
    columnOrder: ColumnKey[]
    onReorder: (order: ColumnKey[]) => void
    // Profile management
    profiles: POViewProfile[]
    setProfiles: React.Dispatch<React.SetStateAction<POViewProfile[]>>
    activeProfileId: string
    switchProfile: (id: string) => void
    onShare?: (id: string, shared: boolean) => void
    isStaff?: boolean
}

export function ColumnVisibilityPanel({
    isOpen, onClose, visibleColumns, onToggle, columnOrder, onReorder,
    profiles, setProfiles, activeProfileId, switchProfile,
    onShare, isStaff
}: PanelProps) {
    
    // Map Set<ColumnKey> to Record<string, boolean> for the shared component
    const visibilityMap: Record<string, boolean> = {}
    COLUMN_DEFS.forEach(c => { visibilityMap[c.key] = visibleColumns.has(c.key) })

    return (
        <CustomizePanel<ColumnKey, string>
            isOpen={isOpen}
            onClose={onClose}
            title="Customize Grid"
            
            allColumns={COLUMN_DEFS}
            
            profiles={profiles}
            setProfiles={setProfiles}
            activeProfileId={activeProfileId}
            switchProfile={switchProfile}
            
            visibleColumns={visibilityMap as Record<ColumnKey, boolean>}
            columnOrder={columnOrder}
            
            onToggleColumn={(key) => onToggle(key)}
            onReorderColumns={(order) => onReorder(order)}
            onResetColumns={() => {
                COLUMN_DEFS.forEach(c => {
                    if (!visibleColumns.has(c.key)) onToggle(c.key)
                })
                onReorder([...DEFAULT_ORDER])
            }}
            
            onSaveProfiles={(p) => saveProfiles(p)}
            onSaveActiveId={(id) => saveActiveProfileId(id)}
            onShareProfile={onShare}
            isStaff={isStaff}
        />
    )
}

// Re-export shared types for convenience
export { COLUMN_DEFS, DEFAULT_VISIBLE, DEFAULT_ORDER } from '../_lib/columns'
export type { ColumnKey, ColumnDef } from '../_lib/columns'
