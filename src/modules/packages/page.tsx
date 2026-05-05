// @ts-nocheck
"use client"

import { useState, useEffect, useCallback } from "react"
import { PackageStats } from "@/types/erp"
import { useDropzone } from "react-dropzone"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Upload, Package, Server, Monitor, Puzzle,
    Clock, CheckCircle2, XCircle, Loader2,
    Play, RotateCcw, Trash2, Calendar, Download,
    HardDrive, Shield
} from "lucide-react"
import { apiClient } from "@/lib/api"
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface PackageUpload {
    id: string
    package_type: string
    package_type_display: string
    name: string
    version: string
    file_size: number
    status: string
    status_display: string
    changelog: string
    uploaded_at: string
    scheduled_for: string | null
    applied_at: string | null
    uploaded_by_name: string | null
}

const statusColors: Record<string, string> = {
    uploading: "bg-app-info/20 text-blue-400 border-app-info/30",
    ready: "bg-app-success/20 text-emerald-400 border-app-success/30",
    scheduled: "bg-app-warning/20 text-amber-400 border-app-warning/30",
    applying: "bg-app-info/20 text-cyan-400 border-app-info/30",
    applied: "bg-app-success/20 text-green-400 border-app-success/30",
    failed: "bg-app-error/20 text-red-400 border-app-error/30",
    rolled_back: "bg-slate-500/20 text-app-muted-foreground border-slate-500/30",
}

const typeIcons: Record<string, any> = {
    kernel: Server,
    frontend: Monitor,
    module: Puzzle,
}

