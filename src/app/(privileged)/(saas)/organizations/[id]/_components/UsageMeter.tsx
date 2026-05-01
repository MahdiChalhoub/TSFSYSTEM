'use client'

import { AlertTriangle } from 'lucide-react'

export function UsageMeter({ label, icon: Icon, current, limit, percent, unit = '' }: {
 label: string; icon: React.ElementType; current?: number; limit?: number; percent?: number; unit?: string
}) {
 const safeCurrent = current ?? 0
 const safeLimit = limit ?? 0
 const safePercent = percent ?? 0
 const isWarning = safePercent >= 80
 const isDanger = safePercent >= 95
 const barColor = isDanger ? 'bg-app-error' : isWarning ? 'bg-app-warning' : 'bg-app-primary'
 const bgColor = isDanger ? 'bg-app-error-bg border-app-error/30' : isWarning ? 'bg-app-warning-bg border-app-warning/30' : 'bg-app-surface border-app-border'
 return (
 <div className={`p-5 rounded-2xl border transition-all ${bgColor}`}>
 <div className="app-page flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <Icon size={16} className={isDanger ? 'text-app-error' : isWarning ? 'text-app-warning' : 'text-app-muted-foreground'} />
 <span className="text-xs font-bold uppercase tracking-wider text-app-muted-foreground">{label}</span>
 </div>
 <span className="text-sm font-black text-app-foreground">
 {safeCurrent}{unit} <span className="text-app-muted-foreground font-medium">/ {safeLimit}{unit}</span>
 </span>
 </div>
 <div className="h-2 bg-app-surface-2 rounded-full overflow-hidden">
 <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(safePercent, 100)}%` }} />
 </div>
 {isDanger && (
 <p className="text-[10px] text-app-error font-bold mt-2 flex items-center gap-1">
 <AlertTriangle size={10} /> Approaching limit — consider upgrading
 </p>
 )}
 </div>
 )
}
