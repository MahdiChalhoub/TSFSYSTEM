"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Upload, DatabaseZap, Server, FileUp, Play, RotateCcw,
    CheckCircle2, XCircle, Loader2, ArrowRight, ArrowLeft,
    Eye, AlertTriangle, RefreshCw, Database, Layers,
    Package, Users, ShoppingCart, Banknote, Tag, Ruler,
    BarChart3, Trash2, Building2, Globe, ChevronRight
} from "lucide-react"
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { initChunkedUpload, completeChunkedUpload, getActiveUploads, getUploadStatus, listFiles } from "@/modules/storage/actions"
import { toast } from "sonner"
import {
    getMigrationJobs,
    getMigrationJobDetail,
    getBusinesses,
    previewMigration,
    startMigration,
    rollbackMigration,
    linkMigrationFile,
    getMigrationPipeline,
    resumeMigration,
    getMigrationReview,
    getMigrationSamples,
    approveMigrationEntity,
    getAccountMapping,
    saveAccountMapping
} from "./actions"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

import { MigrationJob, PreviewData, Business, WizardStep } from "./components/types"
import { MigrationPipeline } from "./components/MigrationPipeline"
import { MigrationReviewDashboard } from "./components/MigrationReviewDashboard"

// --
// TYPES
// --



// --
// STATUS VISUALS
// --

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
    PENDING: { color: "bg-gray-500/20 text-app-text-faint border-gray-500/30", icon: FileUp, label: "Pending" },
    PARSING: { color: "bg-blue-500/20 text-blue-600 border-blue-500/30", icon: Database, label: "Parsing" },
    RUNNING: { color: "bg-amber-500/20 text-amber-600 border-amber-500/30", icon: Loader2, label: "Running" },
    COMPLETED: { color: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30", icon: CheckCircle2, label: "Completed" },
    FAILED: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle, label: "Failed" },
    STALLED: { color: "bg-orange-500/20 text-orange-600 border-orange-500/30", icon: AlertTriangle, label: "Stalled" },
    ROLLED_BACK: { color: "bg-gray-500/20 text-app-text-faint border-gray-500/30", icon: RotateCcw, label: "Rolled Back" },
}

const entityIcons: Record<string, any> = {
    units: Ruler,
    categories: Layers,
    brands: Tag,
    products: Package,
    contacts: Users,
    transactions: ShoppingCart,
    accounts: Banknote,
    business_locations: Building2,
    expenses: Banknote,
    returns: RotateCcw,
}

// --
// THIRD-PARTY SOURCES
// --

const IMPORT_SOURCES = [
    {
        id: "ultimatepos",
        name: "UltimatePOS",
        description: "Import from UltimatePOS (Laravel/MySQL) via SQL dump",
        icon: "🛒",
        available: true,
        color: "from-orange-500/20 to-red-500/20 border-orange-500/30",
    },
    {
        id: "odoo",
        name: "Odoo",
        description: "Import from Odoo ERP (coming soon)",
        icon: "🔮",
        available: false,
        color: "from-purple-500/10 to-indigo-500/10 border-purple-500/20",
    },
    {
        id: "quickbooks",
        name: "QuickBooks",
        description: "Import from QuickBooks (coming soon)",
        icon: "📊",
        available: false,
        color: "from-green-500/10 to-emerald-500/10 border-green-500/20",
    },
    {
        id: "csv",
        name: "CSV / Excel",
        description: "Import from CSV or Excel files (coming soon)",
        icon: "📄",
        available: false,
        color: "from-blue-500/10 to-cyan-500/10 border-blue-200",
    },
]

// --
// PIPELINE TRACKER (Step-by-Step Progress)
// --


// -------------------------------------------------------------------------------
// MAIN PAGE
// -------------------------------------------------------------------------------

