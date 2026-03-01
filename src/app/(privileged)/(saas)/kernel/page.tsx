'use client'

import { useEffect, useState, useRef } from "react"
import { getKernelInfo, stageKernelUpdate, applyKernelUpdate } from "@/app/actions/saas/kernel"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Cpu, UploadCloud, RefreshCw, CheckCircle2, Clock, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface KernelUpdate {
    id: number
    version: string
    changelog: string
    is_applied: boolean
    applied_at: string | null
    created_at: string | null
}

export default function KernelPage() {
    const [currentVersion, setCurrentVersion] = useState<string>("Loading...")
    const [updates, setUpdates] = useState<KernelUpdate[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [applying, setApplying] = useState<number | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        loadKernelInfo()
    }, [])

    async function loadKernelInfo() {
        setLoading(true)
        try {
            const data = await getKernelInfo()
            if (data.error) {
                toast.error(data.error)
            } else {
                setCurrentVersion(data.current_version)
                setUpdates(data.updates || [])
            }
        } catch {
            toast.error("Failed to load kernel info")
        } finally {
            setLoading(false)
        }
    }

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.name.endsWith('.kernel.zip')) {
            toast.error("Invalid file type. Must be .kernel.zip")
            return
        }

        setUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)

            const res = await stageKernelUpdate(formData)
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success(res.message)
                await loadKernelInfo()
            }
        } catch {
            toast.error("Upload failed")
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    async function handleApply(updateId: number) {
        setApplying(updateId)
        try {
            const res = await applyKernelUpdate(updateId)
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success(res.message)
                await loadKernelInfo()
            }
        } catch {
            toast.error("Apply failed")
        } finally {
            setApplying(null)
        }
    }

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-'
        return new Date(dateStr).toLocaleString()
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Cpu className="w-8 h-8" />
                        Kernel Management
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        View current version and apply updates
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={loadKernelInfo} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleUpload}
                        accept=".zip"
                        className="hidden"
                    />
                    <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                        <UploadCloud className="w-4 h-4 mr-2" />
                        {uploading ? 'Uploading...' : 'Upload Kernel'}
                    </Button>
                </div>
            </div>

            {/* Current Version Card */}
            <Card className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-blue-500/30">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-blue-500/20">
                            <Cpu className="w-6 h-6 text-blue-400" />
                        </div>
                        Current Version
                    </CardTitle>
                    <CardDescription>
                        The currently running kernel version on this instance
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4">
                        <Badge variant="outline" className="text-2xl px-4 py-2 bg-blue-500/10 border-blue-500/50 text-blue-300">
                            v{currentVersion}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                            Tell your administrator this version when requesting updates
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Update History */}
            <Card>
                <CardHeader>
                    <CardTitle>Update History</CardTitle>
                    <CardDescription>
                        All staged and applied kernel updates with changelogs
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {updates.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No kernel updates recorded yet.</p>
                            <p className="text-sm">Upload a .kernel.zip to get started.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {updates.map((update) => (
                                <div
                                    key={update.id}
                                    className={`p-4 rounded-lg border ${update.is_applied
                                        ? 'bg-green-500/5 border-green-500/30'
                                        : 'bg-yellow-500/5 border-yellow-500/30'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge variant={update.is_applied ? "default" : "secondary"}>
                                                    v{update.version}
                                                </Badge>
                                                {update.is_applied ? (
                                                    <span className="flex items-center gap-1 text-green-500 text-sm">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                        Applied
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-yellow-500 text-sm">
                                                        <Clock className="w-4 h-4" />
                                                        Staged
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm text-muted-foreground mb-2">
                                                {update.is_applied
                                                    ? `Applied: ${formatDate(update.applied_at)}`
                                                    : `Staged: ${formatDate(update.created_at)}`
                                                }
                                            </div>
                                            {update.changelog && (
                                                <div className="mt-2 p-3 bg-background/50 rounded border">
                                                    <div className="text-xs font-medium text-muted-foreground mb-1">Changelog:</div>
                                                    <div className="text-sm whitespace-pre-wrap">{update.changelog}</div>
                                                </div>
                                            )}
                                        </div>
                                        {!update.is_applied && (
                                            <Button
                                                onClick={() => handleApply(update.id)}
                                                disabled={applying === update.id}
                                                className="ml-4"
                                            >
                                                {applying === update.id ? 'Applying...' : 'Apply Update'}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
