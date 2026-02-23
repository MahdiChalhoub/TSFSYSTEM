"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
import { initChunkedUpload, completeChunkedUpload, getActiveUploads, getUploadStatus } from "@/modules/storage/actions"
import {
    getMigrationJobs,
    getMigrationJobDetail,
    getBusinesses,
    previewMigration,
    startMigration,
    rollbackMigration,
    linkMigrationFile
} from "./actions"

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface MigrationJob {
    id: number
    name: string
    source_type: string
    status: string
    progress: number
    current_step: string | null
    source_business_id: number | null
    source_business_name: string | null
    migration_mode: string
    total_units: number
    total_categories: number
    total_brands: number
    total_products: number
    total_contacts: number
    total_transactions: number
    total_accounts: number
    total_errors: number
    error_log: string | null
    created_by_name: string
    started_at: string | null
    completed_at: string | null
    created_at: string
    mappings_summary?: Record<string, number>
}

interface PreviewData {
    tables: Record<string, number>
}

interface Business {
    id: number
    name: string
    currency_id?: number
    start_date?: string
    products?: number
    contacts?: number
    transactions?: number
    locations?: number
}

type WizardStep = "LIST" | "SOURCE" | "UPLOAD" | "BUSINESSES" | "PREVIEW" | "RUNNING" | "RESULTS"

// ─────────────────────────────────────────────────────────────────────────────
// STATUS VISUALS
// ─────────────────────────────────────────────────────────────────────────────

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
    PENDING: { color: "bg-slate-500/20 text-slate-400 border-slate-500/30", icon: FileUp, label: "Pending" },
    PARSING: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Database, label: "Parsing" },
    RUNNING: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: Loader2, label: "Running" },
    COMPLETED: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle2, label: "Completed" },
    FAILED: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle, label: "Failed" },
    ROLLED_BACK: { color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: RotateCcw, label: "Rolled Back" },
}

const entityIcons: Record<string, any> = {
    units: Ruler,
    categories: Layers,
    brands: Tag,
    products: Package,
    contacts: Users,
    transactions: ShoppingCart,
    accounts: Banknote,
}