export default function MigrationPage() {
    const [step, setStep] = useState<WizardStep>("LIST")
    const [jobs, setJobs] = useState<MigrationJob[]>([])
    const [activeJob, setActiveJob] = useState<MigrationJob | null>(null)
    const [preview, setPreview] = useState<PreviewData | null>(null)
    const [businesses, setBusinesses] = useState<Business[]>([])
    const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null)
    const [syncMode, setSyncMode] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [loadingBusinesses, setLoadingBusinesses] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [dragActive, setDragActive] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const pollRef = useRef<NodeJS.Timeout | null>(null)
    const activeUploadPollRef = useRef<NodeJS.Timeout | null>(null)
    const [rollbackTarget, setRollbackTarget] = useState<MigrationJob | null>(null)
    const [uploadMode, setUploadMode] = useState<'LOCAL' | 'CLOUD'>('LOCAL')
    const [cloudFiles, setCloudFiles] = useState<any[]>([])
    const [loadingCloud, setLoadingCloud] = useState(false)
    const [searchCloud, setSearchCloud] = useState("")
    const [isStalled, setIsStalled] = useState(false)

    // -- Fetch Jobs 
    const fetchJobs = useCallback(async () => {
        try {
            const data = await getMigrationJobs()
            setJobs(data?.results ?? (Array.isArray(data) ? data : []))
        } catch { }
    }, [])

    useEffect(() => {
        fetchJobs()
    }, [fetchJobs])

    // -- Polling for Analyze Status
    useEffect(() => {
        let timer: NodeJS.Timeout
        if (step === "PREVIEW" && activeJob && preview?.status === "analyzing") {
            timer = setInterval(async () => {
                try {
                    const data = await previewMigration(activeJob.id, selectedBusiness?.id)
                    setPreview(data)
                } catch {
                    // silent ignore
                }
            }, 3000)
        }
        return () => clearInterval(timer)
    }, [step, activeJob, preview?.status, selectedBusiness])

    // -- Polling for Active Uploads (Resumption) 
    useEffect(() => {
        const checkActiveUpload = async () => {
            try {
                const res = await getActiveUploads('file');
                const uploads = res?.uploads || [];
                const activeMigUpload = uploads.find((u: any) => u.category === 'MIGRATION');

                if (activeMigUpload && activeMigUpload.progress < 100) {
                    setUploading(true);
                    setUploadProgress(activeMigUpload.progress);

                    // Start polling status until complete
                    activeUploadPollRef.current = setInterval(async () => {
                        try {
                            const status = await getUploadStatus(activeMigUpload.session_id);
                            if (status && status.progress !== undefined) {
                                setUploadProgress(status.progress);
                                if (status.progress >= 100 || status.status === 'complete' || status.status === 'failed') {
                                    if (activeUploadPollRef.current) clearInterval(activeUploadPollRef.current);
                                    if (status.status === 'complete') {
                                        setUploading(false);
                                        fetchJobs();
                                    } else if (status.status === 'failed') {
                                        setUploading(false);
                                        setError("Background upload failed");
                                    }
                                }
                            }
                        } catch { }
                    }, 1000);
                }
            } catch { }
        };
        checkActiveUpload();

        return () => { if (activeUploadPollRef.current) clearInterval(activeUploadPollRef.current); }
    }, [fetchJobs]);

    // -- Polling for Running Jobs 
    useEffect(() => {
        if (activeJob && (activeJob.status === "PARSING" || activeJob.status === "RUNNING")) {
            pollRef.current = setInterval(async () => {
                try {
                    const data = await getMigrationJobDetail(activeJob.id)
                    setActiveJob(data)

                    // Ghost Detection: If no heartbeat for > 45 seconds while in Running state
                    if (data.status === "RUNNING" || data.status === "PARSING") {
                        const lastBeat = data.last_heartbeat ? new Date(data.last_heartbeat).getTime() : 0;
                        const now = new Date().getTime();
                        if (lastBeat > 0 && (now - lastBeat) > 45000) {
                            setIsStalled(true);
                        } else {
                            setIsStalled(false);
                        }
                    }

                    if (data.status === "COMPLETED" || data.status === "FAILED") {
                        setStep("RESULTS")
                        setIsStalled(false)
                        if (pollRef.current) clearInterval(pollRef.current)
                    }
                } catch { }
            }, 3000)

            return () => { if (pollRef.current) clearInterval(pollRef.current) }
        } else {
            setIsStalled(false)
        }
    }, [activeJob?.id, activeJob?.status])

    // -- Upload Handler 
    const handleUpload = async (file: File) => {
        if (!file.name.endsWith(".sql")) {
            setError("Only .sql files are accepted")
            return
        }

        setUploading(true)
        setUploadProgress(0)
        setError(null)
        try {
            // 1. Chunked Upload Initialization
            const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

            const session = await initChunkedUpload({
                filename: file.name,
                total_size: file.size,
                content_type: file.type || 'application/octet-stream',
                category: 'MIGRATION',
                upload_type: 'file',
            });

            if (!session?.session_id) {
                throw new Error(session?.error || 'Failed to initialize upload');
            }

            // 2. Upload Chunks
            let bytesSent = 0;
            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const blob = file.slice(start, end);

                const formData = new FormData();
                formData.append('chunk', blob, `chunk_${i}`);
                formData.append('offset', String(bytesSent));

                console.log(`[UPLOAD] Sending chunk ${i + 1}/${totalChunks} (Offset: ${bytesSent})`);

                const res = await fetch(`/api/proxy/storage/upload/${session.session_id}/chunk/`, {
                    method: 'POST',
                    body: formData,
                    // Note: Browser will automatically add cookies if same-origin
                });

                if (!res.ok) {
                    let errorDetail = "";
                    try {
                        const err = await res.json();
                        errorDetail = err.error || err.detail || JSON.stringify(err);
                    } catch {
                        errorDetail = `Status: ${res.status} ${res.statusText}`;
                    }
                    console.error(`[UPLOAD] Chunk ${i + 1} failed:`, errorDetail);
                    throw new Error(errorDetail || `Chunk ${i + 1} failed`);
                }

                bytesSent = end;
                setUploadProgress(Math.round((bytesSent / file.size) * 100));
            }

            // 3. Complete Chunked Upload
            const uploadResult = await completeChunkedUpload(session.session_id);
            setUploadProgress(100);

            if (!uploadResult?.uuid) {
                throw new Error("Failed to complete upload");
            }

            // 4. Link StoredFile to Migration Job
            const job = await linkMigrationFile({
                file_uuid: uploadResult.uuid,
                name: `UltimatePOS Import - ${new Date().toLocaleDateString()}`
            })

            setActiveJob(job)
            fetchJobs()

            // Auto-discover businesses
            setLoadingBusinesses(true)

            // Poll for discovery results
            let discovered = false;
            let retryCount = 0;
            const maxRetries = 20; // 40 seconds max

            while (!discovered && retryCount < maxRetries) {
                try {
                    const bizData = await getBusinesses(job.id)

                    if (bizData?.status === 'analyzing') {
                        // Still analyzing, wait 2s
                        await new Promise(r => setTimeout(r, 2000));
                        retryCount++;
                        continue;
                    }

                    const bizList = bizData?.businesses ?? []
                    setBusinesses(bizList)
                    discovered = true;

                    if (bizList.length > 1) {
                        setStep("BUSINESSES")
                    } else if (bizList.length === 1) {
                        // Only one business — auto-select it
                        setSelectedBusiness(bizList[0])
                        const previewData = await previewMigration(job.id, bizList[0].id)
                        setPreview(previewData)
                        setStep("PREVIEW")
                    } else {
                        // No business table? Go straight to preview
                        const previewData = await previewMigration(job.id)
                        setPreview(previewData)
                        setStep("PREVIEW")
                    }
                } catch (err) {
                    console.error("Business discovery error:", err);
                    setStep("PREVIEW");
                    discovered = true;
                }
            }

            if (!discovered) {
                setStep("PREVIEW");
            }

        } catch (e: unknown) {
            setError((e instanceof Error ? e.message : String(e)) || "Upload failed")
        } finally {
            setUploading(false)
            setLoadingBusinesses(false)
        }
    }

    // -- Cloud Storage Selection 
    const fetchCloudFiles = useCallback(async () => {
        setLoadingCloud(true)
        try {
            // Fetch ALL files from cloud storage and filter for .sql locally
            // This ensures we show files from any category (ATTACHMENT, MIGRATION, etc.)
            const res = await listFiles({})
            const allFiles = res?.results || (Array.isArray(res) ? res : [])
            setCloudFiles(allFiles.filter((f: any) =>
                (f.original_filename || f.filename || '').toLowerCase().endsWith('.sql')
            ))
        } catch { }
        setLoadingCloud(false)
    }, [])

    const handleSelectCloudFile = async (file: any) => {
        setUploading(true)
        setError(null)
        try {
            const job = await linkMigrationFile({
                file_uuid: file.uuid,
                name: `UltimatePOS Import (Cloud) - ${file.original_filename || file.filename || 'Source'}`
            })

            setActiveJob(job)
            fetchJobs()

            setLoadingBusinesses(true)

            // Poll for discovery results
            let discovered = false;
            let retryCount = 0;
            const maxRetries = 20;

            while (!discovered && retryCount < maxRetries) {
                try {
                    const bizData = await getBusinesses(job.id)

                    if (bizData?.status === 'analyzing') {
                        await new Promise(r => setTimeout(r, 2000));
                        retryCount++;
                        continue;
                    }

                    const bizList = bizData?.businesses ?? []
                    setBusinesses(bizList)
                    discovered = true;

                    if (bizList.length > 1) {
                        setStep("BUSINESSES")
                    } else if (bizList.length === 1) {
                        setSelectedBusiness(bizList[0])
                        const previewData = await previewMigration(job.id, bizList[0].id)
                        setPreview(previewData)
                        setStep("PREVIEW")
                    } else {
                        const previewData = await previewMigration(job.id)
                        setPreview(previewData)
                        setStep("PREVIEW")
                    }
                } catch (err) {
                    setStep("PREVIEW")
                    discovered = true;
                }
            }

            if (!discovered) setStep("PREVIEW");

        } catch (e: unknown) {
            setError((e instanceof Error ? e.message : String(e)) || "Linking file failed")
        } finally {
            setUploading(false)
            setLoadingBusinesses(false)
        }
    }

    // -- Select Business 
    const handleSelectBusiness = async (biz: Business) => {
        setSelectedBusiness(biz)
        setError(null)
        if (!activeJob) return
        try {
            const previewData = await previewMigration(activeJob.id, biz.id)
            setPreview(previewData)
            setStep("PREVIEW")
        } catch (e: unknown) {
            setError((e instanceof Error ? e.message : String(e)) || "Preview failed")
        }
    }

    // -- Preview Handler 
    const handlePreview = async (job: MigrationJob) => {
        setActiveJob(job)
        setError(null)
        try {
            // Fetch businesses first
            setLoadingBusinesses(true)

            let discovered = false;
            let retryCount = 0;
            const maxRetries = 20;

            while (!discovered && retryCount < maxRetries) {
                try {
                    const bizData = await getBusinesses(job.id)

                    if (bizData?.status === 'analyzing') {
                        await new Promise(r => setTimeout(r, 2000));
                        retryCount++;
                        continue;
                    }

                    const bizList = bizData?.businesses ?? []
                    setBusinesses(bizList)
                    discovered = true;

                    if (bizList.length > 1) {
                        setStep("BUSINESSES")
                    } else {
                        if (bizList.length === 1) setSelectedBusiness(bizList[0])
                        const bizId = bizList[0]?.id
                        const data = await previewMigration(job.id, bizId)
                        setPreview(data)
                        setStep("PREVIEW")
                    }
                } catch (err) {
                    setStep("PREVIEW")
                    discovered = true;
                }
            }

            if (!discovered) setStep("PREVIEW");
        } catch (e: unknown) {
            setError((e instanceof Error ? e.message : String(e)) || "Preview failed")
        } finally {
            setLoadingBusinesses(false)
        }
    }

    // -- Start Migration 
    const handleStart = async () => {
        if (!activeJob) return
        setError(null)
        try {
            const params: Record<string, any> = {
                migration_mode: syncMode ? "SYNC" : "FULL",
            }
            if (selectedBusiness) {
                params.source_business_id = selectedBusiness.id
                params.source_business_name = selectedBusiness.name
            }
            const data = await startMigration(activeJob.id, params)
            setActiveJob(data)
            setStep("RUNNING")
        } catch (e: unknown) {
            setError((e instanceof Error ? e.message : String(e)) || "Failed to start migration")
        }
    }

    // -- Rollback 
    const handleRollback = async (job: MigrationJob) => {
        setRollbackTarget(job)
    }

    const confirmRollback = async () => {
        if (!rollbackTarget) return
        try {
            await rollbackMigration(rollbackTarget.id)
            fetchJobs()
            setActiveJob(null)
            setStep("LIST")
        } catch (e: unknown) {
            setError((e instanceof Error ? e.message : String(e)) || "Rollback failed")
        }
        setRollbackTarget(null)
    }

    // -- View Results 
    const viewResults = async (job: MigrationJob) => {
        try {
            const data = await getMigrationJobDetail(job.id)
            setActiveJob(data)
            setStep("RESULTS")
        } catch { }
    }

    // -- Drag & Drop 
    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === "dragenter" || e.type === "dragover") setDragActive(true)
        else if (e.type === "dragleave") setDragActive(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        if (e.dataTransfer.files?.[0]) handleUpload(e.dataTransfer.files[0])
    }

    // -- Reset to list 
    const goBack = () => {
        setStep("LIST")
        setActiveJob(null)
        setError(null)
        setPreview(null)
        setBusinesses([])
        setSelectedBusiness(null)
        setSyncMode(false)
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════

    return (
        <div className="p-6 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500 min-h-screen bg-app-bg">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-4">
                    {step !== "LIST" ? (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={goBack}
                            className="w-14 h-14 rounded-[1.5rem] bg-app-surface border border-app-border text-app-text-faint hover:text-emerald-600 hover:border-emerald-100 transition-all shadow-sm shrink-0"
                        >
                            <ArrowLeft size={28} />
                        </Button>
                    ) : (
                        <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200 shrink-0">
                            <Globe size={28} className="text-white" />
                        </div>
                    )}
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter text-app-text flex items-center gap-4">
                            Data <span className="text-emerald-600">Import</span>
                        </h1>
                        <p className="text-sm font-medium text-app-text-faint mt-2 uppercase tracking-widest">Migrate data from external systems into TSF</p>
                    </div>
                </div>
                {step === "LIST" && (
                    <div className="flex items-center gap-3">
                        <Button
                            onClick={() => setStep("SOURCE")}
                            className="bg-emerald-600 text-white h-12 px-6 rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center gap-2 border-0"
                        >
                            <Upload size={18} />
                            <span>New Import</span>
                        </Button>
                    </div>
                )}
            </header>

            {/* Error Banner */}
            {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex items-center gap-3 shadow-sm">
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                    <span className="text-red-800 font-medium">{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
                </div>
            )}

            {/*  STEP: JOB LIST  */}
            {step === "LIST" && (
                <div className="space-y-6">
                    {/* KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-app-surface p-5 rounded-2xl border border-app-border shadow-sm flex items-center gap-4 group hover:border-emerald-200 transition-colors">
                            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                                <Database className="w-6 h-6 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-app-text-faint uppercase tracking-wider">Total Migrated</p>
                                <p className="text-2xl font-black text-app-text-muted mt-0.5">
                                    {(jobs.reduce((sum, j) => sum + (j.total_products || 0) + (j.total_transactions || 0) + (j.total_contacts || 0), 0) || 0).toLocaleString()}
                                </p>
                            </div>
                        </div>
                        <div className="bg-app-surface p-5 rounded-2xl border border-app-border shadow-sm flex items-center gap-4 group hover:border-emerald-200 transition-colors">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                <Loader2 className={`w-6 h-6 text-blue-600 ${jobs.some(j => j.status === 'RUNNING') ? 'animate-spin' : ''}`} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-app-text-faint uppercase tracking-wider">Active Tasks</p>
                                <p className="text-2xl font-black text-blue-600 mt-0.5">
                                    {jobs.filter(j => ['RUNNING', 'PARSING', 'PENDING'].includes(j.status)).length}
                                </p>
                            </div>
                        </div>
                        <div className="bg-app-surface p-5 rounded-2xl border border-app-border shadow-sm flex items-center gap-4 group hover:border-emerald-200 transition-colors">
                            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-app-text-faint uppercase tracking-wider">Completed</p>
                                <p className="text-2xl font-black text-emerald-600 mt-0.5">
                                    {jobs.filter(j => j.status === 'COMPLETED').length}
                                </p>
                            </div>
                        </div>
                        <div className="bg-app-surface p-5 rounded-2xl border border-app-border shadow-sm flex items-center gap-4 group hover:border-emerald-200 transition-colors">
                            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                                <AlertTriangle className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-app-text-faint uppercase tracking-wider">Exceptions</p>
                                <p className="text-2xl font-black text-red-600 mt-0.5">
                                    {(jobs.reduce((sum, j) => sum + (j.total_errors || 0), 0) || 0).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {jobs.length === 0 ? (
                            <Card className="bg-app-surface border-app-border shadow-sm border-dashed">
                                <CardContent className="flex flex-col items-center justify-center py-16">
                                    <Globe className="w-16 h-16 text-slate-200 mb-4" />
                                    <p className="text-app-text-faint text-lg font-bold tracking-tight">No imports yet</p>
                                    <p className="text-slate-400/60 text-sm mt-1">Import data from an external POS or ERP system</p>
                                    <Button
                                        onClick={() => setStep("SOURCE")}
                                        className="mt-6 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                                    >
                                        <Upload className="w-4 h-4 mr-2" /> Start Import
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            jobs.map((job) => {
                                const config = statusConfig[job.status] || statusConfig.PENDING
                                const StatusIcon = config.icon
                                const isCompleted = job.status === "COMPLETED" || job.status === "FAILED" || job.status === "STALLED"
                                return (
                                    <Card key={job.id}
                                        className={`bg-app-surface border-app-border shadow-sm transition-all ${isCompleted ? 'hover:border-emerald-500/50 cursor-pointer hover:shadow-md' : 'hover:bg-slate-50/50'
                                            }`}
                                        onClick={isCompleted ? () => viewResults(job) : undefined}
                                    >
                                        <CardContent className="py-5">
                                            <div className="flex items-center gap-6">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${config.color} border shrink-0`}>
                                                    <StatusIcon className={`w-5 h-5 ${job.status === "RUNNING" ? "animate-spin" : ""}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-app-text font-black text-xl tracking-tight truncate">{job.name}</h3>
                                                    <div className="flex items-center gap-3 mt-1 text-[10px] text-app-text-faint font-bold uppercase tracking-widest">
                                                        <span className="bg-app-surface-2 px-2 py-0.5 rounded text-app-text-faint">{config.label}</span>
                                                        <span>•</span>
                                                        <span>{new Date(job.created_at).toLocaleDateString()}</span>
                                                        {job.source_business_name && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="text-orange-600 flex items-center gap-1">
                                                                    <Building2 className="w-3 h-3" />
                                                                    {job.source_business_name}
                                                                </span>
                                                            </>
                                                        )}
                                                        {job.migration_mode === "SYNC" && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="text-cyan-600 flex items-center gap-1">
                                                                    <RefreshCw className="w-3 h-3" />
                                                                    Sync
                                                                </span>
                                                            </>
                                                        )}
                                                        {job.current_step && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="text-blue-600">{job.current_step}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                    {(job.status === "RUNNING" || job.status === "PARSING") && (
                                                        <div className="mt-2 w-full bg-app-surface-2 rounded-full h-2 overflow-hidden">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                                                                style={{ width: `${job.progress}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Inline stats for completed jobs */}
                                                {isCompleted && (
                                                    <div className="hidden sm:flex items-center gap-3 shrink-0">
                                                        {[
                                                            { icon: Package, label: "Products", value: job.total_products, color: "text-purple-600" },
                                                            { icon: Users, label: "Contacts", value: job.total_contacts, color: "text-pink-600" },
                                                            { icon: ShoppingCart, label: "Transactions", value: job.total_transactions, color: "text-amber-600" },
                                                            { icon: XCircle, label: "Errors", value: job.total_errors, color: job.total_errors > 0 ? "text-red-500" : "text-gray-200" },
                                                        ].filter(s => s.value > 0).map(({ icon: SIcon, label, value, color }) => (
                                                            <div key={label} className="text-center px-2">
                                                                <SIcon className={`w-3.5 h-3.5 ${color} mx-auto mb-0.5`} />
                                                                <p className={`text-xs font-bold ${color}`}>{(value || 0).toLocaleString()}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="flex gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                                    {job.status === "PENDING" && (
                                                        <Button size="sm" variant="ghost" onClick={() => handlePreview(job)}
                                                            className="text-blue-600 hover:bg-blue-50" title="Preview">
                                                            <Eye className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                    {(job.status === "RUNNING" || job.status === "PARSING") && (
                                                        <Button size="sm" variant="ghost" onClick={() => viewResults(job)}
                                                            className="text-amber-600 hover:bg-amber-50" title="View Progress">
                                                            <BarChart3 className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                    {isCompleted && (
                                                        <Button size="sm" onClick={() => viewResults(job)}
                                                            className="bg-purple-600/80 hover:bg-purple-500 text-white text-xs font-bold gap-1.5 shadow-sm shadow-purple-600/20">
                                                            <Eye className="w-3.5 h-3.5" /> Review
                                                        </Button>
                                                    )}
                                                    {["COMPLETED", "FAILED", "STALLED", "PARSING", "RUNNING"].includes(job.status) && (
                                                        <Button size="sm" variant="ghost" onClick={() => handleRollback(job)}
                                                            className="text-red-500 hover:bg-red-50 hover:text-red-700" title="Rollback / Delete">
                                                            <RotateCcw className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })
                        )}
                    </div>
                </div>
            )}

            {/*  STEP: SOURCE SELECTION  */}
            {step === "SOURCE" && (
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-black text-app-text mb-2 tracking-tight">Choose Import Source</h2>
                        <p className="text-app-text-faint font-medium">Select the external system you're migrating from</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {IMPORT_SOURCES.map((source) => (
                            <button
                                key={source.id}
                                disabled={!source.available}
                                onClick={() => source.available && setStep("UPLOAD")}
                                className={`text-left p-8 rounded-3xl border transition-all shadow-sm
                                    bg-app-surface hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5 hover:-translate-y-1
                                    ${source.available
                                        ? "cursor-pointer"
                                        : "opacity-40 cursor-not-allowed bg-app-bg"
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-inner ${source.id === 'ultimatepos' ? 'bg-orange-50' : 'bg-app-bg'}`}>
                                            {source.icon}
                                        </div>
                                        <h3 className="text-app-text font-black text-xl mt-5">{source.name}</h3>
                                        <p className="text-app-text-faint text-sm mt-1 font-medium">{source.description}</p>
                                    </div>
                                    {source.available && (
                                        <ChevronRight className="w-5 h-5 text-slate-300 mt-1" />
                                    )}
                                </div>
                                {!source.available && (
                                    <span className="inline-block mt-4 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-app-surface-2 text-app-text-faint">
                                        Coming Soon
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/*  STEP: UPLOAD  */}
            {step === "UPLOAD" && (
                <Card className="bg-app-surface border-app-border shadow-xl max-w-2xl mx-auto overflow-hidden rounded-3xl">
                    <CardHeader className="text-center pb-2 bg-app-bg border-b border-app-border">
                        <div className="flex items-center justify-center gap-3 mb-2">
                            <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center shadow-inner">
                                <span className="text-3xl">🛒</span>
                            </div>
                            <div className="text-left">
                                <CardTitle className="text-2xl font-black tracking-tight text-app-text">UltimatePOS Import</CardTitle>
                                <CardDescription className="text-app-text-faint font-medium">Provide the database file to begin the migration</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-8">
                        {uploadMode === 'LOCAL' ? (
                            <div className="space-y-6">
                                <div
                                    className={`border-2 border-dashed rounded-3xl p-16 text-center transition-all cursor-pointer relative group
                                        ${dragActive
                                            ? "border-emerald-500 bg-emerald-50 scale-[1.01]"
                                            : "border-app-border hover:border-emerald-400 bg-gray-50/50 hover:bg-app-surface"
                                        }`}
                                    onDragEnter={handleDrag}
                                    onDragOver={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDrop={handleDrop}
                                    onClick={() => !uploading && fileInputRef.current?.click()}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".sql"
                                        className="hidden"
                                        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                                    />
                                    {uploading ? (
                                        <div className="flex flex-col items-center w-full max-w-sm mx-auto py-4">
                                            <div className="w-20 h-20 mb-6 relative">
                                                <div className={`absolute inset-0 rounded-full border-4 ${loadingBusinesses ? 'border-orange-500/20 border-t-orange-600' : 'border-app-border border-t-emerald-500'} animate-spin`} />
                                                <div className="absolute inset-0 flex items-center justify-center text-xl font-black text-app-text">
                                                    {loadingBusinesses ? <Building2 className="w-8 h-8 text-orange-600 animate-pulse" /> : `${uploadProgress}%`}
                                                </div>
                                            </div>
                                            <h3 className="text-app-text font-bold mb-1">
                                                {loadingBusinesses ? "Discovering Businesses..." : "Uploading Database..."}
                                            </h3>
                                            <p className="text-app-text-faint text-xs font-medium">
                                                {loadingBusinesses ? "Scanning source for isolated data logs" : "Please do not close this tab"}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center">
                                            <div className="w-20 h-20 rounded-2xl bg-app-surface border border-app-border shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                                <Upload className="w-10 h-10 text-emerald-600" />
                                            </div>
                                            <p className="text-app-text text-xl font-black mb-2 tracking-tight">
                                                Select SQL file from your computer
                                            </p>
                                            <p className="text-app-text-faint text-sm max-w-xs mx-auto mb-6 font-medium">
                                                Drag and drop your file here, or click to browse.
                                                We support large database backups.
                                            </p>
                                            <Button className="bg-app-surface hover:bg-app-bg text-app-text-muted border border-app-border rounded-xl px-10 shadow-sm font-bold">
                                                Browse Laptop
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-4 py-2">
                                    <div className="flex-1 h-px bg-app-surface-2" />
                                    <span className="text-[10px] uppercase tracking-widest font-black text-slate-300 mt-1">OR USE CLOUD SERVER</span>
                                    <div className="flex-1 h-px bg-app-surface-2" />
                                </div>

                                <button
                                    onClick={() => {
                                        setUploadMode('CLOUD')
                                        fetchCloudFiles()
                                    }}
                                    className="w-full group p-6 rounded-3xl bg-app-bg border border-app-border hover:border-emerald-500/50 hover:bg-app-surface transition-all flex items-center justify-between shadow-sm hover:shadow-md"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-app-surface border border-app-border flex items-center justify-center shrink-0 shadow-sm">
                                            <DatabaseZap className="w-8 h-8 text-emerald-600" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-app-text font-black text-lg tracking-tight">Pick from TSF Cloud Storage</p>
                                            <p className="text-app-text-faint text-xs font-medium">Access files already uploaded to your cloud server</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-all group-hover:translate-x-1" />
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-app-text font-bold flex items-center gap-2">
                                        <DatabaseZap className="w-5 h-5 text-emerald-600" /> Cloud Migration Files
                                    </h3>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setUploadMode('LOCAL')}
                                        className="text-[10px] text-app-text-faint hover:text-emerald-700 uppercase tracking-widest font-black"
                                    >
                                        <ArrowLeft className="w-3 h-3 mr-1" /> Switch to Local
                                    </Button>
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search cloud files..."
                                        value={searchCloud}
                                        onChange={(e) => setSearchCloud(e.target.value)}
                                        className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-2.5 text-sm text-app-text placeholder:text-app-text-faint focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-300"
                                    />
                                </div>

                                <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
                                    {loadingCloud ? (
                                        <div className="flex flex-col items-center py-10 opacity-40">
                                            <Loader2 className="w-8 h-8 animate-spin mb-2 text-app-text-faint" />
                                            <p className="text-sm font-medium text-app-text-faint">Scanning Cloud Storage...</p>
                                        </div>
                                    ) : cloudFiles.length === 0 ? (
                                        <div className="text-center py-10 border border-dashed border-app-border rounded-2xl bg-app-bg">
                                            <DatabaseZap className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                            <p className="text-app-text-faint text-sm font-medium">No .sql files found in your cloud storage</p>
                                            <Button
                                                variant="link"
                                                onClick={() => setUploadMode('LOCAL')}
                                                className="text-emerald-600 mt-2 text-xs font-bold"
                                            >
                                                Upload one from your computer instead
                                            </Button>
                                        </div>
                                    ) : (
                                        cloudFiles.filter(f => (f.original_filename || f.filename || '').toLowerCase().includes(searchCloud.toLowerCase())).map((file) => (
                                            <button
                                                key={file.uuid}
                                                onClick={() => handleSelectCloudFile(file)}
                                                className="w-full text-left p-4 rounded-xl bg-app-surface border border-app-border hover:bg-app-bg hover:border-emerald-500/30 transition-all flex items-center gap-3 active:scale-[0.98] shadow-sm"
                                            >
                                                <div className="w-10 h-10 rounded-lg bg-app-bg border border-app-border flex items-center justify-center shrink-0">
                                                    <DatabaseZap className="w-5 h-5 text-emerald-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-app-text truncate">{file.original_filename || file.filename}</p>
                                                    <p className="text-[10px] text-app-text-faint flex items-center gap-2 font-medium">
                                                        <span className="text-emerald-700 font-bold uppercase tracking-wider">{file.category}</span>
                                                        <span>•</span>
                                                        <span>{Math.round(file.file_size / 1024 / 1024 * 100) / 100} MB</span>
                                                        <span>•</span>
                                                        <span>{new Date(file.uploaded_at || file.created_at).toLocaleDateString()}</span>
                                                    </p>
                                                </div>
                                                <div className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <CheckCircle2 className="w-5 h-5" />
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="mt-6 p-5 rounded-2xl bg-emerald-50 border border-emerald-100">
                            <h4 className="text-emerald-800 font-bold text-sm flex items-center gap-2">
                                <Server className="w-4 h-4" /> How to export from UltimatePOS
                            </h4>
                            <ol className="text-emerald-700/70 text-[13px] mt-2 space-y-1.5 list-decimal list-inside font-medium">
                                <li>Open <strong className="text-emerald-800">phpMyAdmin</strong></li>
                                <li>Select your UltimatePOS database</li>
                                <li>Click <strong className="text-emerald-800">Export</strong> → Quick → SQL format</li>
                                <li>Upload it here or to <strong className="text-emerald-800">Cloud Storage</strong> first</li>
                            </ol>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/*  STEP: BUSINESS SELECTOR  */}
            {step === "BUSINESSES" && (
                <div className="max-w-3xl mx-auto space-y-8">
                    <div className="text-center mb-4">
                        <h2 className="text-3xl font-black text-app-text mb-2 flex items-center justify-center gap-3 tracking-tight">
                            <Building2 className="w-8 h-8 text-orange-600" />
                            Select Business to Import
                        </h2>
                        <p className="text-app-text-faint font-medium max-w-lg mx-auto">
                            Your SQL dump contains <strong className="text-app-text font-black">{businesses.length} businesses</strong>.
                            Choose which one to migrate into this TSF organization.
                        </p>
                    </div>

                    {loadingBusinesses ? (
                        <div className="flex flex-col items-center justify-center py-24 bg-app-surface border border-app-border rounded-3xl shadow-sm border-dashed">
                            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
                            <span className="text-app-text-faint font-bold uppercase tracking-widest text-xs">Discovering businesses...</span>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {businesses.map((biz) => (
                                <button
                                    key={biz.id}
                                    onClick={() => handleSelectBusiness(biz)}
                                    className="w-full text-left p-6 rounded-3xl bg-app-surface border border-app-border
                                        hover:border-orange-500/50 hover:shadow-xl hover:shadow-orange-500/5 hover:-translate-y-0.5 transition-all group shadow-sm"
                                >
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0 shadow-inner">
                                            <Building2 className="w-6 h-6 text-orange-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-app-text font-black text-xl tracking-tight truncate">
                                                {biz.name || `Business #${biz.id}`}
                                            </h3>
                                            <div className="flex items-center gap-4 mt-1.5 text-[11px] text-app-text-faint font-bold uppercase tracking-widest">
                                                <span className="bg-app-surface-2 px-2 py-0.5 rounded text-app-text-faint">ID: {biz.id}</span>
                                                {biz.products !== undefined && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1.5 text-app-text-faint">
                                                            <Package className="w-3.5 h-3.5" /> {biz.products?.toLocaleString()}
                                                        </span>
                                                    </>
                                                )}
                                                {biz.contacts !== undefined && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1.5 text-app-text-faint">
                                                            <Users className="w-3.5 h-3.5" /> {biz.contacts?.toLocaleString()}
                                                        </span>
                                                    </>
                                                )}
                                                {biz.transactions !== undefined && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1.5 text-app-text-faint">
                                                            <ShoppingCart className="w-3.5 h-3.5" /> {biz.transactions?.toLocaleString()}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-slate-200 group-hover:text-orange-500 transition-colors" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/*  STEP: PREVIEW  */}
            {step === "PREVIEW" && activeJob && (
                <div className="max-w-3xl mx-auto space-y-6">
                    <Card className="bg-app-surface border-app-border shadow-xl overflow-hidden rounded-3xl">
                        <CardHeader className="bg-app-bg border-b border-app-border">
                            <CardTitle className="text-2xl font-black text-app-text flex items-center gap-3 tracking-tight">
                                <Eye className="w-7 h-7 text-emerald-600" />
                                Import Preview
                                {selectedBusiness && (
                                    <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-orange-600 bg-orange-50 border border-orange-100 px-3 py-1 rounded-full flex items-center gap-1.5">
                                        <Building2 className="w-3.5 h-3.5" />
                                        {selectedBusiness.name}
                                    </span>
                                )}
                            </CardTitle>
                            <CardDescription className="text-app-text-faint font-medium">
                                Review the data that will be imported into your TSF system
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-8">
                            {preview?.status === 'analyzing' ? (
                                <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
                                    <Loader2 className="w-12 h-12 text-app-text-faint animate-spin mb-4" />
                                    <p className="text-app-text text-lg font-bold">Discovering Data...</p>
                                    <p className="text-app-text-faint text-sm mt-1">We are scanning the source file to count records.</p>
                                    <Button
                                        variant="outline" size="sm" className="mt-6 border-app-border text-app-text-muted font-bold"
                                        onClick={() => handlePreview(activeJob!)}
                                    >
                                        <RefreshCw className="w-3 h-3 mr-2" /> Refresh Status
                                    </Button>
                                </div>
                            ) : preview ? (
                                <div className="space-y-4">
                                    {/* Key tables to migrate */}
                                    {[
                                        "users", "units", "categories", "brands", "products", "variations",
                                        "contacts", "transactions", "transaction_sell_lines", "purchase_lines",
                                        "transaction_payments", "accounts", "account_types", "account_transactions",
                                        "variation_location_details", "business_locations",
                                        "expenses", "returns", "expense_categories", "tax_rates",
                                        "product_variations", "stock_adjustment_lines", "customer_groups"
                                    ].map((table) => {
                                        const count = preview?.tables?.[table] || 0
                                        const Icon = entityIcons[table] || Database
                                        const labels: Record<string, string> = {
                                            users: "Users / Staff",
                                            units: "Units of Measure",
                                            categories: "Product Categories",
                                            brands: "Brands",
                                            products: "Products",
                                            variations: "Product Variations",
                                            contacts: "Contacts (Customers & Suppliers)",
                                            transactions: "Transactions (Sales & Purchases)",
                                            transaction_sell_lines: "Sale Line Items",
                                            purchase_lines: "Purchase Line Items",
                                            transaction_payments: "Payment Records",
                                            accounts: "Financial Accounts",
                                            account_types: "Account Categories",
                                            account_transactions: "Account Ledger Entries",
                                            variation_location_details: "Stock Levels",
                                            business_locations: "Sites / Locations",
                                            expenses: "Expenses",
                                            returns: "Sale & Purchase Returns",
                                            expense_categories: "Expense Categories",
                                            tax_rates: "Tax Rates",
                                            product_variations: "Variant Groups",
                                            stock_adjustment_lines: "Stock Adjustments",
                                            customer_groups: "Customer Groups",
                                        }
                                        return (
                                            <div key={table} className="flex items-center justify-between p-3.5 rounded-xl bg-app-bg border border-app-border shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <Icon className="w-5 h-5 text-emerald-600" />
                                                    <span className="text-app-text-muted font-bold text-sm tracking-tight">{labels[table] || table}</span>
                                                </div>
                                                <span className={`text-[11px] font-black font-mono px-2 py-0.5 rounded-md ${count > 0 ? "bg-emerald-100 text-emerald-700" : "bg-app-surface-2 text-app-text-faint"}`}>
                                                    {count.toLocaleString()} rows
                                                </span>
                                            </div>
                                        )
                                    })}

                                    {/* Sync mode toggle */}
                                    <div className="mt-8 p-6 rounded-3xl bg-emerald-50/50 border border-emerald-100 shadow-inner">
                                        <label className="flex items-center gap-4 cursor-pointer">
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    checked={syncMode}
                                                    onChange={(e) => setSyncMode(e.target.checked)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-12 h-7 bg-app-border rounded-full peer peer-checked:bg-emerald-500 transition-colors" />
                                                <div className="absolute top-1 left-1 w-5 h-5 bg-app-surface rounded-full shadow-md peer-checked:translate-x-5 transition-transform" />
                                            </div>
                                            <div>
                                                <span className="text-app-text font-black flex items-center gap-2">
                                                    <RefreshCw className="w-4 h-4 text-emerald-600" />
                                                    Sync Mode
                                                </span>
                                                <p className="text-slate-500/70 text-xs mt-0.5 font-medium">
                                                    {syncMode
                                                        ? "Only import NEW records that haven't been imported before"
                                                        : "Full import — all records will be processed (duplicates skipped automatically)"
                                                    }
                                                </p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center py-20 grayscale opacity-50">
                                    <Loader2 className="w-8 h-8 text-app-text-faint animate-spin mr-2" />
                                    <span className="text-app-text-faint font-bold uppercase tracking-widest text-xs">Loading preview...</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="flex justify-between pt-4">
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (businesses.length > 1) {
                                    setStep("BUSINESSES")
                                    setSelectedBusiness(null)
                                    setPreview(null)
                                } else {
                                    goBack()
                                }
                            }}
                            className="bg-app-surface border-app-border text-app-text-muted hover:bg-app-bg font-bold px-8 rounded-xl shadow-sm"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            {businesses.length > 1 ? "Change Business" : "Cancel"}
                        </Button>
                        <Button
                            onClick={handleStart}
                            disabled={!preview}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-12 rounded-xl shadow-lg shadow-emerald-600/20 py-6"
                        >
                            <Play className="w-5 h-5 mr-2" />
                            {syncMode ? "Start Sync" : "Start Import"}
                        </Button>
                    </div>
                </div>
            )}

            {/*  STEP: RUNNING  */}
            {step === "RUNNING" && activeJob && (
                <div className="max-w-4xl mx-auto">
                    <Card className="bg-app-surface border-app-border shadow-xl mb-6 overflow-hidden rounded-3xl relative">
                        <div className="absolute inset-0 bg-app-bg opacity-50" />
                        <CardContent className="py-16 text-center relative z-10">
                            <div className="relative w-40 h-40 mx-auto mb-8">
                                {/* Animated spinning ring */}
                                <svg className="absolute inset-0 w-full h-full text-gray-100" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="45" fill="none" strokeWidth="6" stroke="currentColor" />
                                </svg>
                                <svg className="absolute inset-0 w-full h-full text-emerald-500" viewBox="0 0 100 100">
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="45"
                                        fill="none"
                                        strokeWidth="6"
                                        stroke="currentColor"
                                        strokeLinecap="round"
                                        className="transition-all duration-700 ease-out origin-center -rotate-90"
                                        strokeDasharray="283"
                                        strokeDashoffset={283 - (283 * activeJob.progress) / 100}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center flex-col">
                                    <span className="text-4xl font-black text-app-text tracking-tighter">{activeJob.progress}%</span>
                                    <span className="text-[10px] font-bold text-app-text-faint uppercase tracking-widest mt-1">Progress</span>
                                </div>
                            </div>

                            <h2 className="text-3xl font-black text-app-text mb-2 tracking-tight">
                                {activeJob.migration_mode === "SYNC" ? "Syncing Data..." : "Import in Progress"}
                            </h2>
                            <p className="text-emerald-700 font-bold mb-1 flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {activeJob.current_step || "Initializing..."}
                            </p>
                            {/* Live heartbeat indicator */}
                            {activeJob.last_heartbeat && (
                                <div className="flex items-center justify-center gap-2 text-[11px] text-app-text-faint mt-1 mb-2 font-medium">
                                    <span className={`w-2 h-2 rounded-full ${isStalled ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'
                                        }`} />
                                    <span>
                                        Life signal: {(() => {
                                            const ago = Math.round((Date.now() - new Date(activeJob.last_heartbeat).getTime()) / 1000)
                                            return ago < 5 ? 'active' : `${ago}s ago`
                                        })()}
                                    </span>
                                </div>
                            )}
                            {selectedBusiness && (
                                <p className="text-orange-700 text-[11px] font-bold uppercase tracking-widest mb-4 flex items-center justify-center gap-2 bg-orange-50 px-3 py-1 rounded-full w-fit mx-auto border border-orange-100">
                                    <Building2 className="w-3.5 h-3.5" />
                                    {selectedBusiness.name}
                                </p>
                            )}

                            {isStalled && (
                                <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-400 max-w-md mx-auto pointer-events-auto">
                                    <h4 className="font-bold flex items-center justify-center gap-2 mb-1">
                                        <AlertTriangle className="w-5 h-5" />
                                        Task seems frozen
                                    </h4>
                                    <p className="text-xs text-red-400/70 mb-3">
                                        No activity detected for 45s. Background worker might be offline.
                                        You can try to force-start it in a background thread.
                                    </p>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="bg-red-500/20 border-red-500/30 text-red-200 hover:bg-red-500/40"
                                        onClick={handleStart}
                                    >
                                        <RefreshCw className="w-3 h-3 mr-2" />
                                        Attempt Recovery
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Live stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                        {[
                            { label: "Products", value: activeJob.total_products, icon: Package, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
                            { label: "Contacts", value: activeJob.total_contacts, icon: Users, color: "text-purple-600", bg: "bg-purple-50 border-purple-100" },
                            { label: "Orders", value: activeJob.total_transactions, icon: ShoppingCart, color: "text-orange-600", bg: "bg-orange-50 border-orange-100" },
                            { label: "Errors", value: activeJob.total_errors, icon: XCircle, color: activeJob.total_errors > 0 ? "text-red-600" : "text-slate-300", bg: activeJob.total_errors > 0 ? "bg-red-50 border-red-100 animate-pulse" : "bg-app-surface border-app-border" },
                        ].map(({ label, value, icon: Icon, color, bg }) => (
                            <div key={label} className={`p-4 rounded-3xl border text-center transition-all ${bg}`}>
                                <Icon className={`w-5 h-5 ${color} mx-auto mb-2`} />
                                <p className={`font-black text-3xl tracking-tight ${color}`}>{(value || 0).toLocaleString()}</p>
                                <p className={`text-[9px] font-black uppercase tracking-widest mt-1 opacity-60 ${color}`}>{label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Pipeline tracker during import */}
                    <MigrationPipeline jobId={activeJob.id} jobStatus={activeJob.status} />
                </div>
            )}

            {/*  STEP: RESULTS  */}
            {step === "RESULTS" && activeJob && (
                <MigrationReviewDashboard job={activeJob} goBack={goBack} onRollback={() => handleRollback(activeJob)} />
            )}

            <ConfirmDialog
                open={rollbackTarget !== null}
                onOpenChange={(open) => { if (!open) setRollbackTarget(null) }}
                onConfirm={confirmRollback}
                title="Rollback Migration?"
                description="This will DELETE all data imported by this migration. This action cannot be undone."
                confirmText="Rollback"
                variant="danger"
            />
        </div>
    )
}
