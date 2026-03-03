// @ts-nocheck
'use client'
import { useState, useTransition } from 'react'
import type { FiscalPeriod } from '@/types/erp'
import { deleteFiscalYear, updatePeriodStatus, closeFiscalYear, hardLockFiscalYear, transferBalancesToNextYear } from '@/app/actions/finance/fiscal-year'
import { Trash2, Lock, Edit2, PlayCircle, Clock, ShieldCheck, Forward } from 'lucide-react'
import PeriodEditor from './period-editor'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
export default function FiscalYearCard({ year, nextYear }: { year: Record<string, any>, nextYear?: Record<string, any> }) {
 const [isPending, startTransition] = useTransition()
 const [editingPeriod, setEditingPeriod] = useState<FiscalPeriod | null>(null)
 const [pendingAction, setPendingAction] = useState<{ type: string; title: string; description: string; variant: 'danger' | 'warning' | 'info' } | null>(null)
 const actionHandlers: Record<string, () => void> = {
 rollForward: () => {
 startTransition(async () => {
 try {
 await transferBalancesToNextYear(year.id, nextYear.id)
 toast.success("Balances transferred successfully!")
 } catch (err: unknown) {
 toast.error((err instanceof Error ? err.message : String(err)))
 }
 })
 },
 delete: () => {
 startTransition(async () => {
 try {
 await deleteFiscalYear(year.id)
 } catch (err: unknown) {
 toast.error((err instanceof Error ? err.message : String(err)))
 }
 })
 },
 close: () => {
 startTransition(async () => {
 await closeFiscalYear(year.id)
 })
 },
 hardLock: () => {
 startTransition(async () => {
 await hardLockFiscalYear(year.id)
 })
 },
 }
 const handleRollForward = () => {
 if (!nextYear) return
 setPendingAction({
 type: 'rollForward',
 title: 'Transfer Balances?',
 description: `This will calculate all Asset, Liability, and Equity balances for ${year.name} and create an Opening Entry in ${nextYear.name}.`,
 variant: 'warning',
 })
 }
 const handleDelete = () => {
 setPendingAction({
 type: 'delete',
 title: 'Delete Fiscal Year?',
 description: 'This will permanently remove this fiscal year. A safety check will be performed.',
 variant: 'danger',
 })
 }
 const handleCloseYear = () => {
 setPendingAction({
 type: 'close',
 title: 'Close Fiscal Year?',
 description: 'This acts as a Soft Close. You can still reopen periods if needed.',
 variant: 'warning',
 })
 }
 const handleHardLock = () => {
 setPendingAction({
 type: 'hardLock',
 title: 'Hard Lock Fiscal Year?',
 description: 'CRITICAL: Hard Locking is permanent and ensures compliance. You will NOT be able to reopen periods.',
 variant: 'danger',
 })
 }
 const handleConfirmAction = () => {
 if (pendingAction) {
 actionHandlers[pendingAction.type]?.()
 setPendingAction(null)
 }
 }
 const handleChangeStatus = (periodId: number, status: 'OPEN' | 'CLOSED' | 'FUTURE') => {
 startTransition(async () => {
 try {
 await updatePeriodStatus(periodId, status)
 } catch (err: unknown) {
 toast.error((err instanceof Error ? err.message : String(err)))
 }
 })
 }
 return (
 <div className={`
 bg-app-surface border rounded-lg p-5 shadow-sm transition-all hover:shadow-md
 ${year.isHardLocked ? 'border-app-error bg-app-surface/50' : 'border-app-border'}
 `}>
 <div className="flex justify-between items-start mb-6 border-b border-app-border pb-4">
 <div className="flex items-center gap-4">
 <div>
 <h3 className="text-xl font-bold text-app-foreground flex items-center gap-3">
 {year.name}
 <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${year.status === 'OPEN' ? 'bg-app-success-bg text-app-success' :
 year.isHardLocked ? 'bg-app-error text-app-foreground' : 'bg-app-surface-2 text-app-muted-foreground'
 }`}>
 {year.isHardLocked ? 'FINALIZED' : year.status}
 </span>
 </h3>
 <p className="text-sm text-app-muted-foreground mt-1 font-medium">
 {year.startDate ? new Date(year.startDate).toLocaleDateString() : '—'} — {year.endDate ? new Date(year.endDate).toLocaleDateString() : '—'}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 {year.status === 'OPEN' && (
 <button
 onClick={handleCloseYear}
 disabled={isPending}
 className="text-app-muted-foreground hover:text-orange-600 px-3 py-1 text-xs font-bold uppercase tracking-wider border border-app-border rounded hover:bg-orange-50 transition-colors"
 >
 Soft Close
 </button>
 )}
 {year.status === 'CLOSED' && nextYear && (
 <button
 onClick={handleRollForward}
 disabled={isPending}
 className="text-app-muted-foreground hover:text-app-info px-3 py-1 text-xs font-bold uppercase tracking-wider border border-app-border rounded hover:bg-app-info-bg transition-colors flex items-center gap-1"
 >
 <Forward size={14} /> Roll Forward
 </button>
 )}
 {year.status === 'CLOSED' && !year.isHardLocked && (
 <button
 onClick={handleHardLock}
 disabled={isPending}
 className="text-app-error hover:text-app-error px-3 py-1 text-xs font-bold uppercase tracking-wider border border-app-error rounded hover:bg-app-error-bg transition-colors flex items-center gap-1"
 >
 <Lock size={12} /> Hard Lock
 </button>
 )}
 {year.isHardLocked && (
 <div className="bg-app-error-bg text-app-error px-3 py-1 text-[10px] font-extrabold uppercase rounded flex items-center gap-1 border border-app-error">
 <ShieldCheck size={12} /> IMMUTABLE
 </div>
 )}
 <button
 onClick={handleDelete}
 disabled={isPending || year.isHardLocked}
 className={`p-2 rounded-full transition-colors ${year.isHardLocked ? 'text-app-muted-foreground' : 'text-app-muted-foreground hover:text-app-error hover:bg-app-error-bg'}`}
 title="Delete Year"
 >
 <Trash2 size={18} />
 </button>
 </div>
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3">
 {[...(year.periods || [])].sort((a: Record<string, any>, b: Record<string, any>) => (a.start_date || '').localeCompare(b.start_date || '')).map((p: Record<string, any>, idx: number) => {
 const periodStatus = p.status || (p.is_closed ? 'CLOSED' : 'OPEN')
 const periodLabel = p.name || `P${String(idx + 1).padStart(2, '0')}`
 return (
 <div
 key={p.id}
 className={`
 relative group p-3 rounded-lg border text-center transition-all
 ${periodStatus === 'OPEN' ? 'bg-app-surface border-app-success shadow-sm' : ''}
 ${periodStatus === 'CLOSED' ? 'bg-app-background border-app-border opacity-75' : ''}
 ${periodStatus === 'FUTURE' ? 'bg-app-info-bg border-app-info/30' : ''}
 `}
 >
 <div className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-50">
 {periodLabel}
 </div>
 <div className="font-semibold text-xs truncate">
 {p.start_date ? new Date(p.start_date).toLocaleDateString('en', { month: 'short' }) : ''}
 </div>
 <div className="flex justify-center items-center gap-1 mt-2">
 <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${periodStatus === 'OPEN' ? 'bg-app-success-bg text-app-success' :
 periodStatus === 'CLOSED' ? 'bg-app-border text-app-muted-foreground' :
 'bg-app-info-bg text-app-info'
 }`}>
 {periodStatus}
 </span>
 </div>
 {/* Hover Actions */}
 {!year.isHardLocked && (
 <div className="absolute inset-0 bg-app-foreground/95 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 rounded-lg z-10 p-2 text-app-muted-foreground">
 <div className="flex gap-2">
 <button
 onClick={() => handleChangeStatus(p.id, 'OPEN')}
 className={`p-1.5 rounded hover:bg-app-success-bg hover:text-app-success ${periodStatus === 'OPEN' ? 'bg-app-success-bg text-app-success' : ''}`}
 title="Open"
 >
 <PlayCircle size={14} />
 </button>
 <button
 onClick={() => handleChangeStatus(p.id, 'CLOSED')}
 className={`p-1.5 rounded hover:bg-app-border hover:text-app-foreground ${periodStatus === 'CLOSED' ? 'bg-app-border text-app-foreground' : ''}`}
 title="Close"
 >
 <Lock size={14} />
 </button>
 <button
 onClick={() => handleChangeStatus(p.id, 'FUTURE')}
 className={`p-1.5 rounded hover:bg-app-info-bg hover:text-app-info ${periodStatus === 'FUTURE' ? 'bg-app-info-bg text-app-info' : ''}`}
 title="Future"
 >
 <Clock size={14} />
 </button>
 </div>
 <button
 onClick={() => setEditingPeriod(p)}
 className="text-[9px] font-bold uppercase hover:underline mt-1"
 >
 Edit
 </button>
 </div>
 )}
 </div>
 )
 })}
 </div>
 {editingPeriod && (
 <PeriodEditor period={editingPeriod} onClose={() => setEditingPeriod(null)} />
 )}
 <ConfirmDialog
 open={pendingAction !== null}
 onOpenChange={(open) => { if (!open) setPendingAction(null) }}
 onConfirm={handleConfirmAction}
 title={pendingAction?.title ?? ''}
 description={pendingAction?.description ?? ''}
 confirmText="Confirm"
 variant={pendingAction?.variant ?? 'danger'}
 />
 </div>
 )
}