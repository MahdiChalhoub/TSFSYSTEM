"use client"

import { ReactNode } from "react"
import { TrendingUp, TrendingDown } from "lucide-react"

interface KPICardProps {
 label: string
 value: string | number
 icon: ReactNode
 /** Optional percentage change badge (positive = green, negative = red) */
 change?: number
 /** Optional subtitle text shown below the value */
 footnote?: string
 /** Optional footnote icon */
 footnoteIcon?: ReactNode
 /** Color variant for the icon background */
 variant?: 'emerald' | 'amber' | 'rose' | 'slate' | 'indigo'
 /** Dark card variant (inverted colors) */
 dark?: boolean
}

const VARIANT_STYLES = {
 emerald: { iconBg: 'bg-app-primary-light', iconColor: 'text-app-primary', shadow: 'shadow-emerald-100' },
 amber: { iconBg: 'bg-app-warning-bg', iconColor: 'text-app-warning', shadow: 'shadow-amber-100' },
 rose: { iconBg: 'bg-rose-50', iconColor: 'text-rose-600', shadow: 'shadow-rose-100' },
 slate: { iconBg: 'bg-app-bg', iconColor: 'text-app-muted-foreground', shadow: 'shadow-slate-100' },
 indigo: { iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', shadow: 'shadow-indigo-100' },
}

export default function KPICard({
 label,
 value,
 icon,
 change,
 footnote,
 footnoteIcon,
 variant = 'emerald',
 dark = false,
}: KPICardProps) {
 const styles = VARIANT_STYLES[variant]

 if (dark) {
 return (
 <div className="rounded-2xl bg-app-surface border-0 shadow-lg overflow-hidden group hover:shadow-xl transition-all duration-300 relative">
 <div className="absolute top-0 right-0 w-24 h-24 bg-app-primary/10 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-app-primary/20 transition-colors" />
 <div className="p-5 relative">
 <div className="flex justify-between items-start mb-4">
 <div className="w-11 h-11 rounded-xl bg-app-foreground/10 text-app-foreground flex items-center justify-center backdrop-blur-md">
 {icon}
 </div>
 {change !== undefined && change !== 0 && (
 <span className={`badge-status ${change > 0 ? 'text-app-success bg-app-primary/10 border-app-primary/20' : 'text-rose-300 bg-rose-500/10 border-rose-500/20'}`}>
 {change > 0 ? <TrendingUp size={10} className="mr-1 inline" /> : <TrendingDown size={10} className="mr-1 inline" />}
 {change > 0 ? '+' : ''}{change}%
 </span>
 )}
 </div>
 <p className="label-micro text-app-muted-foreground">{label}</p>
 <h2 className="text-3xl font-black text-app-foreground tracking-tighter mt-1">{value}</h2>
 {footnote && (
 <div className="mt-4 pt-3 border-t border-app-foreground/5 flex items-center gap-2 label-micro text-app-muted-foreground">
 {footnoteIcon} {footnote}
 </div>
 )}
 </div>
 </div>
 )
 }

 return (
 <div className="card-kpi group hover:shadow-lg transition-all duration-300 overflow-hidden relative">
 <div className="flex justify-between items-start mb-4">
 <div className={`w-11 h-11 rounded-xl ${styles.iconBg} ${styles.iconColor} flex items-center justify-center shadow-inner ${styles.shadow}`}>
 {icon}
 </div>
 {change !== undefined && change !== 0 && (
 <span className={`badge-status ${change > 0 ? 'badge-emerald' : 'badge-rose'}`}>
 {change > 0 ? <TrendingUp size={10} className="mr-1 inline" /> : <TrendingDown size={10} className="mr-1 inline" />}
 {change > 0 ? '+' : ''}{change}%
 </span>
 )}
 </div>
 <p className="label-micro">{label}</p>
 <h2 className="value-large mt-1">{value}</h2>
 {footnote && (
 <div className="mt-4 pt-3 border-t border-app-border flex items-center gap-2 label-micro">
 {footnoteIcon} {footnote}
 </div>
 )}
 </div>
 )
}