// ─────────────────────────────────────────────────────────────────────────────
// THIRD-PARTY SOURCES
// ─────────────────────────────────────────────────────────────────────────────

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
        color: "from-blue-500/10 to-cyan-500/10 border-blue-500/20",
    },
]

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

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

    // ── Fetch Jobs ──────────────────────────────────────────────────────────
    const fetchJobs = useCallback(async () => {
        try {
            const data = await getMigrationJobs()
            setJobs(data?.results ?? (Array.isArray(data) ? data : []))
        } catch { }
    }, [])

    useEffect(() => {
        fetchJobs()
    }, [fetchJobs])

    // ── Polling for Active Uploads (Resumption) ─────────────────────────────
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

    // ── Polling for Running Jobs ────────────────────────────────────────────
    useEffect(() => {
        if (activeJob && (activeJob.status === "PARSING" || activeJob.status === "RUNNING")) {
            pollRef.current = setInterval(async () => {
                try {
                    const data = await getMigrationJobDetail(activeJob.id)
                    setActiveJob(data)
                    if (data.status === "COMPLETED" || data.status === "FAILED") {
                        setStep("RESULTS")
                        if (pollRef.current) clearInterval(pollRef.current)
                    }
                } catch { }
            }, 2000)

            return () => { if (pollRef.current) clearInterval(pollRef.current) }
        }
    }, [activeJob?.id, activeJob?.status])

    // ── Upload Handler ──────────────────────────────────────────────────────
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
            try {
                const bizData = await getBusinesses(job.id)
                const bizList = bizData?.businesses ?? []
                setBusinesses(bizList)
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
            } catch {
                setStep("PREVIEW")
            } finally {
                setLoadingBusinesses(false)
            }
        } catch (e: unknown) {
            setError((e instanceof Error ? e.message : String(e)) || "Upload failed")
        } finally {
            setUploading(false)
        }
    }

    // ── Select Business ─────────────────────────────────────────────────────
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

    // ── Preview Handler ─────────────────────────────────────────────────────
    const handlePreview = async (job: MigrationJob) => {
        setActiveJob(job)
        setError(null)
        try {
            // Fetch businesses first
            setLoadingBusinesses(true)
            const bizData = await getBusinesses(job.id)
            const bizList = bizData?.businesses ?? []
            setBusinesses(bizList)
            setLoadingBusinesses(false)

            if (bizList.length > 1) {
                setStep("BUSINESSES")
            } else {
                if (bizList.length === 1) setSelectedBusiness(bizList[0])
                const bizId = bizList[0]?.id
                const data = await previewMigration(job.id, bizId)
                setPreview(data)
                setStep("PREVIEW")
            }
        } catch (e: unknown) {
            setError((e instanceof Error ? e.message : String(e)) || "Preview failed")
            setLoadingBusinesses(false)
        }
    }

    // ── Start Migration ─────────────────────────────────────────────────────
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

    // ── Rollback ────────────────────────────────────────────────────────────
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

    // ── View Results ────────────────────────────────────────────────────────
    const viewResults = async (job: MigrationJob) => {
        try {
            const data = await getMigrationJobDetail(job.id)
            setActiveJob(data)
            setStep("RESULTS")
        } catch { }
    }

    // ── Drag & Drop ─────────────────────────────────────────────────────────
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

    // ── Reset to list ───────────────────────────────────────────────────────
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
        <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#111128] to-[#0d0d2b] text-white p-6 lg:p-10">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {step !== "LIST" && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={goBack}
                            className="text-white/60 hover:text-white hover:bg-white/10"
                        >
                            <ArrowLeft className="w-4 h-4 mr-1" /> Back
                        </Button>
                    )}
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 flex items-center gap-3">
                            <Globe className="w-8 h-8 text-purple-400" />
                            Import from Third Party
                        </h1>
                        <p className="text-white/50 mt-1">Migrate data from external systems into TSF</p>
                    </div>
                </div>
                {step === "LIST" && (
                    <Button
                        onClick={() => setStep("SOURCE")}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-6 py-2 rounded-xl shadow-lg shadow-purple-500/20"
                    >
                        <Upload className="w-4 h-4 mr-2" /> New Import
                    </Button>
                )}
            </div>

            {/* Error Banner */}
            {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                    <span className="text-red-300">{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">✕</button>
                </div>
            )}

            {/* ─── STEP: JOB LIST ─────────────────────────────────────────────── */}
            {step === "LIST" && (
                <div className="space-y-4">
                    {jobs.length === 0 ? (
                        <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                            <CardContent className="flex flex-col items-center justify-center py-16">
                                <Globe className="w-16 h-16 text-white/20 mb-4" />
                                <p className="text-white/40 text-lg">No imports yet</p>
                                <p className="text-white/25 text-sm mt-1">Import data from an external POS or ERP system</p>
                                <Button
                                    onClick={() => setStep("SOURCE")}
                                    className="mt-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500"
                                >
                                    <Upload className="w-4 h-4 mr-2" /> Start Import
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        jobs.map((job) => {
                            const config = statusConfig[job.status] || statusConfig.PENDING
                            const StatusIcon = config.icon
                            return (
                                <Card key={job.id} className="bg-white/5 border-white/10 backdrop-blur-xl hover:bg-white/[0.07] transition-all">
                                    <CardContent className="flex items-center gap-6 py-5">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${config.color} border`}>
                                            <StatusIcon className={`w-5 h-5 ${job.status === "RUNNING" ? "animate-spin" : ""}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-white font-semibold truncate">{job.name}</h3>
                                            <div className="flex items-center gap-4 mt-1 text-sm text-white/40 flex-wrap">
                                                <span>{config.label}</span>
                                                <span>•</span>
                                                <span>{new Date(job.created_at).toLocaleDateString()}</span>
                                                {job.source_business_name && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="text-orange-400 flex items-center gap-1">
                                                            <Building2 className="w-3 h-3" />
                                                            {job.source_business_name}
                                                        </span>
                                                    </>
                                                )}
                                                {job.migration_mode === "SYNC" && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="text-cyan-400 flex items-center gap-1">
                                                            <RefreshCw className="w-3 h-3" />
                                                            Sync
                                                        </span>
                                                    </>
                                                )}
                                                {job.current_step && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="text-blue-400">{job.current_step}</span>
                                                    </>
                                                )}
                                            </div>
                                            {(job.status === "RUNNING" || job.status === "PARSING") && (
                                                <div className="mt-2 w-full bg-white/10 rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                                                        style={{ width: `${job.progress}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            {job.status === "PENDING" && (
                                                <Button size="sm" variant="ghost" onClick={() => handlePreview(job)}
                                                    className="text-blue-400 hover:bg-blue-500/10" title="Preview">
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                            )}
                                            {(job.status === "RUNNING" || job.status === "PARSING") && (
                                                <Button size="sm" variant="ghost" onClick={() => viewResults(job)}
                                                    className="text-amber-400 hover:bg-amber-500/10" title="View Progress">
                                                    <BarChart3 className="w-4 h-4" />
                                                </Button>
                                            )}
                                            {(job.status === "COMPLETED" || job.status === "FAILED") && (
                                                <>
                                                    <Button size="sm" variant="ghost" onClick={() => viewResults(job)}
                                                        className="text-emerald-400 hover:bg-emerald-500/10" title="View Results">
                                                        <BarChart3 className="w-4 h-4" />
                                                    </Button>
                                                    {job.status === "COMPLETED" && (
                                                        <Button size="sm" variant="ghost" onClick={() => handleRollback(job)}
                                                            className="text-red-400 hover:bg-red-500/10" title="Rollback">
                                                            <RotateCcw className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })
                    )}
                </div>
            )}

            {/* ─── STEP: SOURCE SELECTION ──────────────────────────────────────── */}
            {step === "SOURCE" && (
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-white mb-2">Choose Import Source</h2>
                        <p className="text-white/40">Select the system you're migrating from</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {IMPORT_SOURCES.map((source) => (
                            <button
                                key={source.id}
                                disabled={!source.available}
                                onClick={() => source.available && setStep("UPLOAD")}
                                className={`text-left p-6 rounded-2xl border transition-all
                                    bg-gradient-to-br ${source.color}
                                    ${source.available
                                        ? "hover:scale-[1.02] hover:shadow-lg cursor-pointer"
                                        : "opacity-40 cursor-not-allowed"
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <span className="text-3xl">{source.icon}</span>
                                        <h3 className="text-white font-bold text-lg mt-3">{source.name}</h3>
                                        <p className="text-white/40 text-sm mt-1">{source.description}</p>
                                    </div>
                                    {source.available && (
                                        <ChevronRight className="w-5 h-5 text-white/40 mt-1" />
                                    )}
                                </div>
                                {!source.available && (
                                    <span className="inline-block mt-3 text-xs px-2 py-1 rounded-full bg-white/10 text-white/30">
                                        Coming Soon
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── STEP: UPLOAD ───────────────────────────────────────────────── */}
            {step === "UPLOAD" && (
                <Card className="bg-white/5 border-white/10 backdrop-blur-xl max-w-2xl mx-auto">
                    <CardHeader className="text-center pb-2">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <span className="text-2xl">🛒</span>
                            <CardTitle className="text-2xl text-white">UltimatePOS Import</CardTitle>
                        </div>
                        <CardDescription className="text-white/40">
                            Export your UltimatePOS database from phpMyAdmin as a .sql file
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div
                            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer
                                ${dragActive
                                    ? "border-purple-400 bg-purple-500/10"
                                    : "border-white/20 hover:border-white/40 hover:bg-white/5"
                                }`}
                            onDragEnter={handleDrag}
                            onDragOver={handleDrag}
                            onDragLeave={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".sql"
                                className="hidden"
                                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                            />
                            {uploading ? (
                                <div className="flex flex-col items-center w-full max-w-md mx-auto">
                                    <h3 className="text-white font-medium mb-3">Uploading Database...</h3>
                                    <div className="w-full bg-slate-800 rounded-full h-3 mb-2 overflow-hidden border border-slate-700">
                                        <div
                                            className="bg-purple-500 h-3 rounded-full transition-all duration-300 relative overflow-hidden"
                                            style={{ width: `${uploadProgress}%` }}
                                        >
                                            <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                        </div>
                                    </div>
                                    <p className="text-sm text-purple-400 font-medium">{uploadProgress}% Complete</p>
                                    <p className="text-xs text-white/40 mt-4 max-w-xs leading-relaxed">Please keep this page open. Analyzing businesses will start automatically after upload completes.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center mb-4">
                                        <FileUp className="w-8 h-8 text-orange-400" />
                                    </div>
                                    <p className="text-white text-lg font-medium mb-1">
                                        Drop your .sql file here
                                    </p>
                                    <p className="text-white/40 text-sm">
                                        or click to browse • Supports large database files
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                            <h4 className="text-blue-400 font-medium text-sm flex items-center gap-2">
                                <Server className="w-4 h-4" /> How to export from UltimatePOS
                            </h4>
                            <ol className="text-white/40 text-sm mt-2 space-y-1 list-decimal list-inside">
                                <li>Open <strong className="text-white/60">phpMyAdmin</strong></li>
                                <li>Select your UltimatePOS database</li>
                                <li>Click <strong className="text-white/60">Export</strong> → Quick → SQL format</li>
                                <li>Download the .sql file</li>
                                <li>Upload it here</li>
                            </ol>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ─── STEP: BUSINESS SELECTOR ────────────────────────────────────── */}
            {step === "BUSINESSES" && (
                <div className="max-w-3xl mx-auto space-y-6">
                    <div className="text-center mb-4">
                        <h2 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-3">
                            <Building2 className="w-7 h-7 text-orange-400" />
                            Select Business to Import
                        </h2>
                        <p className="text-white/40">
                            Your SQL dump contains <strong className="text-white/70">{businesses.length} businesses</strong>.
                            Choose which one to import into this TSF organization.
                        </p>
                    </div>

                    {loadingBusinesses ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 text-purple-400 animate-spin mr-3" />
                            <span className="text-white/40">Discovering businesses...</span>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {businesses.map((biz) => (
                                <button
                                    key={biz.id}
                                    onClick={() => handleSelectBusiness(biz)}
                                    className="w-full text-left p-5 rounded-2xl bg-white/5 border border-white/10
                                        hover:bg-white/[0.08] hover:border-orange-500/30 hover:scale-[1.01]
                                        transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20
                                            border border-orange-500/30 flex items-center justify-center shrink-0">
                                            <Building2 className="w-5 h-5 text-orange-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-white font-semibold text-lg truncate">
                                                {biz.name || `Business #${biz.id}`}
                                            </h3>
                                            <div className="flex items-center gap-4 mt-1 text-sm text-white/40">
                                                <span>ID: {biz.id}</span>
                                                {biz.products !== undefined && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1">
                                                            <Package className="w-3 h-3" /> {biz.products?.toLocaleString()} products
                                                        </span>
                                                    </>
                                                )}
                                                {biz.contacts !== undefined && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1">
                                                            <Users className="w-3 h-3" /> {biz.contacts?.toLocaleString()} contacts
                                                        </span>
                                                    </>
                                                )}
                                                {biz.transactions !== undefined && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1">
                                                            <ShoppingCart className="w-3 h-3" /> {biz.transactions?.toLocaleString()} transactions
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-orange-400 transition-colors" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ─── STEP: PREVIEW ──────────────────────────────────────────────── */}
            {step === "PREVIEW" && activeJob && (
                <div className="max-w-3xl mx-auto space-y-6">
                    <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="text-xl text-white flex items-center gap-2">
                                <Eye className="w-5 h-5 text-purple-400" />
                                Import Preview
                                {selectedBusiness && (
                                    <span className="ml-2 text-sm font-normal text-orange-400 flex items-center gap-1">
                                        <Building2 className="w-4 h-4" />
                                        {selectedBusiness.name}
                                    </span>
                                )}
                            </CardTitle>
                            <CardDescription className="text-white/40">
                                Review the data that will be imported into your TSF system
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {preview ? (
                                <div className="space-y-4">
                                    {/* Key tables to migrate */}
                                    {["units", "categories", "brands", "products", "contacts", "transactions", "transaction_sell_lines", "purchase_lines", "accounts", "variation_location_details"].map((table) => {
                                        const count = preview.tables[table] || 0
                                        const Icon = entityIcons[table] || Database
                                        const labels: Record<string, string> = {
                                            units: "Units of Measure",
                                            categories: "Product Categories",
                                            brands: "Brands",
                                            products: "Products",
                                            contacts: "Contacts (Customers & Suppliers)",
                                            transactions: "Transactions (Sales & Purchases)",
                                            transaction_sell_lines: "Sale Line Items",
                                            purchase_lines: "Purchase Line Items",
                                            accounts: "Financial Accounts",
                                            variation_location_details: "Stock Levels",
                                        }
                                        return (
                                            <div key={table} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                                                <div className="flex items-center gap-3">
                                                    <Icon className="w-5 h-5 text-purple-400" />
                                                    <span className="text-white/80">{labels[table] || table}</span>
                                                </div>
                                                <span className={`text-sm font-mono ${count > 0 ? "text-emerald-400" : "text-white/30"}`}>
                                                    {count.toLocaleString()} rows
                                                </span>
                                            </div>
                                        )
                                    })}

                                    {/* Sync mode toggle */}
                                    <div className="mt-6 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    checked={syncMode}
                                                    onChange={(e) => setSyncMode(e.target.checked)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:bg-cyan-500 transition-colors" />
                                                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow
                                                    peer-checked:translate-x-5 transition-transform" />
                                            </div>
                                            <div>
                                                <span className="text-white font-medium flex items-center gap-2">
                                                    <RefreshCw className="w-4 h-4 text-cyan-400" />
                                                    Sync Mode
                                                </span>
                                                <p className="text-white/40 text-sm mt-0.5">
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
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 text-purple-400 animate-spin mr-2" />
                                    <span className="text-white/40">Loading preview...</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="flex justify-between">
                        <Button
                            variant="ghost"
                            onClick={() => {
                                if (businesses.length > 1) {
                                    setStep("BUSINESSES")
                                    setSelectedBusiness(null)
                                    setPreview(null)
                                } else {
                                    goBack()
                                }
                            }}
                            className="text-white/60 hover:text-white hover:bg-white/10"
                        >
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            {businesses.length > 1 ? "Change Business" : "Cancel"}
                        </Button>
                        <Button
                            onClick={handleStart}
                            disabled={!preview}
                            className="bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white px-8 rounded-xl shadow-lg shadow-emerald-500/20"
                        >
                            <Play className="w-4 h-4 mr-2" />
                            {syncMode ? "Start Sync" : "Start Import"}
                        </Button>
                    </div>
                </div>
            )}

            {/* ─── STEP: RUNNING ──────────────────────────────────────────────── */}
            {step === "RUNNING" && activeJob && (
                <div className="max-w-4xl mx-auto">
                    <Card className="bg-white/5 border-white/10 backdrop-blur-xl mb-6 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-transparent animate-pulse" />
                        <CardContent className="py-12 text-center relative pointer-events-none">
                            <div className="relative w-32 h-32 mx-auto mb-6">
                                {/* Animated spinning ring */}
                                <svg className="absolute inset-0 w-full h-full text-white/10" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="45" fill="none" strokeWidth="8" stroke="currentColor" />
                                </svg>
                                <svg className="absolute inset-0 w-full h-full text-purple-500" viewBox="0 0 100 100">
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="45"
                                        fill="none"
                                        strokeWidth="8"
                                        stroke="currentColor"
                                        strokeLinecap="round"
                                        className="transition-all duration-700 ease-out origin-center -rotate-90"
                                        strokeDasharray="283"
                                        strokeDashoffset={283 - (283 * activeJob.progress) / 100}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center flex-col">
                                    <span className="text-3xl font-black text-white">{activeJob.progress}%</span>
                                </div>
                            </div>

                            <h2 className="text-2xl font-bold text-white mb-2">
                                {activeJob.migration_mode === "SYNC" ? "Syncing Data..." : "Import in Progress"}
                            </h2>
                            <p className="text-purple-300 font-medium mb-1 animate-pulse">
                                {activeJob.current_step || "Initializing..."}
                            </p>
                            {selectedBusiness && (
                                <p className="text-orange-400/80 text-sm mb-4 flex items-center justify-center gap-1">
                                    <Building2 className="w-3 h-3" />
                                    {selectedBusiness.name}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Live stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { label: "Products", value: activeJob.total_products, icon: Package, color: "text-purple-400" },
                            { label: "Contacts", value: activeJob.total_contacts, icon: Users, color: "text-pink-400" },
                            { label: "Orders", value: activeJob.total_transactions, icon: ShoppingCart, color: "text-amber-400" },
                            { label: "Errors", value: activeJob.total_errors, icon: XCircle, color: activeJob.total_errors > 0 ? "text-red-400 animate-bounce" : "text-white/20" },
                        ].map(({ label, value, icon: Icon, color }) => (
                            <div key={label} className="p-4 rounded-xl bg-white/5 border border-white/10 text-center relative overflow-hidden">
                                {value > 0 && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white/20 to-transparent" />}
                                <Icon className={`w-6 h-6 ${color} mx-auto mb-2`} />
                                <p className="text-white font-black text-3xl tracking-tighter">{value.toLocaleString()}</p>
                                <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── STEP: RESULTS ──────────────────────────────────────────────── */}
            {step === "RESULTS" && activeJob && (
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Status banner */}
                    <Card className={`border backdrop-blur-xl ${activeJob.status === "COMPLETED"
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : activeJob.status === "FAILED"
                            ? "bg-red-500/10 border-red-500/30"
                            : "bg-amber-500/10 border-amber-500/30"
                        }`}>
                        <CardContent className="flex items-center gap-6 py-8">
                            {activeJob.status === "COMPLETED" ? (
                                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                                </div>
                            ) : activeJob.status === "FAILED" ? (
                                <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center shrink-0">
                                    <XCircle className="w-8 h-8 text-red-400" />
                                </div>
                            ) : (
                                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0">
                                    <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                                </div>
                            )}
                            <div>
                                <h2 className="text-3xl font-black text-white tracking-tighter shadow-sm">
                                    {activeJob.status === "COMPLETED"
                                        ? (activeJob.migration_mode === "SYNC" ? "Sync Completed Successfully" : "Import Completed Successfully")
                                        : activeJob.status === "FAILED" ? "Import Failed" : "Import Running..."}
                                </h2>
                                <p className="text-white/60 font-medium mt-1">
                                    {activeJob.source_business_name && (
                                        <span className="text-orange-400 mr-2 border border-orange-400/30 bg-orange-400/10 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-widest">
                                            {activeJob.source_business_name}
                                        </span>
                                    )}
                                    {activeJob.completed_at
                                        ? `Finished at ${new Date(activeJob.completed_at).toLocaleString()}`
                                        : activeJob.current_step}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Statistics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { label: "Units", value: activeJob.total_units, icon: Ruler, color: "text-cyan-400" },
                            { label: "Categories", value: activeJob.total_categories, icon: Layers, color: "text-blue-400" },
                            { label: "Brands", value: activeJob.total_brands, icon: Tag, color: "text-indigo-400" },
                            { label: "Products", value: activeJob.total_products, icon: Package, color: "text-purple-400" },
                            { label: "Contacts", value: activeJob.total_contacts, icon: Users, color: "text-pink-400" },
                            { label: "Transactions", value: activeJob.total_transactions, icon: ShoppingCart, color: "text-amber-400" },
                            { label: "Accounts", value: activeJob.total_accounts, icon: Banknote, color: "text-emerald-400" },
                            { label: "Errors", value: activeJob.total_errors, icon: XCircle, color: activeJob.total_errors > 0 ? "text-red-400" : "text-white/20" },
                        ].map(({ label, value, icon: Icon, color }) => (
                            <Card key={label} className="bg-white/5 border-white/10 shadow-lg">
                                <CardContent className="py-6 text-center">
                                    <Icon className={`w-8 h-8 ${color} mx-auto mb-3`} />
                                    <p className="text-white text-3xl font-black tracking-tighter">{value.toLocaleString()}</p>
                                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">{label}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Error log */}
                    {activeJob.error_log && (
                        <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                            <CardHeader className="pb-2 border-b border-white/10 relative">
                                <div className="absolute top-0 left-0 w-full h-1 bg-red-500 rounded-t-xl" />
                                <CardTitle className="text-sm font-bold uppercase tracking-widest text-red-400 flex items-center gap-2 mt-2">
                                    <AlertTriangle className="w-4 h-4" /> Migration Warnings & Errors
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="bg-[#0a0a0a] border border-white/5 p-4 rounded-xl max-h-64 overflow-auto custom-scrollbar">
                                    <pre className="text-[11px] leading-relaxed text-red-300 w-full whitespace-pre-wrap font-mono">
                                        {activeJob.error_log}
                                    </pre>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Mappings summary */}
                    {activeJob.mappings_summary && Object.keys(activeJob.mappings_summary).length > 0 && (
                        <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-white/60">Mapping Summary</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {Object.entries(activeJob.mappings_summary).map(([type, count]) => (
                                        <div key={type} className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                                            <p className="text-white text-lg font-bold">{count}</p>
                                            <p className="text-white/40 text-xs">{type}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Actions */}
                    {activeJob.status === "COMPLETED" && (
                        <div className="flex justify-end gap-3">
                            <Button
                                variant="ghost"
                                onClick={() => handleRollback(activeJob)}
                                className="text-red-400 hover:bg-red-500/10 border border-red-500/20"
                            >
                                <Trash2 className="w-4 h-4 mr-2" /> Rollback Import
                            </Button>
                            <Button
                                onClick={goBack}
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500"
                            >
                                Done
                            </Button>
                        </div>
                    )}
                </div>
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
