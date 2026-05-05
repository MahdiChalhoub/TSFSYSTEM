'use client'

import { useEffect, useState, useRef } from "react"
import { SaasUpdateStatus, SaasUpdateHistoryEntry } from "@/types/erp"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
    getSystemStatus,
    getUpdateHistory,
    uploadKernelUpdate,
    applyKernelUpdate
} from "@/app/actions/saas/system"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    ShieldAlert,
    ShieldCheck,
    RefreshCw,
    UploadCloud,
    Zap,
    History as HistoryIcon,
    Info,
    Cpu,
    CheckCircle2,
    Clock
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

export default function SystemUpdatesPage() {
    const [status, setStatus] = useState<SaasUpdateStatus | null>(null)
    const [history, setHistory] = useState<SaasUpdateHistoryEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const [applying, setApplying] = useState<number | null>(null)
    const [pendingUpdate, setPendingUpdate] = useState<{ id: number; version: string } | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        try {
            const [statusData, historyData] = await Promise.all([
                getSystemStatus(),
                getUpdateHistory()
            ])
            setStatus(statusData)
            setHistory(historyData)
        } catch {
            toast.error("Failed to load system data")
        } finally {
            setLoading(false)
        }
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return;

        const formData = new FormData()
        formData.append('file', file)

        setSyncing(true)
        try {
            const res = await uploadKernelUpdate(formData)
            if (res.error) throw new Error(res.error)
            toast.success(res.message)
            await loadData()
        } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)))
        } finally {
            setSyncing(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    async function handleApply(id: number, version: string) {
        setApplying(id)
        try {
            const res = await applyKernelUpdate(id)
            if (res.error) throw new Error(res.error)
            toast.success(res.message)
            await loadData()
        } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)))
        } finally {
            setApplying(null)
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".zip"
                onChange={handleFileUpload}
            />

            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 sm:gap-4">
                <div className="w-full sm:w-auto">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-app-accent-bg rounded-xl text-app-accent shadow-sm border border-app-accent shrink-0">
                            <Cpu size={24} />
                        </div>
                        <h2>System Updates</h2>
                    </div>
                    <p className="text-app-muted-foreground mt-2 font-medium text-sm md:text-base">Privileged update channel for the Dajingo Platform Kernel</p>
                </div>
                <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={syncing || loading}
                        className="flex-1 sm:flex-none justify-center bg-app-accent-strong hover:bg-app-accent text-white px-4 md:px-6 py-5 md:py-6 rounded-2xl flex gap-2 font-bold transition-all shadow-lg shadow-indigo-200 text-xs md:text-sm"
                    >
                        <UploadCloud size={18} className="md:w-5 md:h-5" />
                        {syncing ? "Uploading..." : "Upload .kernel.zip"}
                    </Button>
                    <Button
                        onClick={loadData}
                        disabled={syncing || loading}
                        className="flex-1 sm:flex-none justify-center bg-app-surface border border-app-border hover:bg-app-surface text-app-foreground px-4 md:px-6 py-5 md:py-6 rounded-2xl flex gap-2 font-bold transition-all shadow-sm text-xs md:text-sm"
                    >
                        <RefreshCw size={18} className={`${loading ? "animate-spin" : ""} md:w-5 md:h-5`} />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                {/* Current Status Card */}
                <Card className="lg:col-span-1 bg-app-surface border-app-border rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-xl">
                    <CardHeader className="p-6 md:p-8">
                        <CardTitle className="text-lg md:text-xl font-black text-app-foreground flex items-center gap-2">
                            <ShieldCheck className="text-app-success shrink-0" size={20} />
                            Live Kernel Status
                        </CardTitle>
                        <CardDescription className="text-app-muted-foreground">Current running version and integrity</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 md:p-8 pt-0 space-y-4 md:space-y-6">
                        <div className="space-y-3 md:space-y-4">
                            <div className="flex justify-between items-center py-2 md:py-3 border-b border-app-border">
                                <span className="text-[10px] md:text-xs font-black text-app-muted-foreground uppercase tracking-widest">Version</span>
                                <Badge variant="secondary" className="bg-app-accent-bg text-app-accent border-app-accent font-mono font-bold text-[10px] md:text-xs">
                                    v{status?.current_version || "---"}
                                </Badge>
                            </div>
                            <div className="flex justify-between items-center py-2 md:py-3 border-b border-app-border">
                                <span className="text-[10px] md:text-xs font-black text-app-muted-foreground uppercase tracking-widest">Integrity</span>
                                <span className="text-app-success font-bold flex items-center gap-1 text-[10px] md:text-xs">
                                    <CheckCircle2 size={12} className="md:w-3.5 md:h-3.5" />
                                    {status?.integrity || "Verified"}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 md:py-3 border-b border-app-border">
                                <span className="text-[10px] md:text-xs font-black text-app-muted-foreground uppercase tracking-widest">Environment</span>
                                <span className="text-app-muted-foreground font-mono text-[9px] md:text-[10px] truncate max-w-[120px] md:max-w-none">{status?.environment || "---"}</span>
                            </div>
                        </div>

                        <div className="p-4 bg-app-accent-bg rounded-2xl border border-app-accent">
                            <h4 className="text-[9px] md:text-[10px] font-black text-app-accent uppercase tracking-widest mb-1">Architecture Note</h4>
                            <p className="text-[10px] md:text-[11px] text-app-muted-foreground leading-relaxed font-medium">
                                This channel updates core framework logic, security protocols, and shared system services.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Update History & List */}
                <Card className="lg:col-span-2 bg-app-surface border-app-border rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-xl flex flex-col">
                    <CardHeader className="p-6 md:p-8">
                        <CardTitle className="text-lg md:text-xl font-black text-app-foreground flex items-center gap-2">
                            <HistoryIcon className="text-app-accent shrink-0" size={20} />
                            Update Registry
                        </CardTitle>
                        <CardDescription className="text-app-muted-foreground">System-level upgrade history and staged updates</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 md:p-8 pt-0 flex-grow">
                        {loading ? (
                            <div className="py-20 text-center text-app-muted-foreground italic">Scanning update logs...</div>
                        ) : history.length === 0 ? (
                            <div className="py-20 border-2 border-dashed border-app-border rounded-[2rem] flex flex-col items-center justify-center text-app-muted-foreground gap-4">
                                <Info size={32} />
                                <p className="font-medium">No system updates staged or recorded.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {history.map((update) => (
                                    <div
                                        key={update.id}
                                        className={`group relative p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border transition-all duration-300 ${update.is_applied
                                            ? 'bg-app-surface border-app-border grayscale-[0.5] hover:grayscale-0'
                                            : 'bg-app-accent-bg border-app-accent hover:border-app-accent shadow-md'
                                            }`}
                                    >
                                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 md:gap-0">
                                            <div className="space-y-1">
                                                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                                                    <h3>v{update.version}</h3>
                                                    {update.is_applied ? (
                                                        <Badge className="bg-app-success-bg text-app-success border-app-success text-[10px]">Applied</Badge>
                                                    ) : (
                                                        <Badge className="bg-app-warning-bg text-app-warning border-app-warning text-[10px]">Pending Action</Badge>
                                                    )
                                                    }
                                                </div>
                                                <p className="text-xs md:text-sm text-app-muted-foreground font-medium line-clamp-1">{update.changelog || "System stabilization and security patches."}</p>
                                            </div>
                                            {!update.is_applied && (
                                                <Button
                                                    onClick={() => setPendingUpdate({ id: update.id, version: update.version })}
                                                    disabled={!!applying}
                                                    className="w-full sm:w-auto bg-app-accent-strong text-white hover:bg-app-accent rounded-xl px-4 md:px-6 font-black py-3 md:py-4 h-auto shadow-lg shadow-indigo-100 transition-transform active:scale-95 flex gap-2 text-xs md:text-sm"
                                                >
                                                    <Zap size={14} fill="currentColor" className="md:w-4 md:h-4" />
                                                    Apply Update
                                                </Button>
                                            )}
                                        </div>

                                        <div className="mt-4 flex flex-wrap items-center gap-4 md:gap-6 text-[9px] md:text-[10px] uppercase font-black tracking-widest text-app-muted-foreground">
                                            <div className="flex items-center gap-2">
                                                <Clock size={10} className="md:w-3 md:h-3" />
                                                STAGED: {update.created_at ? format(new Date(update.created_at), 'MMM dd, yyyy HH:mm') : '—'}
                                            </div>
                                            {update.is_applied && (
                                                <div className="flex items-center gap-2 text-app-success/70">
                                                    <CheckCircle2 size={10} className="md:w-3 md:h-3" />
                                                    INSTALLED: {update.applied_at ? format(new Date(update.applied_at), 'MMM dd, yyyy HH:mm') : ''}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Warning Section */}
            <div className="p-6 md:p-8 bg-app-error-bg rounded-[2rem] md:rounded-[3rem] border border-app-error flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-center shadow-lg">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-[1.5rem] md:rounded-[2rem] bg-app-error-bg flex items-center justify-center text-app-error shrink-0 shadow-sm border border-app-error">
                    <ShieldAlert size={24} className="md:w-8 md:h-8" />
                </div>
                <div>
                    <h4 className="text-lg md:text-xl font-black text-app-error uppercase tracking-tight">Privileged Action Warning</h4>
                    <p className="text-xs md:text-sm text-app-error/80 font-medium leading-relaxed mt-1">
                        System updates replace the base platform architecture. This process is non-reversible and will affect all organizations globally.
                        Always verify the <strong>integrity signature</strong> of the kernel package before applying.
                    </p>
                </div>
            </div>

            <ConfirmDialog
                open={pendingUpdate !== null}
                onOpenChange={(open) => { if (!open) setPendingUpdate(null) }}
                onConfirm={() => {
                    if (pendingUpdate) handleApply(pendingUpdate.id, pendingUpdate.version)
                    setPendingUpdate(null)
                }}
                title="Confirm System Update"
                description={`Apply update to v${pendingUpdate?.version || ''}? The platform will be updated instantly.`}
                confirmText="Apply Update"
                variant="warning"
            />
        </div>
    )
}
