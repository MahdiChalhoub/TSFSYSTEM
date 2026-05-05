"use client"
import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, CheckCircle2, Banknote, DatabaseZap } from "lucide-react"
import { toast } from "sonner"

export function COAMappingModal({
    open,
    onOpenChange,
    data,
    onSave,
    loading
}: {
    open: boolean,
    onOpenChange: (open: boolean) => void,
    data: any,
    onSave: (mappings: any[]) => void,
    loading: boolean
}) {
    const [localMappings, setLocalMappings] = useState<Record<number, number>>({})

    useEffect(() => {
        if (data?.accounts) {
            const initial: Record<number, number> = {}
            data.accounts.forEach((acc: any) => {
                if (acc.ledger_account_id) initial[acc.id] = acc.ledger_account_id
            })
            setLocalMappings(initial)
        }
    }, [data])

    const handleSelect = (accountId: number, coaId: string) => {
        setLocalMappings(prev => ({ ...prev, [accountId]: parseInt(coaId) }))
    }

    const handleAutoMap = () => {
        if (!data?.accounts || !data?.coa_options) return

        const newMappings = { ...localMappings }
        let matchCount = 0

        const stopWords = ['account', 'arap', 'payable', 'receivable', 'liability', 'asset', 'unmapped']
        const tokenize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(' ').filter(w => w.length > 2 && !stopWords.includes(w))

        data.accounts.forEach((acc: any) => {
            if (newMappings[acc.id]) return

            const sourceName = (acc.name || "").toLowerCase().trim()
            if (!sourceName) return

            const sourceTokens = tokenize(sourceName)

            // Try matching by name or code
            let bestMatch = null
            let highestScore = 0

            data.coa_options.forEach((coa: any) => {
                const targetName = coa.name.toLowerCase().trim()
                const targetCode = (coa.code || "").toLowerCase().trim()

                let score = 0
                // Exact Match
                if (sourceName === targetName) score = 100
                // Token Intersection Match
                else {
                    const targetTokens = tokenize(targetName)
                    const intersection = sourceTokens.filter(t => targetTokens.includes(t))
                    if (intersection.length > 0) {
                        score = (intersection.length / Math.max(sourceTokens.length, targetTokens.length)) * 50
                    }
                }

                // Code Match
                if (targetCode && sourceTokens.includes(targetCode)) score += 40

                if (score > highestScore && score > 20) {
                    highestScore = score
                    bestMatch = coa
                }
            })

            if (bestMatch) {
                newMappings[acc.id] = (bestMatch as any).id
                matchCount++
            }
        })

        setLocalMappings(newMappings)
        toast.info(`Smart Auto-mapped ${matchCount} accounts.`)
    }

    const handleSave = () => {
        const payload = Object.entries(localMappings).map(([target_id, coa_id]) => ({
            target_id: parseInt(target_id),
            coa_id
        }))
        onSave(payload)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] bg-app-surface border-app-border shadow-2xl text-app-foreground overflow-hidden flex flex-col p-0">
                <DialogHeader className="p-6 bg-app-bg border-b border-app-border">
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="flex items-center gap-2 text-xl font-black text-app-foreground">
                                <Banknote className="w-6 h-6 text-emerald-600" />
                                FINANCIAL ACCOUNT MAPPING
                            </DialogTitle>
                            <DialogDescription className="text-app-muted-foreground font-medium mt-1">
                                Associate imported accounts with your Chart of Accounts.
                            </DialogDescription>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAutoMap}
                            className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold gap-2"
                        >
                            <DatabaseZap className="w-4 h-4" />
                            Auto-Map by Name
                        </Button>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 px-6">
                    <div className="space-y-6 py-6">
                        {(() => {
                            const accounts = data?.accounts || [];
                            const unmapped = accounts.filter((acc: any) => !localMappings[acc.id]);
                            const mapped = accounts.filter((acc: any) => localMappings[acc.id]);

                            return (
                                <>
                                    {/*  Unmapped Accounts List  */}
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-[1fr,1.5fr] gap-4 font-bold text-[10px] uppercase tracking-wider text-amber-600 mb-2 px-4">
                                            <div>Action Required ({unmapped.length})</div>
                                            <div>TSF Chart of Account (Target)</div>
                                        </div>
                                        {unmapped.length === 0 ? (
                                            <div className="px-4 py-8 text-center text-sm font-bold text-app-muted-foreground border border-dashed border-app-border rounded-xl bg-gray-50/50">
                                                All accounts are mapped.
                                            </div>
                                        ) : (
                                            unmapped.map((acc: any) => (
                                                <div key={acc.id} className="grid grid-cols-[1fr,1.5fr] gap-4 items-center bg-amber-50/30 p-4 rounded-xl border border-amber-200/50 hover:border-amber-400 hover:shadow-md transition-all group">
                                                    <div className="pl-1">
                                                        <p className="text-sm font-bold text-app-foreground group-hover:text-amber-800 transition-colors uppercase tracking-tight">{acc.name}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            {acc.source_name ? (
                                                                <>
                                                                    <Badge variant="outline" className="text-[9px] font-bold py-0 leading-tight bg-app-surface border-amber-200 text-amber-600 flex items-center gap-1">
                                                                        IMPORTED
                                                                    </Badge>
                                                                    <p className="text-[10px] text-app-muted-foreground font-mono truncate max-w-[150px]">{acc.source_name}</p>
                                                                </>
                                                            ) : (
                                                                <Badge variant="outline" className="text-[9px] font-bold py-0 leading-tight bg-app-surface border-app-border text-app-muted-foreground">
                                                                    SYSTEM ACCOUNT
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Select
                                                            value={localMappings[acc.id]?.toString()}
                                                            onValueChange={(val) => handleSelect(acc.id, val)}
                                                        >
                                                            <SelectTrigger className="bg-app-surface border-amber-300 text-[11px] h-10 hover:border-amber-400 transition-all font-semibold shadow-sm text-app-muted-foreground">
                                                                <SelectValue placeholder="Associate Target COA..." />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-app-surface border-app-border text-app-foreground max-h-[300px]">
                                                                {data?.coa_options?.map((coa: any) => (
                                                                    <SelectItem key={coa.id} value={coa.id.toString()} className="text-[11px] focus:bg-emerald-50 focus:text-emerald-700">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-mono text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded text-[10px]">{coa.code}</span>
                                                                            <span className="font-bold text-app-muted-foreground">{coa.name}</span>
                                                                            <span className="text-[9px] text-app-muted-foreground font-bold uppercase tracking-tighter ml-auto">({coa.type})</span>
                                                                        </div>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/*  Mapped Accounts List  */}
                                    {mapped.length > 0 && (
                                        <div className="space-y-3 pt-6 border-t border-app-border">
                                            <div className="grid grid-cols-[1fr,1.5fr] gap-4 font-bold text-[10px] uppercase tracking-wider text-emerald-600 mb-2 px-4">
                                                <div>Mapped Accounts ({mapped.length})</div>
                                                <div>TSF Chart of Account (Target)</div>
                                            </div>
                                            {mapped.map((acc: any) => (
                                                <div key={acc.id} className="grid grid-cols-[1fr,1.5fr] gap-4 items-center bg-app-surface p-4 rounded-xl border border-app-border hover:border-emerald-300 hover:shadow-md transition-all group">
                                                    <div className="pl-1">
                                                        <p className="text-sm font-bold text-app-foreground group-hover:text-emerald-700 transition-colors uppercase tracking-tight">{acc.name}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            {acc.source_name ? (
                                                                <>
                                                                    <Badge variant="outline" className="text-[9px] font-bold py-0 leading-tight bg-app-bg border-app-border text-app-muted-foreground flex items-center gap-1">
                                                                        IMPORTED
                                                                    </Badge>
                                                                    <p className="text-[10px] text-app-muted-foreground font-mono truncate max-w-[150px]">{acc.source_name}</p>
                                                                </>
                                                            ) : (
                                                                <Badge variant="outline" className="text-[9px] font-bold py-0 leading-tight bg-app-bg border-app-border text-app-muted-foreground">
                                                                    SYSTEM ACCOUNT
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Select
                                                            value={localMappings[acc.id]?.toString()}
                                                            onValueChange={(val) => handleSelect(acc.id, val)}
                                                        >
                                                            <SelectTrigger className="bg-emerald-50/50 border-emerald-200 text-[11px] h-10 hover:border-emerald-400 transition-all font-semibold shadow-sm text-emerald-900">
                                                                <SelectValue placeholder="Associate Target COA..." />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-app-surface border-app-border text-app-foreground max-h-[300px]">
                                                                {data?.coa_options?.map((coa: any) => (
                                                                    <SelectItem key={coa.id} value={coa.id.toString()} className="text-[11px] focus:bg-emerald-50 focus:text-emerald-700">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-mono text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded text-[10px]">{coa.code}</span>
                                                                            <span className="font-bold text-app-muted-foreground">{coa.name}</span>
                                                                            <span className="text-[9px] text-app-muted-foreground font-bold uppercase tracking-tighter ml-auto">({coa.type})</span>
                                                                        </div>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )
                        })()}
                    </div>
                </ScrollArea>

                <div className="p-6 border-t border-app-border bg-app-bg flex justify-end gap-3 rounded-b-lg">
                    <Button variant="ghost" className="text-app-muted-foreground font-bold hover:bg-app-border" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
                    <Button
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-10 shadow-lg shadow-emerald-600/20 rounded-xl"
                        onClick={handleSave}
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                        Confirm Mappings
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
