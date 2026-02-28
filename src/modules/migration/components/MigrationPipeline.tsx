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
            if (data && data.pipeline) {
                setPipeline(data)
                setPipelineError(null)
            } else {
                setPipelineError('No pipeline data')
            }
        } catch (e: any) {
            console.error('Pipeline fetch error:', e)
            setPipelineError(e?.message || 'Server error')
        }
        setLoading(false)
    }, [jobId])

    useEffect(() => {
        fetchPipeline()
        // Auto-refresh when running
        if (jobStatus === 'RUNNING' || jobStatus === 'PARSING') {
            const interval = setInterval(fetchPipeline, 4000)
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
        <Card className="bg-white border-slate-200 backdrop-blur-xl">
            <CardContent className="py-4 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                <span className="text-gray-400 font-bold text-xs">Loading pipeline...</span>
            </CardContent>
        </Card>
    )

    if (!pipeline || !pipeline.pipeline?.length) return (
        <Card className="bg-white border-slate-200 backdrop-blur-xl">
            <CardContent className="py-4 flex items-center justify-center gap-2">
                <Database className="w-4 h-4 text-gray-200" />
                <span className="text-gray-400 font-medium text-xs">
                    Pipeline data unavailable{pipelineError ? ` (${pipelineError})` : ''}
                </span>
            </CardContent>
        </Card>
    )

    const completedCount = pipeline.pipeline.filter(s => s.status === 'completed').length
    const totalSteps = pipeline.pipeline.length
    const pipelinePct = Math.round((completedCount / totalSteps) * 100)

    return (
        <Card className="bg-white border-gray-200 shadow-sm overflow-hidden">
            <CardHeader className="pb-2 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
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
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden">
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
                                    : 'bg-gray-100'
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
                                <span className={`text-[11px] font-bold truncate ${step.status === 'completed' ? 'text-gray-400'
                                    : step.status === 'running' ? 'text-blue-700 font-black'
                                        : 'text-gray-300'
                                    }`}>
                                    {step.label.replace('Importing ', '').replace('Linking ', '')}
                                </span>
                                {step.status === 'running' && pipeline.current_step_detail && (
                                    <span className="text-[9px] text-gray-400 font-mono truncate">
                                        {pipeline.current_step_detail}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Resume button for failed/stalled */}
                {pipeline.can_resume && (
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4">
                        <div className="flex-1">
                            <p className="text-amber-600 text-xs font-black uppercase tracking-wider">
                                Import stopped at step {completedCount + 1}/{totalSteps}
                            </p>
                            <p className="text-gray-400 text-[10px] mt-0.5 font-bold">
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
