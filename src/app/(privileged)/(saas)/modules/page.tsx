'use client'

import { useEffect, useState, useRef } from "react"
import { SaasModule, SaasBackup } from "@/types/erp"
import { useRouter } from "next/navigation"
import {
    getSaaSModules,
    syncModulesGlobal,
    installModuleGlobal,
    uninstallModuleGlobal,
    deleteModule,
    uploadModule,
    getModuleBackups,
    rollbackModule
} from "@/app/actions/saas/modules"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Box, RefreshCw, Zap, ShieldCheck, Info, Trash2, XCircle, UploadCloud, History as HistoryIcon, RotateCcw, Network } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

export default function SaaSModulesPage() {
    const router = useRouter()
    const [modules, setModules] = useState<SaasModule[]>([])
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const [processing, setProcessing] = useState<string | null>(null)
    const [lastSynced, setLastSynced] = useState<string>("")
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [pendingUninstall, setPendingUninstall] = useState<string | null>(null)
    const [pendingDelete, setPendingDelete] = useState<string | null>(null)
    const [pendingRollback, setPendingRollback] = useState<{ code: string; version: string } | null>(null)

    useEffect(() => {
        loadModules()
    }, [])

    async function loadModules() {
        setLoading(true)
        try {

            const data = await getSaaSModules()
            setModules(data)
            setLastSynced(new Date().toLocaleTimeString())
            router.refresh() // Force Next.js router cache update
        } catch {
            toast.error("Failed to load modules")
        } finally {
            setLoading(false)
        }
    }

    async function handleInstall() {
        setSyncing(true)
        try {
            const res = await syncModulesGlobal()
            if (res.error) throw new Error(res.error)
            toast.success(res.message)
            await loadModules()
        } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)))
        } finally {
            setSyncing(false)
        }
    }

    async function handleSync() {
        setSyncing(true)
        try {
            const res = await syncModulesGlobal()
            if (res.error) throw new Error(res.error)
            toast.success(res.message)
            await loadModules()
        } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)))
        } finally {
            setSyncing(false)
        }
    }

    async function handleGlobalInstall(code: string) {
        setProcessing(code)
        try {
            const res = await installModuleGlobal(code)
            if (res.error) throw new Error(res.error)
            toast.success(res.message)
            await loadModules()
        } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)))
        } finally {
            setProcessing(null)
        }
    }

    async function handleGlobalUninstall(code: string) {
        setProcessing(code)
        try {
            const res = await uninstallModuleGlobal(code)
            if (res.error) throw new Error(res.error)
            toast.success(res.message)
            await loadModules()
        } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)))
        } finally {
            setProcessing(null)
        }
    }

    async function handleDelete(code: string) {
        setProcessing(code)
        try {
            const res = await deleteModule(code)
            if (res.error) throw new Error(res.error)
            toast.success(res.message)
            await loadModules()
        } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)))
        } finally {
            setProcessing(null)
        }
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return;

        const formData = new FormData()
        formData.append('file', file)

        setSyncing(true)
        try {
            const res = await uploadModule(formData)
            if (res.error) throw new Error(res.error)
            toast.success(res.message)
            await loadModules()
        } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)))
        } finally {
            setSyncing(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    async function handleRollback(code: string, version: string) {
        setProcessing(code)
        try {
            const res = await rollbackModule(code, version)
            if (res.error) throw new Error(res.error)
            toast.success(res.message)
            await loadModules()
        } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)))
        } finally {
            setProcessing(null)
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

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 md:gap-4">
                <div>
                    <h2 className="text-3xl md:text-4xl font-black text-app-foreground tracking-tight">Global Registry</h2>
                    <p className="text-app-muted-foreground mt-1 md:mt-2 font-medium text-sm md:text-base">Coordinate system features across all tenant distributions</p>
                    {lastSynced && <p className="text-app-success/50 text-[10px] font-mono mt-2 uppercase tracking-widest">Last Synced: {lastSynced}</p>}
                </div>
                <div className="flex flex-wrap gap-2 md:gap-4 w-full sm:w-auto">
                    <Button
                        onClick={() => router.push('/modules/dependencies')}
                        className="flex-1 sm:flex-none bg-app-surface hover:bg-app-surface-2 text-app-foreground border border-app-border px-4 md:px-6 py-4 md:py-6 rounded-2xl flex gap-2 font-bold transition-all text-xs md:text-sm"
                    >
                        <Network size={18} />
                        Dependencies
                    </Button>
                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={syncing}
                        className="flex-1 sm:flex-none bg-app-primary-dark hover:bg-app-primary text-white px-4 md:px-6 py-4 md:py-6 rounded-2xl flex gap-2 font-bold transition-all shadow-lg shadow-emerald-200 text-xs md:text-sm"
                    >
                        <UploadCloud size={18} />
                        {syncing ? "..." : "Upload"}
                    </Button>
                    <Button
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex-1 sm:flex-none bg-app-surface border border-app-border hover:bg-app-surface text-app-foreground px-4 md:px-6 py-4 md:py-6 rounded-2xl flex gap-2 font-bold transition-all shadow-sm text-xs md:text-sm"
                    >
                        <RefreshCw size={18} className={syncing ? "animate-spin" : ""} />
                        {syncing ? "..." : "Sync"}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-20 text-center text-app-muted-foreground font-medium italic">Scanning core modules...</div>
                ) : modules.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-app-muted-foreground font-medium font-mono">No modules detected in filesystem.</div>
                ) : modules.map((m) => {
                    const isCore = m.code === 'core' || m.code === 'coreplatform' || m.code === 'packages';
                    const coreDetails = m.code === 'core' ? {
                        description: 'The "Spine" of the system. Handles platform integrity, security protocols, and essential multi-tenant infrastructure.',
                        workflows: [
                            'PostgreSQL Integrity Philosophy',
                            'Global System Bootloader',
                            'Security & Authentication Baseline'
                        ]
                    } : m.code === 'coreplatform' ? {
                        description: 'The central orchestration engine. Manages modular injection and safe request routing between modules.',
                        workflows: [
                            'Modular Request Orchestration',
                            'Connector Engine (Brokerage)',
                            'Fallback & Graceful Degradation'
                        ]
                    } : m.code === 'packages' ? {
                        description: 'The binary distribution hub. Manages atomic delivery of kernel updates and modular artifacts across the infrastructure.',
                        workflows: [
                            'Atomic Distribution Staging',
                            'Cryptographic Integrity Verification',
                            'Automated Lifecycle Orchestration'
                        ]
                    } : null;

                    return (
                        <Card key={m.code} className="bg-app-surface border-app-border hover:border-app-primary/30 transition-all rounded-[2.5rem] overflow-hidden group shadow-xl hover:shadow-2xl flex flex-col">
                            <CardHeader className="pb-4 relative">
                                <div className="flex justify-between items-start">
                                    <div className={`p-4 rounded-2xl shadow-sm border ${m.is_core ? 'bg-app-accent-bg text-app-accent border-app-accent' : 'bg-app-success-bg text-app-success border-app-success'}`}>
                                        <Box size={28} />
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <div className="flex items-center gap-2">
                                            {m.is_core && (
                                                <Badge className="bg-app-accent-bg text-app-accent border-app-accent px-3 py-1 font-black uppercase text-[10px]">
                                                    Core Module
                                                </Badge>
                                            )}
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-app-muted-foreground hover:text-app-accent hover:bg-app-accent-bg">
                                                        <Info size={16} />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-80 bg-app-surface p-6 rounded-3xl shadow-2xl border-app-border animate-in fade-in zoom-in-95 duration-200">
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`p-2 rounded-lg ${m.is_core ? 'bg-app-accent-strong text-white' : 'bg-app-primary-dark text-white'}`}>
                                                                <Info size={14} />
                                                            </div>
                                                            <span className="text-[10px] font-black text-app-foreground uppercase tracking-widest">Module Responsibility</span>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <h4 className="text-sm font-black text-app-foreground">{m.name}</h4>
                                                            <p className="text-[11px] text-app-muted-foreground font-medium leading-relaxed">
                                                                {coreDetails?.description || m.description || "No detailed description available."}
                                                            </p>
                                                        </div>
                                                        {coreDetails?.workflows && (
                                                            <div className="pt-4 border-t border-app-border space-y-2">
                                                                <span className="text-[9px] font-black text-app-muted-foreground uppercase tracking-wider">Key Workflows</span>
                                                                <div className="space-y-1">
                                                                    {coreDetails.workflows.map((wf, idx) => (
                                                                        <div key={idx} className="flex items-center gap-2">
                                                                            <ShieldCheck size={10} className="text-app-success" />
                                                                            <span className="text-[10px] font-bold text-app-muted-foreground">{wf}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="pt-4 border-t border-app-border flex justify-between items-center">
                                                            <span className="text-[9px] font-black text-app-muted-foreground uppercase">Version</span>
                                                            <span className="text-[9px] font-mono font-bold text-app-accent">v{m.version}</span>
                                                        </div>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">{m.version}</div>
                                    </div>
                                </div>
                                <CardTitle className="text-2xl font-black text-app-foreground mt-6 tracking-tight">{m.name}</CardTitle>
                                <CardDescription className="text-app-muted-foreground text-xs font-mono">
                                    ID: {m.code}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 flex-grow flex flex-col justify-between p-8 pt-2">
                                <p className="text-sm text-app-muted-foreground leading-relaxed font-medium">
                                    {m.description || "No description provided for this module."}
                                </p>

                                <div className="space-y-6 pt-6 border-t border-app-border">
                                    <div className="flex justify-between items-center bg-app-surface p-4 rounded-2xl border border-app-border shadow-inner">
                                        <span className="text-[10px] text-app-muted-foreground uppercase font-black tracking-widest leading-none">Global Coverage</span>
                                        <span className="text-app-success font-mono font-bold leading-none">{m.total_installs} Tenants</span>
                                    </div>

                                    {m.dependencies && m.dependencies.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {m.dependencies.map((dep: string) => (
                                                <span key={dep} className="px-3 py-1 bg-app-surface border border-app-border text-[10px] text-app-muted-foreground rounded-xl font-mono shadow-sm">
                                                    +{dep}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                        <Button
                                            onClick={() => handleGlobalInstall(m.code)}
                                            disabled={processing === m.code}
                                            className="bg-app-primary-dark hover:bg-app-primary text-white rounded-2xl py-6 font-black shadow-lg shadow-emerald-200 transition-all active:scale-95 flex gap-2"
                                        >
                                            <Zap size={16} />
                                            Push
                                        </Button>
                                        <Button
                                            onClick={() => setPendingUninstall(m.code)}
                                            disabled={processing === m.code || m.is_core}
                                            variant="outline"
                                            className="border-app-border bg-app-surface hover:bg-app-error-bg hover:text-app-error hover:border-app-error text-app-muted-foreground rounded-2xl py-6 font-black transition-all flex gap-2"
                                        >
                                            <XCircle size={16} />
                                            Revoke
                                        </Button>

                                        {/* Rollback & History Dialog */}
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button
                                                    disabled={processing === m.code}
                                                    variant="outline"
                                                    className="col-span-2 border-gray-800 hover:bg-app-info/10 hover:text-app-info hover:border-app-info/50 text-app-muted-foreground rounded-2xl py-4 font-bold transition-all flex gap-2"
                                                >
                                                    <HistoryIcon size={16} />
                                                    History & Rollback
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="bg-[#0F172A] border-gray-800 text-white sm:max-w-md">
                                                <DialogHeader>
                                                    <DialogTitle>Version History: {m.name}</DialogTitle>
                                                    <DialogDescription>
                                                        Select a previous version to restore. This will replace the source code but <strong>will not revert database schemas</strong>.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <BackupList moduleCode={m.code} onRollback={(v) => setPendingRollback({ code: m.code, version: v })} currentVersion={m.version ?? ''} />
                                            </DialogContent>
                                        </Dialog>

                                        <Button
                                            onClick={() => setPendingDelete(m.code)}
                                            disabled={processing === m.code || m.is_core}
                                            variant="ghost"
                                            className="col-span-2 text-app-muted-foreground hover:text-app-error hover:bg-red-950/20 font-bold rounded-2xl py-4 text-xs flex gap-2"
                                        >
                                            <Trash2 size={14} />
                                            Delete from System
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <div className="p-8 bg-app-primary/5 rounded-[3rem] border border-app-primary/10 flex gap-6 items-center shadow-2xl">
                <div className="w-16 h-16 rounded-[2rem] bg-app-primary/20 flex items-center justify-center text-app-success shrink-0 shadow-lg">
                    <Info size={32} />
                </div>
                <div>
                    <h4 className="text-xl font-black text-app-success uppercase tracking-tight">Infrastructure Policy</h4>
                    <p className="text-sm text-app-success/60 font-medium leading-relaxed mt-1">
                        Deployment actions are non-reversible for data states and will trigger migrations on all linked organization databases.
                        <strong> Push</strong> enables the module for all tenants. <strong> Revoke</strong> disables it globally. <strong> Delete</strong> will fail if data usage is detected.
                    </p>
                </div>
            </div>

            <ConfirmDialog
                open={pendingUninstall !== null}
                onOpenChange={(open) => { if (!open) setPendingUninstall(null) }}
                onConfirm={() => {
                    if (pendingUninstall) handleGlobalUninstall(pendingUninstall)
                    setPendingUninstall(null)
                }}
                title="Revoke Module"
                description={`Are you sure you want to revoke ${pendingUninstall || ''} from ALL organizations?`}
                confirmText="Revoke"
                variant="danger"
            />

            <ConfirmDialog
                open={pendingDelete !== null}
                onOpenChange={(open) => { if (!open) setPendingDelete(null) }}
                onConfirm={() => {
                    if (pendingDelete) handleDelete(pendingDelete)
                    setPendingDelete(null)
                }}
                title="Delete Module"
                description="This is a DESTRUCTIVE action. It will check for active data usage. If any organization has used this module, deletion will be BLOCKED to prevent data loss. Proceed with safety check?"
                confirmText="Delete from System"
                variant="danger"
            />

            <ConfirmDialog
                open={pendingRollback !== null}
                onOpenChange={(open) => { if (!open) setPendingRollback(null) }}
                onConfirm={() => {
                    if (pendingRollback) handleRollback(pendingRollback.code, pendingRollback.version)
                    setPendingRollback(null)
                }}
                title="Rollback Module"
                description={`Confirm rollback of ${pendingRollback?.code || ''} to version ${pendingRollback?.version || ''}? This cannot be undone.`}
                confirmText="Rollback"
                variant="warning"
            />
        </div>
    )


}

function BackupList({ moduleCode, onRollback, currentVersion }: { moduleCode: string, onRollback: (v: string) => void, currentVersion: string }) {
    const [backups, setBackups] = useState<SaasBackup[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getModuleBackups(moduleCode).then((data: any[]) => {
            setBackups(data as SaasBackup[])
            setLoading(false)
        }).catch(() => setLoading(false))
    }, [moduleCode])

    if (loading) return <div className="text-center py-8 text-app-muted-foreground text-sm">Loading history...</div>
    if (backups.length === 0) return <div className="text-center py-8 text-app-muted-foreground text-sm">No backup checkpoints found.</div>

    return (
        <div className="max-h-[300px] mt-2 overflow-y-auto pr-2 custom-scrollbar">
            <div className="space-y-2">
                {backups.map((b, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-app-bg border border-gray-800">
                        <div>
                            <div className="font-bold text-white text-sm">v{b.version}</div>
                            <div className="text-xs text-app-muted-foreground mt-0.5">{b.date}</div>
                        </div>
                        {b.version !== currentVersion && (
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => onRollback(b.version ?? '')}
                                className="h-8 text-xs font-bold"
                            >
                                <RotateCcw size={12} className="mr-2" />
                                Restore
                            </Button>
                        )}
                        {b.version === currentVersion && (
                            <div className="text-xs font-bold text-app-success uppercase tracking-wider px-3">Current</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
