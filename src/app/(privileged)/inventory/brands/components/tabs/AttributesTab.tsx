'use client'

/**
 * Attributes Tab — root attribute groups linked to this brand.
 *
 * Earlier this tab fetched 200 products on every open and grouped
 * them by attribute_value_name (leaf values like "100ml", "Floral")
 * — that scan was the slow part the user kept hitting. The brand
 * record now ships its M2M attribute groups directly via
 * BrandDetailSerializer.attributes, so the primary view is
 * instant. The leaf-value breakdown can come back as a lazy expander
 * later if needed.
 */

import { useEffect, useState } from 'react'
import { Loader2, Tag } from 'lucide-react'
import { erpFetch } from '@/lib/erp-api'

interface AttrGroup { id: number; name: string; code?: string }

export function AttributesTab({ brandId, brandName }: { brandId: number; brandName: string }) {
    const [loading, setLoading] = useState(true)
    const [groups, setGroups] = useState<AttrGroup[]>([])

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        erpFetch(`inventory/brands/${brandId}/`)
            .then((res: any) => {
                if (cancelled) return
                const list = Array.isArray(res?.attributes) ? res.attributes : []
                setGroups(
                    list
                        .map((a: any) => ({
                            id: typeof a === 'number' ? a : a?.id,
                            name: typeof a === 'number' ? `Attribute #${a}` : (a?.name || `Attribute #${a?.id}`),
                            code: typeof a === 'number' ? undefined : a?.code,
                        }))
                        .filter((a: any) => Number.isFinite(a.id))
                        .sort((a: any, b: any) => a.name.localeCompare(b.name))
                )
            })
            .catch(() => { if (!cancelled) setGroups([]) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [brandId])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 size={22} className="animate-spin" style={{ color: 'var(--app-success)' }} />
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-200">
            <div className="flex-shrink-0 px-4 py-2.5"
                style={{ borderBottom: '1px solid var(--app-border)' }}>
                <p className="text-tp-sm font-medium text-app-muted-foreground">
                    {groups.length} attribute group{groups.length === 1 ? '' : 's'} linked
                </p>
            </div>

            {/* Edit hint — link/unlink is done in the brand modal's
                Attributes pane, not from this tab. The tab is read-only
                so it stays fast even on big-catalogue brands. */}
            <div className="flex-shrink-0 mx-4 mt-2 mb-1 px-3 py-2 rounded-xl text-tp-xs leading-snug flex items-start gap-2"
                style={{
                    background: 'color-mix(in srgb, var(--app-info) 6%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)',
                    color: 'var(--app-info)',
                }}>
                <span className="flex-shrink-0 mt-0.5">ℹ️</span>
                <span>
                    Attribute groups (Volume, Parfum, Concentration) declare which dimensions
                    apply to <strong>{brandName}</strong>&apos;s products. The actual leaf values
                    (100ml, Floral, etc.) live on each product. To edit which groups are linked,
                    use the <strong>Attributes</strong> pane in the brand edit dialog.
                </span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {groups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <Tag size={32} className="text-app-muted-foreground mb-2 opacity-40" />
                        <p className="text-tp-md font-semibold text-app-muted-foreground">No attribute groups linked</p>
                        <p className="text-tp-sm text-app-muted-foreground mt-1">
                            {brandName} hasn&apos;t been linked to any attribute group yet.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-app-border/30">
                        {groups.map(g => (
                            <div key={g.id} className="flex items-center gap-3 px-4 py-2.5 group transition-colors hover:bg-app-surface-hover">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-success) 10%, transparent)',
                                        color: 'var(--app-success)'
                                    }}>
                                    <Tag size={13} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-tp-md font-semibold text-app-foreground truncate">{g.name}</p>
                                    {g.code && (
                                        <p className="text-tp-xxs font-mono text-app-muted-foreground mt-0.5">{g.code}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
