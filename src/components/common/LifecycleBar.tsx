'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    CheckCircle2,
    Circle,
    Lock,
    RotateCcw,
    Send,
    ShieldCheck,
    XCircle,
    Clock,
    User
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type LifecycleStatus =
    | 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'APPROVED'
    | 'POSTED' | 'LOCKED' | 'REJECTED' | 'CANCELLED' | 'REVERSED'

export interface ApprovalEntry {
    level: number
    action: string
    actor_name: string
    created_at: string
    note?: string
}

interface LifecycleBarProps {
    status: LifecycleStatus
    approvals?: ApprovalEntry[]
    onAction: (action: string, params?: Record<string, any>) => Promise<void>
    canAction: (action: string, level?: number) => boolean
    isLoading?: boolean
}

const STATUS_CONFIG: Record<LifecycleStatus, { label: string; color: string; icon: any }> = {
    DRAFT: { label: 'Draft', color: 'bg-muted text-muted-foreground', icon: Circle },
    SUBMITTED: { label: 'Submitted', color: 'bg-app-info/10 text-app-info border-app-info/20', icon: Send },
    VERIFIED: { label: 'Verified', color: 'bg-app-info/10 text-app-info border-app-info/20', icon: ShieldCheck },
    APPROVED: { label: 'Approved', color: 'bg-app-success/10 text-app-success border-app-success/20', icon: CheckCircle2 },
    POSTED: { label: 'Posted', color: 'bg-violet-500 text-white', icon: Lock },
    LOCKED: { label: 'Locked', color: 'bg-slate-900 text-white', icon: Lock },
    REJECTED: { label: 'Rejected', color: 'bg-app-error/10 text-app-error border-app-error/20', icon: XCircle },
    CANCELLED: { label: 'Cancelled', color: 'bg-gray-500/10 text-app-muted-foreground border-gray-500/20', icon: XCircle },
    REVERSED: { label: 'Reversed', color: 'bg-app-warning/10 text-app-warning border-app-warning/20', icon: RotateCcw },
}

const STEPS: LifecycleStatus[] = ['DRAFT', 'SUBMITTED', 'VERIFIED', 'APPROVED', 'POSTED']

export function LifecycleBar({ status, approvals = [], onAction, canAction, isLoading }: LifecycleBarProps) {
    const currentConfig = STATUS_CONFIG[status]
    const StatusIcon = currentConfig.icon

    return (
        <div className="flex flex-col gap-4 w-full p-4 rounded-xl border bg-card/50 backdrop-blur-md shadow-sm">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", currentConfig.color)}>
                        <StatusIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="uppercase opacity-60">Document Status</h3>
                        <Badge variant="outline" className={cn("mt-1 font-bold", currentConfig.color)}>
                            {currentConfig.label}
                        </Badge>
                    </div>
                </div>

                <div className="flex gap-2">
                    {status === 'DRAFT' && canAction('submit') && (
                        <Button size="sm" onClick={() => onAction('submit')} disabled={isLoading}>
                            <Send className="w-4 h-4 mr-2" /> Submit
                        </Button>
                    )}

                    {status === 'SUBMITTED' && canAction('verify', 1) && (
                        <Button size="sm" variant="outline" onClick={() => onAction('verify', { level: 1 })} disabled={isLoading}>
                            <ShieldCheck className="w-4 h-4 mr-2" /> Verify L1
                        </Button>
                    )}

                    {status === 'VERIFIED' && canAction('approve', 2) && (
                        <Button size="sm" className="bg-app-success hover:bg-app-success" onClick={() => onAction('approve', { level: 2 })} disabled={isLoading}>
                            <CheckCircle2 className="w-4 h-4 mr-2" /> Approve L2
                        </Button>
                    )}

                    {status === 'APPROVED' && canAction('post') && (
                        <Button size="sm" className="bg-violet-600 hover:bg-violet-700" onClick={() => onAction('post')} disabled={isLoading}>
                            <Lock className="w-4 h-4 mr-2" /> Post Transaction
                        </Button>
                    )}

                    {status === 'POSTED' && (
                        <>
                            {canAction('lock') && (
                                <Button size="sm" variant="secondary" onClick={() => onAction('lock')} disabled={isLoading}>
                                    <Lock className="w-4 h-4 mr-2" /> Lock
                                </Button>
                            )}
                            {canAction('reverse') && (
                                <Button size="sm" variant="destructive" onClick={() => onAction('reverse')} disabled={isLoading}>
                                    <RotateCcw className="w-4 h-4 mr-2" /> Reverse
                                </Button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Stepper */}
            <div className="flex items-center w-full px-2 py-4">
                {STEPS.map((step, idx) => {
                    const isCompleted = STEPS.indexOf(status) >= idx || status === 'LOCKED' || status === 'REVERSED'
                    const isActive = status === step
                    const StepIcon = STATUS_CONFIG[step].icon

                    return (
                        <React.Fragment key={step}>
                            <div className="flex flex-col items-center relative z-10">
                                <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                                    isCompleted ? "bg-primary border-primary text-primary-foreground" : "bg-background border-muted text-muted-foreground",
                                    isActive && "ring-4 ring-primary/20 scale-110"
                                )}>
                                    <StepIcon className="w-5 h-5" />
                                </div>
                                <span className={cn(
                                    "text-[10px] font-bold mt-2 uppercase tracking-tighter",
                                    isCompleted ? "text-primary" : "text-muted-foreground"
                                )}>
                                    {STATUS_CONFIG[step].label}
                                </span>
                            </div>
                            {idx < STEPS.length - 1 && (
                                <div className={cn(
                                    "flex-1 h-0.5 mx-2 bg-muted transition-all duration-500",
                                    isCompleted && idx < STEPS.indexOf(status) && "bg-primary"
                                )} />
                            )}
                        </React.Fragment>
                    )
                })}
            </div>

            {/* Audit Log (mini) */}
            {approvals.length > 0 && (
                <div className="mt-2 pt-4 border-t border-dashed">
                    <h4 className="text-[10px] font-bold uppercase opacity-40 mb-3 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Approval Trail
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {approvals.map((app, i) => (
                            <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 text-xs">
                                <User className="w-4 h-4 mt-0.5 opacity-50" />
                                <div className="flex flex-col">
                                    <span className="font-semibold">{app.actor_name}</span>
                                    <span className="opacity-60 text-[10px]">
                                        {app.action} (L{app.level}) • {new Date(app.created_at).toLocaleString()}
                                    </span>
                                    {app.note && <span className="italic mt-1 text-[10px] opacity-70">"{app.note}"</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
