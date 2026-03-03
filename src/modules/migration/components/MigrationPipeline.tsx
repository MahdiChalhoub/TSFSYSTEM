"use client"
import React, { useState, useEffect, useCallback } from "react"
import { Progress } from "@/components/ui/progress"
import { Loader2, CheckCircle2, AlertTriangle, FileUp, Database, Search, HelpCircle, Play } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getMigrationPipeline, resumeMigration } from "../actions"
import { PipelineData } from "./types"

export function MigrationPipeline({ jobId, jobStatus, onResume }: {
    jobId: number
    jobStatus: string
    onResume?: () => void
}) {
    const [pipeline, setPipeline] = useState<PipelineData | null>(null)
    const [loading, setLoading] = useState(true)
    const [resuming, setResuming] = useState(false)
    const [pipelineError, setPipelineError] = useState<string | null>(null)

    const fetchPipeline = useCallback(async () => {
        try {
            const data = await getMigrationPipeline(jobId)
            if (data && Array.isArray(data.pipeline) && data.pipeline.length > 0) {
                setPipeline(data)
                setPipelineError(null)
            } else if (data?.error) {
                setPipelineError(data.error)
            } else {
                // Pipeline may not exist yet for PENDING jobs — silent, retry via interval
                setPipelineError(null)
            }
        } catch (e: any) {
            setPipelineError(e?.message || 'Server error')
        }
        setLoading(false)
    }, [jobId])

    useEffect(() => {
        fetchPipeline()
        // Auto-refresh when running or parsing
        if (jobStatus === 'RUNNING' || jobStatus === 'PARSING' || jobStatus === 'PENDING') {
            const interval = setInterval(fetchPipeline, 5000)
            return () => clearInterval(interval)
        }
    }, [fetchPipeline, jobStatus])

    const handleResume = async () => {
        setResuming(true)
        try {
            await resumeMigration(jobId)
            onResume?.()
        } catch { /* ignore */ }
        setResuming(false)
    }

    if (loading) return (
        <Card className="bg-app-surface border-app-border backdrop-blur-xl">
            <CardContent className="py-4 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                <span className="text-app-text-faint font-bold text-xs">Loading pipeline...</span>
            </CardContent>
        </Card>
    )

    // No pipeline yet (job hasn't started) — show a subtle placeholder, not an error
    if (!pipeline || !pipeline.pipeline?.length) {
        if (jobStatus === 'PENDING') return (
            <Card className="bg-app-surface border-app-border">
                <CardContent className="py-4 flex items-center justify-center gap-2">
                    <Play className="w-4 h-4 text-gray-300" />
                    <span className="text-gray-300 font-medium text-xs">Start the migration to track progress</span>
                </CardContent>
            </Card>
        )
        // For non-PENDING states with no data, show a subtle retry indicator
        return (
            <Card className="bg-app-surface border-app-border">
                <CardContent className="py-3 flex items-center justify-between gap-2 px-5">
                    <div className="flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 text-gray-300 animate-spin" />
                        <span className="text-gray-300 font-medium text-xs">Waiting for pipeline data...</span>
                    </div>
                    <button onClick={fetchPipeline} className="text-[10px] text-app-text-faint hover:text-app-text-muted font-bold uppercase tracking-wider">
                        Retry
                    </button>
                </CardContent>
            </Card>
        )
    }

    const completedCount = pipeline.pipeline.filter(s => s.status === 'completed').length
    const totalSteps = pipeline.pipeline.length
    const pipelinePct = Math.round((completedCount / totalSteps) * 100)

    return (
        <Card className="bg-app-surface border-app-border shadow-sm overflow-hidden">
            <CardHeader className="pb-2 bg-app-bg border-b border-app-border">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-bold uppercase tracking-widest text-app-text-faint flex items-center gap-2">
                        <Database className="w-3.5 h-3.5" />
                        Import Pipeline — {completedCount}/{totalSteps} steps
                    </CardTitle>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${completedCount === totalSteps
                        ? 'bg-emerald-100 text-emerald-700'
                        : jobStatus === 'FAILED' || jobStatus === 'STALLED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                        {completedCount === totalSteps ? '✓ All Done' :
                            jobStatus === 'RUNNING' ? `${pipelinePct}%` :
                                jobStatus === 'FAILED' ? 'Crashed' :
                                    jobStatus === 'STALLED' ? 'Stalled' : `${pipelinePct}%`}
                    </span>
                </div>
                {/* Pipeline progress bar */}
                <div className="w-full bg-app-border rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-700 ${completedCount === totalSteps ? 'bg-emerald-500'
                            : jobStatus === 'FAILED' || jobStatus === 'STALLED' ? 'bg-red-500'
                                : 'bg-gradient-to-r from-blue-500 to-purple-500'
                            }`}
                        style={{ width: `${pipelinePct}%` }}
                    />
                </div>
            </CardHeader>
            <CardContent className="pt-3 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                    {pipeline.pipeline.map((step, i) => (
                        <div key={step.name} className={`flex items-center gap-2.5 py-1.5 px-2 rounded-lg transition-all ${step.status === 'running' ? 'bg-blue-50' : ''
                            }`}>
                            {/* Step indicator */}
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${step.status === 'completed' ? 'bg-emerald-100'
                                : step.status === 'running' ? 'bg-blue-200 animate-pulse border border-blue-300'
                                    : 'bg-app-surface-2'
                                }`}>
                                {step.status === 'completed' ? (
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                ) : step.status === 'running' ? (
                                    <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
                                ) : (
                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                )}
                            </div>
                            {/* Step label + sub-progress */}
                            <div className="flex flex-col min-w-0">
                                <span className={`text-[11px] font-bold truncate ${step.status === 'completed' ? 'text-app-text-faint'
                                    : step.status === 'running' ? 'text-blue-700 font-black'
                                        : 'text-gray-300'
                                    }`}>
                                    {step.label.replace('Importing ', '').replace('Linking ', '')}
                                </span>
                                {step.status === 'running' && pipeline.current_step_detail && (
                                    <span className="text-[9px] text-app-text-faint font-mono truncate">
                                        {pipeline.current_step_detail}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Resume button for failed/stalled */}
                {pipeline.can_resume && (
                    <div className="mt-4 pt-4 border-t border-app-border flex items-center gap-4">
                        <div className="flex-1">
                            <p className="text-amber-600 text-xs font-black uppercase tracking-wider">
                                Import stopped at step {completedCount + 1}/{totalSteps}
                            </p>
                            <p className="text-app-text-faint text-[10px] mt-0.5 font-bold">
                                {completedCount} steps completed. You can resume from where it stopped.
                            </p>
                        </div>
                        <Button
                            size="sm"
                            onClick={handleResume}
                            disabled={resuming}
                            className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold gap-1.5"
                        >
                            {resuming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                            Resume Import
                        </Button>
                    </div>
                )}

                {/* All OK Message */}
                {completedCount === totalSteps && jobStatus === 'COMPLETED' && (
                    <div className="mt-6 pt-4 border-t border-emerald-100 flex items-center gap-3 justify-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <span className="text-emerald-700 font-black text-sm uppercase tracking-tight">
                            All {totalSteps} steps completed successfully!
                        </span>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
