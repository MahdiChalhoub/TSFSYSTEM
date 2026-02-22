'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, MapPin, Package, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { syncLegacyProducts, syncLegacyLocations } from "@/app/actions/inventory/stock-count"

export function SyncPanel() {
    const [syncingLocations, setSyncingLocations] = useState(false)
    const [syncingProducts, setSyncingProducts] = useState(false)
    const [prodProgress, setProdProgress] = useState({ current: 0, total: 0, lastId: 0 })
    const [stats, setStats] = useState({ products: 0, locations: 0 })

    async function handleSyncLocations() {
        setSyncingLocations(true)
        try {
            const res = await syncLegacyLocations()
            if (res.success) {
                toast.success(`Synced ${res.total_synced} locations`)
                setStats(s => ({ ...s, locations: s.locations + res.total_synced }))
            } else {
                throw new Error(res.error)
            }
        } catch (e: any) {
            toast.error(`Location sync failed: ${e.message}`)
        } finally {
            setSyncingLocations(false)
        }
    }

    async function handleSyncProducts() {
        setSyncingProducts(true)
        setProdProgress({ current: 0, total: 0, lastId: 0 })
        let lastId = 0
        let total = 0
        let done = false

        try {
            while (!done) {
                const res = await syncLegacyProducts(lastId)
                if (!res.success) throw new Error(res.error)

                total += res.batch_synced
                lastId = res.last_id
                done = res.done

                setProdProgress({ current: total, total: 0, lastId }) // total is unknown from API
                setStats(s => ({ ...s, products: s.products + res.batch_synced }))

                if (done) break
            }
            toast.success(`Full product sync complete! Total: ${total}`)
        } catch (e: any) {
            toast.error(`Product sync failed: ${e.message}`)
        } finally {
            setSyncingProducts(false)
        }
    }

    return (
        <Card className="bg-gradient-to-br from-indigo-50/50 to-white border-indigo-100 shadow-sm">
            <CardHeader className="pb-3 text-center sm:text-left">
                <CardTitle className="text-lg font-bold text-indigo-900 flex items-center justify-center sm:justify-start gap-2">
                    <RefreshCw className={syncingProducts || syncingLocations ? "animate-spin" : ""} size={20} />
                    Legacy Bridge (TSFCI)
                </CardTitle>
                <CardDescription>Synchronize products and locations from the legacy inventory system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Button
                        variant="outline"
                        onClick={handleSyncLocations}
                        disabled={syncingLocations || syncingProducts}
                        className="h-auto py-4 flex flex-col items-center gap-1 border-indigo-100 hover:bg-slate-50 transition-all"
                    >
                        {syncingLocations ? <Loader2 className="animate-spin text-indigo-600" size={24} /> : <MapPin className="text-indigo-600" size={24} />}
                        <span className="font-bold text-xs">Sync locations</span>
                        <span className="text-[10px] text-muted-foreground">Import warehouses & sites</span>
                    </Button>

                    <Button
                        variant="outline"
                        onClick={handleSyncProducts}
                        disabled={syncingProducts || syncingLocations}
                        className="h-auto py-4 flex flex-col items-center gap-1 border-indigo-100 hover:bg-slate-50 transition-all"
                    >
                        {syncingProducts ? <Loader2 className="animate-spin text-amber-600" size={24} /> : <Package className="text-amber-600" size={24} />}
                        <span className="font-bold text-xs">Sync products</span>
                        <span className="text-[10px] text-muted-foreground">Fetch full catalog in batches</span>
                    </Button>
                </div>

                {syncingProducts && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            <span>Processing batch...</span>
                            <span>{prodProgress.current} items</span>
                        </div>
                        <Progress value={undefined} className="h-1.5 bg-indigo-100" />
                        <p className="text-[10px] text-slate-400 italic">This may take a few minutes for large catalogs. Do not close this panel.</p>
                    </div>
                )}

                {(stats.products > 0 || stats.locations > 0) && (
                    <div className="p-3 bg-white/60 rounded-xl border border-indigo-50 flex items-center justify-around gap-4 shadow-inner">
                        <div className="text-center">
                            <p className="text-[10px] uppercase font-black text-slate-400">Products</p>
                            <p className="text-lg font-black text-indigo-600 leading-none mt-1">+{stats.products}</p>
                        </div>
                        <div className="w-px h-8 bg-indigo-100" />
                        <div className="text-center">
                            <p className="text-[10px] uppercase font-black text-slate-400">Locations</p>
                            <p className="text-lg font-black text-emerald-600 leading-none mt-1">+{stats.locations}</p>
                        </div>
                        <div className="w-px h-8 bg-indigo-100" />
                        <div className="bg-emerald-50 p-1.5 rounded-full text-emerald-600">
                            <CheckCircle2 size={18} />
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
