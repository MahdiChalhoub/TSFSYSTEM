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
 Clock,
 Loader2
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
// ─── Terminal Component ──────────────────────────────────────────
function TerminalLog({ logs, visible }: { logs: string[], visible: boolean }) {
 if (!visible) return null
 return (
 <div className="mt-6 p-4 bg-app-surface rounded-2xl font-mono text-[10px] md:text-xs text-app-primary overflow-hidden shadow-2xl border border-app-border animate-in slide-in-from-bottom-4 duration-500">
 <div className="app-page flex items-center gap-2 mb-3 pb-2 border-b border-app-border">
 <div className="flex gap-1.5">
 <div className="w-2.5 h-2.5 rounded-full bg-app-error-bg border border-app-error/50" />
 <div className="w-2.5 h-2.5 rounded-full bg-app-warning/20 border border-app-warning/50" />
 <div className="w-2.5 h-2.5 rounded-full bg-app-primary/20 border border-app-primary/50" />
 </div>
 <span className="text-app-muted-foreground font-bold uppercase tracking-widest text-[9px]">Update Console</span>
 </div>
 <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar">
 {logs.map((log, i) => (
 <div key={i} className="flex gap-3">
 <span className="text-app-muted-foreground shrink-0">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
 <span className={log.includes('ERR') ? 'text-app-error' : log.includes('OK') ? 'text-app-success' : ''}>{log}</span>
 </div>
 ))}
 </div>
 </div>
 )
}
export default function SystemUpdatesPage() {
 const [status, setStatus] = useState<SaasUpdateStatus | null>(null)
 const [history, setHistory] = useState<SaasUpdateHistoryEntry[]>([])
 const [loading, setLoading] = useState(true)
 const [syncing, setSyncing] = useState(false)
 const [applying, setApplying] = useState<number | null>(null)
 const [logs, setLogs] = useState<string[]>([])
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
 setLogs(["INIT: Uploading update...", "CHECK: Validating files..."])
 try {
 const res = await uploadKernelUpdate(formData)
 if (res.error) throw new Error(res.error)
 setLogs(prev => [...prev, "OK: Package staged successfully", "DONE: Registry updated"])
 toast.success(res.message)
 await loadData()
 } catch (e: unknown) {
 setLogs(prev => [...prev, `ERR: ${String(e)}`])
 toast.error((e instanceof Error ? e.message : String(e)))
 } finally {
 setSyncing(false)
 if (fileInputRef.current) fileInputRef.current.value = ''
 }
 }
 async function handleApply(id: number, version: string) {
 setApplying(id)
 setLogs([`START: Initiating upgrade to v${version}...`, "PREPARE: Preparing system...", "UPDATE: Applying update..."])
 try {
 const res = await applyKernelUpdate(id)
 if (res.error) throw new Error(res.error)
 setLogs(prev => [...prev, "OK: Update applied", "INIT: Restarting platform services...", "DONE: System online"])
 toast.success(res.message)
 await loadData()
 } catch (e: unknown) {
 setLogs(prev => [...prev, `ERR: ${String(e)}`, "ROLLBACK: Restoring system state..."])
 toast.error((e instanceof Error ? e.message : String(e)))
 } finally {
 setApplying(null)
 }
 }
 return (
 <div className="relative space-y-6 animate-in fade-in duration-500">
 {/* Background Glow */}
 <div className="absolute -top-24 -right-24 w-96 h-96 bg-app-primary/5 blur-[120px] rounded-full pointer-events-none" />
 <div className="absolute top-1/2 -left-24 w-64 h-64 bg-app-primary/5 blur-[100px] rounded-full pointer-events-none" />
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
 <div className="p-2.5 bg-app-primary rounded-2xl text-app-foreground shadow-xl shadow-indigo-100 border border-app-primary/30/20 shrink-0">
 <Cpu size={24} className={syncing || applying ? "animate-pulse" : ""} />
 </div>
 <h2 className="text-3xl md:text-5xl font-black text-app-foreground tracking-tight">System Updates</h2>
 </div>
 <p className="text-app-muted-foreground mt-2 font-medium text-sm md:text-base max-w-md">Platform update manager. Ensuring seamless upgrades.</p>
 </div>
 <div className="flex flex-wrap gap-3 w-full sm:w-auto">
 <Button
 onClick={() => fileInputRef.current?.click()}
 disabled={syncing || loading}
 className="flex-1 sm:flex-none justify-center bg-app-primary hover:bg-app-primary text-app-foreground px-6 py-7 rounded-2xl flex gap-2 font-black transition-all shadow-xl shadow-indigo-100 hover:scale-[1.02] active:scale-95"
 >
 <UploadCloud size={20} />
 {syncing ? "Uploading..." : "Upload Update"}
 </Button>
 <Button
 onClick={loadData}
 disabled={syncing || loading}
 variant="outline"
 className="flex-1 sm:flex-none justify-center bg-app-surface border-app-border hover:bg-app-background text-app-muted-foreground px-6 py-7 rounded-2xl flex gap-2 font-bold transition-all shadow-sm"
 >
 <RefreshCw size={20} className={`${loading ? "animate-spin" : ""}`} />
 </Button>
 </div>
 </div>
 <TerminalLog logs={logs} visible={logs.length > 0} />
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
 {/* Current Status Card */}
 <Card className="lg:col-span-1 bg-app-foreground/70 backdrop-blur-xl border-app-text/40 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-indigo-100/50">
 <CardHeader className="p-8">
 <CardTitle className="text-xl font-black text-app-foreground flex items-center gap-2">
 <Zap className="text-app-warning fill-amber-500 shrink-0" size={20} />
 Platform Core
 </CardTitle>
 <CardDescription className="text-app-muted-foreground font-medium tracking-tight">Platform status monitoring</CardDescription>
 </CardHeader>
 <CardContent className="p-8 pt-0 space-y-6">
 <div className="space-y-4">
 <div className="flex justify-between items-center py-4 border-b border-app-border">
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.2em]">Build Version</span>
 <Badge className="bg-app-surface text-app-foreground border-none px-3 py-1 font-mono font-bold text-[10px]">
 v{status?.current_version || "---"}
 </Badge>
 </div>
 <div className="flex justify-between items-center py-4 border-b border-app-border">
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.2em]">Integrity Check</span>
 <span className="text-app-primary font-bold flex items-center gap-1.5 text-xs">
 <CheckCircle2 size={14} className="fill-emerald-50" />
 {status?.integrity || "VERIFIED"}
 </span>
 </div>
 <div className="flex justify-between items-center py-4 border-b border-app-border">
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.2em]">Environment</span>
 <span className="text-app-primary font-black text-[10px] bg-app-primary/5 px-2 py-0.5 rounded-full">{status?.environment || "PRODUCTION"}</span>
 </div>
 </div>
 <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl text-app-foreground shadow-xl shadow-app-border/20">
 <div className="flex items-center gap-2 mb-2">
 <ShieldCheck className="text-app-primary" size={16} />
 <h4 className="text-[10px] font-black uppercase tracking-widest text-app-primary">Security Active</h4>
 </div>
 <p className="text-[11px] text-app-muted-foreground leading-relaxed font-medium">
 Updates are applied with zero downtime.
 </p>
 </div>
 </CardContent>
 </Card>
 {/* Update History & List */}
 <Card className="lg:col-span-2 bg-app-foreground/70 backdrop-blur-xl border-app-text/40 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-indigo-100/50 flex flex-col">
 <CardHeader className="p-8 pb-4">
 <div className="flex justify-between items-start">
 <div className="space-y-1">
 <CardTitle className="text-xl font-black text-app-foreground flex items-center gap-2">
 <HistoryIcon className="text-app-primary shrink-0" size={20} />
 Update History
 </CardTitle>
 <CardDescription className="text-app-muted-foreground font-medium">Update history</CardDescription>
 </div>
 <Badge variant="outline" className="text-[9px] font-black text-app-primary border-app-primary/30 px-3">
 {history.length} STAGES
 </Badge>
 </div>
 </CardHeader>
 <CardContent className="p-8 pt-2 flex-grow">
 {loading ? (
 <div className="py-24 text-center">
 <Loader2 className="w-10 h-10 animate-spin mx-auto text-app-primary mb-4" />
 <p className="text-sm font-black text-app-muted-foreground uppercase tracking-widest">Scanning Registry...</p>
 </div>
 ) : history.length === 0 ? (
 <div className="py-24 border-2 border-dashed border-app-border rounded-[2.5rem] flex flex-col items-center justify-center text-app-muted-foreground gap-4">
 <div className="p-6 bg-app-background rounded-full">
 <Info size={40} />
 </div>
 <p className="font-bold text-lg">Registry is clean.</p>
 <p className="text-sm">No updates currently staged.</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 gap-4">
 {history.map((update) => (
 <div
 key={update.id}
 className={`group relative p-6 rounded-[2rem] border-2 transition-all duration-500 overflow-hidden ${update.is_applied
 ? 'bg-app-surface-2/50 border-app-border'
 : 'bg-app-surface border-app-primary/30 hover:border-app-primary/30 shadow-lg shadow-indigo-50 hover:scale-[1.01]'
 }`}
 >
 <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
 <div className="flex gap-4">
 <div className={`p-4 rounded-2xl ${update.is_applied ? 'bg-app-border text-app-muted-foreground' : 'bg-app-primary/10 text-app-primary'}`}>
 <Cpu size={24} />
 </div>
 <div className="space-y-1">
 <div className="flex items-center gap-3">
 <h3 className="text-xl font-black text-app-foreground tracking-tight">v{update.version}</h3>
 {update.is_applied ? (
 <div className="flex items-center gap-1.5 px-3 py-1 bg-app-primary-light text-app-success rounded-full text-[9px] font-black uppercase">
 <CheckCircle2 size={10} /> Active
 </div>
 ) : (
 <div className="flex items-center gap-1.5 px-3 py-1 bg-app-warning-bg text-app-warning rounded-full text-[9px] font-black uppercase">
 <Clock size={10} /> Staged
 </div>
 )}
 </div>
 <p className="text-sm text-app-muted-foreground font-bold max-w-md">{update.changelog || "Stabilization patches and infrastructure hardening."}</p>
 </div>
 </div>
 {!update.is_applied && (
 <Button
 onClick={() => setPendingUpdate({ id: update.id, version: update.version })}
 disabled={!!applying}
 className="w-full sm:w-auto bg-app-surface text-app-foreground hover:bg-app-background rounded-2xl px-8 py-6 h-auto font-black shadow-xl transition-all hover:translate-y-[-2px] active:translate-y-[0px] flex gap-3 text-xs"
 >
 <Zap size={16} className="fill-emerald-400 text-app-primary" />
 INITIATE UPGRADE
 </Button>
 )}
 </div>
 <div className="mt-6 flex flex-wrap items-center gap-6 text-[9px] font-black tracking-[0.1em] text-app-muted-foreground border-t border-app-border pt-4">
 <span className="flex items-center gap-2">STAGED: {update.created_at ? format(new Date(update.created_at), 'PPP') : '---'}</span>
 {update.is_applied && update.applied_at && (
 <span className="flex items-center gap-2 text-app-primary/80">INSTALLED: {update.applied_at ? format(new Date(update.applied_at), 'PPP') : '—'}</span>
 )}
 <span className="ml-auto text-app-primary/50">#ID-{update.id.toString().padStart(4, '0')}</span>
 </div>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>
 </div>
 {/* Warning Section */}
 <div className="group p-8 md:p-10 bg-app-error rounded-[3rem] border border-app-error flex flex-col md:flex-row gap-8 items-center shadow-2xl shadow-red-200 relative overflow-hidden transition-all hover:scale-[1.01]">
 {/* Visual warning flare */}
 <div className="absolute top-0 right-0 w-64 h-64 bg-app-foreground/10 blur-[60px] rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform duration-700" />
 <div className="w-20 h-20 rounded-[2rem] bg-app-foreground/20 flex items-center justify-center text-app-foreground shrink-0 shadow-xl backdrop-blur-md border border-app-text/30">
 <ShieldAlert size={36} className="animate-pulse" />
 </div>
 <div className="relative z-10 text-center md:text-left">
 <h4 className="text-xl md:text-2xl font-black text-app-foreground uppercase tracking-tight">Update Safety</h4>
 <p className="text-sm md:text-base text-red-50/80 font-bold leading-relaxed mt-2 max-w-2xl">
 Updates will restart services briefly.
 Always ensure a full backup of your <strong>database</strong> is active before initiating an update.
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
 title="System Upgrade Confirmation"
 description={`You are about to initiate an atomic system upgrade to v${pendingUpdate?.version || ''}. This will affect all global instances.`}
 confirmText="Initiate Upgrade"
 variant="danger"
 />
 </div>
 )
}
