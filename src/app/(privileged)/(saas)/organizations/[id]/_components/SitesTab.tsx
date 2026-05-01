'use client'

import { Plus, Building2, MapPin, Power } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { SaasSite } from '@/types/erp'

interface SitesTabProps {
    sites: SaasSite[]
    onCreateSite: () => void
    onToggleSite: (siteId: string) => void | Promise<void>
}

export function SitesTab({ sites, onCreateSite, onToggleSite }: SitesTabProps) {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-app-foreground">Organization Sites</h3>
                    <p className="text-sm text-app-muted-foreground">{sites.length} site{sites.length !== 1 ? 's' : ''} — branches, warehouses, locations</p>
                </div>
                <Button onClick={onCreateSite} className="bg-app-accent-strong hover:bg-app-accent-strong text-white rounded-xl font-bold shadow-md">
                    <Plus size={16} className="mr-2" /> Add Site
                </Button>
            </div>

            {sites.length === 0 ? (
                <Card className="border-app-border shadow-sm">
                    <CardContent className="py-12 text-center text-app-muted-foreground italic">No sites found. Create the first site for this organization.</CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sites.map(site => (
                        <div key={site.id} className={`p-5 rounded-2xl border transition-all ${site.is_active
                            ? 'bg-app-surface border-app-border hover:border-app-accent shadow-sm'
                            : 'bg-app-surface border-app-border opacity-60'
                            }`}>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${site.is_active
                                        ? 'bg-app-accent-bg text-app-accent border border-app-accent'
                                        : 'bg-app-surface-2 text-app-muted-foreground border border-app-border'
                                        }`}>
                                        <Building2 size={18} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-app-foreground text-sm">{site.name}</span>
                                            {site.code && (
                                                <span className="text-[9px] font-mono text-app-accent bg-app-accent-bg px-2 py-0.5 rounded-md border border-app-accent">{site.code}</span>
                                            )}
                                            <Badge className={site.is_active
                                                ? "bg-app-success-bg text-app-success border-app-success text-[9px]"
                                                : "bg-app-error-bg text-app-error border-app-error text-[9px]"
                                            }>
                                                {site.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1">
                                            {site.city && <span className="text-xs text-app-muted-foreground flex items-center gap-1"><MapPin size={10} />{site.city}</span>}
                                            {site.phone && <span className="text-xs text-app-muted-foreground">{site.phone}</span>}
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => onToggleSite(String(site.id))} className="transition-transform hover:scale-110">
                                    <Power size={18} className={site.is_active ? 'text-app-success' : 'text-app-faint'} />
                                </button>
                            </div>
                            {(site.address || site.vat_number) && (
                                <div className="mt-3 pt-3 border-t border-app-border flex justify-between text-xs text-app-muted-foreground">
                                    {site.address && <span>{site.address}</span>}
                                    {site.vat_number && <span>VAT: {site.vat_number}</span>}
                                </div>
                            )}
                            <div className="mt-2 text-[10px] text-app-faint">
                                Created: {site.created_at ? new Date(site.created_at).toLocaleDateString() : 'N/A'}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
