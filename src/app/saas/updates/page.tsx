'use client'

import { useEffect, useState, useRef } from "react"
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
    const [status, setStatus] = useState<any>(null)
    const [history, setHistory] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const [applying, setApplying] = useState<number | null>(null)
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
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setSyncing(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    async function handleApply(id: number, version: string) {
        if (!confirm(`Confirm system update to v${version}? The platform will be updated instantly.`)) return;
        setApplying(id)
        try {
            const res = await applyKernelUpdate(id)
            if (res.error) throw new Error(res.error)
            toast.success(res.message)
            await loadData()
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setApplying(null)
        }
    }

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-700 max-w-7xl mx-auto">
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".zip"
                onChange={handleFileUpload}
            />

            {/* Header Section */}
            <div className="flex justify-between items-end">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
                            <Cpu size={24} />
                        </div>
                        <h2 className="text-4xl font-black text-white tracking-tight">System Updates</h2>
                    </div>
                    <p className="text-gray-400 mt-2 font-medium">Privileged update channel for the Dajingo Platform Kernel</p>
                </div>
                <div className="flex gap-4">
                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={syncing || loading}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-6 rounded-2xl flex gap-2 font-bold transition-all shadow-lg shadow-indigo-900/40"
                    >
                        <UploadCloud size={20} />
                        {syncing ? "Uploading..." : "Upload .kernel.zip"}
                    </Button>
                    <Button
                        onClick={loadData}
                        disabled={syncing || loading}
                        className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-6 rounded-2xl flex gap-2 font-bold transition-all shadow-xl"
                    >
                        <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Current Status Card */}
                <Card className="lg:col-span-1 bg-[#0F172A]/80 backdrop-blur-md border-gray-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <CardHeader className="p-8">
                        <CardTitle className="text-xl font-black text-white flex items-center gap-2">
                            <ShieldCheck className="text-emerald-400" />
                            Live Kernel Status
                        </CardTitle>
                        <CardDescription>Current running version and integrity</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 space-y-6">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-3 border-b border-gray-800/50">
                                <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Version</span>
                                <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 font-mono font-bold">
                                    v{status?.current_version || "---"}
                                </Badge>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-gray-800/50">
                                <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Integrity</span>
                                <span className="text-emerald-400 font-bold flex items-center gap-1">
                                    <CheckCircle2 size={14} />
                                    {status?.integrity || "Verified"}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-gray-800/50">
                                <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Environment</span>
                                <span className="text-gray-400 font-mono text-[10px]">{status?.environment || "---"}</span>
                            </div>
                        </div>

                        <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
                            <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Architecture Note</h4>
                            <p className="text-[11px] text-gray-500 leading-relaxed font-medium">
                                This channel updates core framework logic, security protocols, and shared system services.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Update History & List */}
                <Card className="lg:col-span-2 bg-[#0F172A]/80 backdrop-blur-md border-gray-800 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col">
                    <CardHeader className="p-8">
                        <CardTitle className="text-xl font-black text-white flex items-center gap-2">
                            <HistoryIcon className="text-indigo-400" />
                            Update Registry
                        </CardTitle>
                        <CardDescription>System-level upgrade history and staged updates</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 flex-grow">
                        {loading ? (
                            <div className="py-20 text-center text-gray-600 italic">Scanning update logs...</div>
                        ) : history.length === 0 ? (
                            <div className="py-20 border-2 border-dashed border-gray-800 rounded-[2rem] flex flex-col items-center justify-center text-gray-600 gap-4">
                                <Info size={32} />
                                <p className="font-medium">No system updates staged or recorded.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {history.map((update) => (
                                    <div
                                        key={update.id}
                                        className={`group relative p-6 rounded-[2rem] border transition-all duration-300 ${update.is_applied
                                                ? 'bg-black/20 border-gray-800/50 grayscale-[0.5] hover:grayscale-0'
                                                : 'bg-indigo-500/5 border-indigo-500/20 hover:border-indigo-500/40 shadow-xl'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-lg font-black text-white tracking-tight">v{update.version}</h3>
                                                    {update.is_applied ? (
                                                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Applied</Badge>
                                                    ) : (
                                                        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Pending Action</Badge>
                                                    )
                                                    }
                                                </div>
                                                <p className="text-sm text-gray-500 font-medium line-clamp-1">{update.changelog || "System stabilization and security patches."}</p>
                                            </div>
                                            {!update.is_applied && (
                                                <Button
                                                    onClick={() => handleApply(update.id, update.version)}
                                                    disabled={!!applying}
                                                    className="bg-white text-black hover:bg-gray-200 rounded-xl px-6 font-black py-4 h-auto shadow-lg transition-transform active:scale-95 flex gap-2"
                                                >
                                                    <Zap size={16} fill="currentColor" />
                                                    Apply Update
                                                </Button>
                                            )}
                                        </div>

                                        <div className="mt-4 flex items-center gap-6 text-[10px] uppercase font-black tracking-widest text-gray-600">
                                            <div className="flex items-center gap-2">
                                                <Clock size={12} />
                                                STAGED: {format(new Date(update.created_at), 'MMM dd, yyyy HH:mm')}
                                            </div>
                                            {update.is_applied && (
                                                <div className="flex items-center gap-2 text-emerald-500/50">
                                                    <CheckCircle2 size={12} />
                                                    INSTALLED: {format(new Date(update.applied_at), 'MMM dd, yyyy HH:mm')}
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
            <div className="p-8 bg-red-500/5 rounded-[3rem] border border-red-500/10 flex gap-6 items-center shadow-2xl">
                <div className="w-16 h-16 rounded-[2rem] bg-red-500/20 flex items-center justify-center text-red-400 shrink-0 shadow-lg">
                    <ShieldAlert size={32} />
                </div>
                <div>
                    <h4 className="text-xl font-black text-red-400 uppercase tracking-tight">Privileged Action Warning</h4>
                    <p className="text-sm text-red-300/60 font-medium leading-relaxed mt-1">
                        System updates replace the base platform architecture. This process is non-reversible and will affect all organizations globally.
                        Always verify the <strong>integrity signature</strong> of the kernel package before applying.
                    </p>
                </div>
            </div>
        </div>
    )
}
