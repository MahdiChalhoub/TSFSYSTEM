'use client'

import { useState, useEffect } from 'react'
import { createFiscalYear } from '@/app/actions/finance/fiscal-year'
import { toast } from 'sonner'

export default function FiscalYearWizard({ lastCreatedYear }: { lastCreatedYear?: Record<string, any> }) {
 const [isOpen, setIsOpen] = useState(false)
 const [isPending, setIsPending] = useState(false)

 // Defaults
 const currentYear = new Date().getFullYear()
 const [formData, setFormData] = useState({
 name: `FY ${currentYear}`,
 startDate: `${currentYear}-01-01`,
 endDate: `${currentYear}-12-31`,
 frequency: 'MONTHLY',
 defaultPeriodStatus: 'OPEN',
 includeAuditPeriod: true
 })

 // Auto-Fill Logic using prop from Server Component
 useEffect(() => {
 if (isOpen && lastCreatedYear) {
 const last = lastCreatedYear
 const lastEnd = new Date(last.endDate)
 // Suggest Start = Last End + 1 Day
 const nextStart = new Date(lastEnd)
 nextStart.setDate(nextStart.getDate() + 1)

 const nextStartStr = nextStart.toISOString().split('T')[0]
 const nextYearNum = nextStart.getFullYear()

 setFormData(prev => ({
 ...prev,
 name: `FY ${nextYearNum}`,
 startDate: nextStartStr
 }))
 }
 }, [isOpen, lastCreatedYear])

 // Calculate End Date
 useEffect(() => {
 if (formData.startDate) {
 const start = new Date(formData.startDate)
 if (isNaN(start.getTime())) return

 const end = new Date(start)
 // Default: 1 Year Duration for both Monthly and Quarterly
 end.setFullYear(end.getFullYear() + 1)
 end.setDate(end.getDate() - 1)

 setFormData(prev => ({
 ...prev,
 endDate: end.toISOString().split('T')[0]
 }))
 }
 }, [formData.startDate, formData.frequency])

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault()
 setIsPending(true)
 try {
 await createFiscalYear({
 name: formData.name,
 startDate: new Date(formData.startDate),
 endDate: new Date(formData.endDate),
 frequency: formData.frequency as any,
 defaultPeriodStatus: formData.defaultPeriodStatus as any,
 includeAuditPeriod: formData.includeAuditPeriod
 })
 setIsOpen(false)
 } catch (err: unknown) {
 toast.error((err instanceof Error ? err.message : String(err)))
 } finally {
 setIsPending(false)
 }
 }

 if (!isOpen) {
 return (
 <button
 onClick={() => setIsOpen(true)}
 className="bg-black text-white px-4 py-2 rounded-md hover:bg-stone-800 transition-all flex items-center gap-2"
 >
 <span>+ Create Fiscal Year</span>
 </button>
 )
 }

 return (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-app-surface rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
 <div className="p-6 border-b border-app-border flex justify-between items-center bg-app-bg">
 <div>
 <h2 className="text-xl font-bold text-app-text">Fiscal Year Setup</h2>
 <p className="text-sm text-app-text-muted">Configure your financial periods</p>
 </div>
 <button
 onClick={() => setIsOpen(false)}
 className="text-app-text-faint hover:text-app-text-muted font-bold text-xl"
 >
 ├ù
 </button>
 </div>

 <form onSubmit={handleSubmit} className="p-6 space-y-5">

 {/* 1. Identity */}
 <div>
 <label className="block text-xs font-bold uppercase text-app-text-muted mb-1">Year Name</label>
 <input
 value={formData.name}
 onChange={e => setFormData({ ...formData, name: e.target.value })}
 className="w-full border border-app-border rounded-md p-2 font-medium"
 required
 />
 </div>

 {/* 2. Timeline */}
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-bold uppercase text-app-text-muted mb-1">Start Date</label>
 <input
 type="date"
 value={formData.startDate}
 onChange={e => setFormData({ ...formData, startDate: e.target.value })}
 className="w-full border border-app-border rounded-md p-2"
 required
 />
 </div>
 <div>
 <label className="block text-xs font-bold uppercase text-app-text-muted mb-1">End Date</label>
 <input
 type="date"
 value={formData.endDate}
 onChange={e => setFormData({ ...formData, endDate: e.target.value })}
 className="w-full border border-app-border rounded-md p-2"
 required
 />
 </div>
 </div>

 <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
 <h3 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
 <span>📅 Period Strategy</span>
 </h3>

 <div className="space-y-4">
 {/* 3. Frequency */}
 <div>
 <label className="block text-xs font-semibold text-blue-800 mb-1">Frequency</label>
 <div className="flex gap-4">
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="radio"
 name="freq"
 checked={formData.frequency === 'MONTHLY'}
 onChange={() => setFormData({ ...formData, frequency: 'MONTHLY' })}
 className="text-black focus:ring-black"
 />
 <span className="text-sm">Monthly (12)</span>
 </label>
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="radio"
 name="freq"
 checked={formData.frequency === 'QUARTERLY'}
 onChange={() => setFormData({ ...formData, frequency: 'QUARTERLY' })}
 className="text-black focus:ring-black"
 />
 <span className="text-sm">Quarterly (4)</span>
 </label>
 </div>
 </div>

 {/* 4. Default Status */}
 <div>
 <label className="block text-xs font-semibold text-blue-800 mb-1">Initial Status</label>
 <select
 value={formData.defaultPeriodStatus}
 onChange={e => setFormData({ ...formData, defaultPeriodStatus: e.target.value })}
 className="w-full border border-blue-200 rounded p-2 text-sm"
 >
 <option value="OPEN">OPEN (Active immediately)</option>
 <option value="FUTURE">FUTURE (Locked until needed)</option>
 </select>

 <label className="flex items-center gap-2 cursor-pointer mt-4">
 <input
 type="checkbox"
 checked={formData.includeAuditPeriod}
 onChange={e => setFormData({ ...formData, includeAuditPeriod: e.target.checked })}
 className="rounded text-black focus:ring-black"
 />
 <span className="text-sm font-semibold text-blue-900 text-xs">Include Audit Adjustment Period (13th Month)</span>
 </label>

 <p className="text-[10px] text-blue-600 mt-1">
 "Future" prevents accidentally posting to later periods.
 </p>
 </div>
 </div>
 </div>

 {/* Actions */}
 <div className="pt-2 flex gap-3">
 <button
 type="button"
 onClick={() => setIsOpen(false)}
 className="flex-1 bg-app-surface-2 text-stone-700 py-3 rounded-lg font-medium hover:bg-stone-200"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={isPending}
 className="flex-1 bg-black text-white py-3 rounded-lg font-medium hover:bg-stone-800 disabled:opacity-50"
 >
 {isPending ? 'Generating...' : 'Generate Periods'}
 </button>
 </div>
 </form>
 </div>
 </div>
 )
}