export default function PackagesPage() {
    const [packages, setPackages] = useState<PackageUpload[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [isUploading, setIsUploading] = useState(false)
    const [selectedType, setSelectedType] = useState<string>("all")
    const [stats, setStats] = useState<PackageStats | null>(null)
    const [pendingAction, setPendingAction] = useState<{ type: 'apply' | 'rollback' | 'delete'; pkg: PackageUpload } | null>(null)

    const fetchPackages = async () => {
        try {
            const params = selectedType !== "all" ? `?type=${selectedType}` : ""
            const response = await apiClient.get(`/api/packages/${params}`)
            setPackages(response.data.results || response.data || [])
        } catch (error) {
            console.error("Failed to fetch packages:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const fetchStats = async () => {
        try {
            const response = await apiClient.get("/api/packages/stats/")
            setStats(response.data)
        } catch (error) {
            console.error("Failed to fetch stats:", error)
        }
    }

    useEffect(() => {
        fetchPackages()
        fetchStats()
    }, [selectedType])

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0]
        if (!file) return

        // Determine package type from filename
        let packageType = "module"
        if (file.name.includes(".kernel.")) packageType = "kernel"
        else if (file.name.includes(".frontend.")) packageType = "frontend"

        setIsUploading(true)
        setUploadProgress(0)

        const formData = new FormData()
        formData.append("file", file)
        formData.append("package_type", packageType)

        try {
            await apiClient.post("/api/packages/upload/", formData, {
                headers: { "Content-Type": "multipart/form-data" },
                onUploadProgress: (progressEvent) => {
                    const progress = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1))
                    setUploadProgress(progress)
                }
            })
            fetchPackages()
            fetchStats()
        } catch (error) {
            console.error("Upload failed:", error)
        } finally {
            setIsUploading(false)
            setUploadProgress(0)
        }
    }, [])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { "application/zip": [".zip"] },
        maxFiles: 1
    })

    const applyPackage = async (pkg: PackageUpload) => {
        setPendingAction({ type: 'apply', pkg })
    }

    const rollbackPackage = async (pkg: PackageUpload) => {
        setPendingAction({ type: 'rollback', pkg })
    }

    const deletePackage = async (pkg: PackageUpload) => {
        setPendingAction({ type: 'delete', pkg })
    }

    const confirmAction = async () => {
        if (!pendingAction) return
        const { type, pkg } = pendingAction
        setPendingAction(null)
        try {
            if (type === 'apply') {
                await apiClient.post(`/api/packages/${pkg.id}/apply/`)
            } else if (type === 'rollback') {
                await apiClient.post(`/api/packages/${pkg.id}/rollback/`)
            } else if (type === 'delete') {
                await apiClient.delete(`/api/packages/${pkg.id}/`)
                fetchStats()
            }
            fetchPackages()
        } catch (error) {
            console.error(`${type} failed:`, error)
        }
    }

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    return (
        <div className="min-h-screen bg-[#020617] p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-white">
                            Package Storage Center
                        </h1>
                        <p className="text-app-muted-foreground mt-1">
                            Upload, manage, and deploy kernel and module packages
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-xl border border-white/5">
                            <HardDrive className="w-4 h-4 text-cyan-400" />
                            <span className="text-sm text-app-muted-foreground">
                                {stats?.total || 0} packages stored
                            </span>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-4 gap-4">
                    {[
                        { label: "Backend Kernel", count: stats?.by_type?.kernel || 0, icon: Server, color: "cyan" },
                        { label: "Frontend Kernel", count: stats?.by_type?.frontend || 0, icon: Monitor, color: "amber" },
                        { label: "Modules", count: stats?.by_type?.module || 0, icon: Puzzle, color: "emerald" },
                        { label: "Applied", count: stats?.by_status?.applied || 0, icon: CheckCircle2, color: "green" },
                    ].map((stat) => (
                        <Card key={stat.label} className="bg-slate-900/50 border-white/5">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl bg-${stat.color}-500/10 border border-${stat.color}-500/20 flex items-center justify-center`}>
                                    <stat.icon className={`w-6 h-6 text-${stat.color}-400`} />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-white">{stat.count}</p>
                                    <p className="text-xs text-app-muted-foreground uppercase tracking-wider">{stat.label}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Upload Zone */}
                <Card className="bg-slate-900/50 border-white/5 overflow-hidden">
                    <CardHeader className="border-b border-white/5">
                        <CardTitle className="text-white flex items-center gap-2">
                            <Upload className="w-5 h-5 text-cyan-400" />
                            Upload Package
                        </CardTitle>
                        <CardDescription>
                            Drop a .kernel.zip, .frontend.zip, or .module.zip file
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div
                            {...getRootProps()}
                            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${isDragActive
                                ? "border-app-info bg-app-info/10"
                                : "border-white/10 hover:border-white/20 hover:bg-white/5"
                                }`}
                        >
                            <input {...getInputProps()} />
                            {isUploading ? (
                                <div className="space-y-4">
                                    <Loader2 className="w-12 h-12 mx-auto text-cyan-400 animate-spin" />
                                    <Progress value={uploadProgress} className="max-w-xs mx-auto" />
                                    <p className="text-sm text-app-muted-foreground">Uploading... {uploadProgress}%</p>
                                </div>
                            ) : (
                                <>
                                    <Package className="w-12 h-12 mx-auto text-app-muted-foreground mb-4" />
                                    <p className="text-app-muted-foreground font-medium">
                                        {isDragActive ? "Drop here..." : "Drag & drop package or click to browse"}
                                    </p>
                                    <p className="text-xs text-app-muted-foreground mt-2">
                                        Supports: *.kernel.zip, *.frontend.zip, *.module.zip
                                    </p>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Package Vault */}
                <Card className="bg-slate-900/50 border-white/5">
                    <CardHeader className="border-b border-white/5">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-emerald-400" />
                                    Package Vault
                                </CardTitle>
                                <CardDescription>
                                    History of all uploaded packages
                                </CardDescription>
                            </div>
                            <Tabs value={selectedType} onValueChange={setSelectedType}>
                                <TabsList className="bg-slate-800/50">
                                    <TabsTrigger value="all">All</TabsTrigger>
                                    <TabsTrigger value="kernel">Kernel</TabsTrigger>
                                    <TabsTrigger value="frontend">Frontend</TabsTrigger>
                                    <TabsTrigger value="module">Module</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="p-12 text-center">
                                <Loader2 className="w-8 h-8 mx-auto text-cyan-400 animate-spin" />
                            </div>
                        ) : packages.length === 0 ? (
                            <div className="p-12 text-center text-app-muted-foreground">
                                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>No packages uploaded yet</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {packages.map((pkg) => {
                                    const TypeIcon = typeIcons[pkg.package_type] || Package
                                    return (
                                        <div key={pkg.id} className="p-4 flex items-center gap-4 hover:bg-white/5 transition-colors">
                                            <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center">
                                                <TypeIcon className="w-6 h-6 text-app-muted-foreground" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold text-white truncate">{pkg.name}</p>
                                                    <Badge variant="outline" className="text-xs">v{pkg.version}</Badge>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-app-muted-foreground mt-1">
                                                    <span>{pkg.package_type_display}</span>
                                                    <span>•</span>
                                                    <span>{formatFileSize(pkg.file_size)}</span>
                                                    <span>•</span>
                                                    <span>{new Date(pkg.uploaded_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <Badge className={`${statusColors[pkg.status]} border`}>
                                                {pkg.status_display}
                                            </Badge>
                                            <div className="flex items-center gap-2">
                                                {pkg.status === "ready" && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => applyPackage(pkg)}
                                                        className="bg-app-success hover:bg-app-success"
                                                    >
                                                        <Play className="w-4 h-4 mr-1" /> Apply
                                                    </Button>
                                                )}
                                                {pkg.status === "applied" && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => rollbackPackage(pkg)}
                                                        className="border-app-warning/30 text-amber-400 hover:bg-app-warning/10"
                                                    >
                                                        <RotateCcw className="w-4 h-4 mr-1" /> Rollback
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => deletePackage(pkg)}
                                                    className="text-red-400 hover:bg-app-error/10"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <ConfirmDialog
                open={pendingAction !== null}
                onOpenChange={(open) => { if (!open) setPendingAction(null) }}
                onConfirm={confirmAction}
                title={
                    pendingAction?.type === 'apply' ? `Apply ${pendingAction.pkg.name} v${pendingAction.pkg.version}?` :
                        pendingAction?.type === 'rollback' ? `Rollback ${pendingAction.pkg.name} v${pendingAction.pkg.version}?` :
                            `Delete ${pendingAction?.pkg.name} v${pendingAction?.pkg.version}?`
                }
                description={
                    pendingAction?.type === 'apply' ? 'This package will be applied to the system.' :
                        pendingAction?.type === 'rollback' ? 'This will revert the system to the previous version.' :
                            'This package will be permanently deleted.'
                }
                variant={pendingAction?.type === 'delete' ? 'danger' : 'warning'}
            />
        </div>
    )
}
