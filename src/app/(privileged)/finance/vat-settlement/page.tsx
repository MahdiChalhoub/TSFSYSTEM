'use client'

import { useState, useEffect, useCallback } from 'react'
import { calculateVatSettlement, postVatSettlement, getPeriodicTaxAccruals, runPeriodicTaxAccrual } from '@/app/actions/finance/tax-engine'
import { getFinancialAccounts } from '@/app/actions/finance/financial-accounts'
import { useCurrency } from '@/lib/utils/currency'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
 Scale, RefreshCw, CheckCircle, AlertCircle, Send,
 Landmark, TrendingUp, TrendingDown, ReceiptText, Clock
} from 'lucide-react'

export default function VatSettlementPage() {
 const { fmt } = useCurrency()

 const today = new Date()
 const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
 const todayStr = today.toISOString().split('T')[0]

 const [periodStart, setPeriodStart] = useState(firstDay)
 const [periodEnd, setPeriodEnd] = useState(todayStr)
 const [preview, setPreview] = useState<any>(null)
 const [bankAccountId, setBankAccountId] = useState('')
 const [accruals, setAccruals] = useState<any[]>([])
 const [accounts, setAccounts] = useState<any[]>([])
 const [loading, setLoading] = useState(false)
 const [posting, setPosting] = useState(false)
 const [runningAccrual, setRunningAccrual] = useState(false)

 useEffect(() => {
 async function load() {
 try {
 const [accs, acc] = await Promise.all([
 getFinancialAccounts(),
 getPeriodicTaxAccruals(),
 ])
 setAccounts(Array.isArray(accs) ? accs : accs?.results || [])
 setAccruals(Array.isArray(acc) ? acc : acc?.results || [])
 } catch { }
 }
 load()
 }, [])

 const handlePreview = useCallback(async () => {
 if (!periodStart || !periodEnd) return
 setLoading(true)
 setPreview(null)
 try {
 const res = await calculateVatSettlement(
 periodStart + 'T00:00:00',
 periodEnd + 'T23:59:59'
 )
 if (res?.error || res?.detail) throw new Error(res.error || res.detail)
 setPreview(res)
 } catch (e: any) {
 toast.error(e?.message || 'Could not calculate VAT settlement')
 } finally {
 setLoading(false)
 }
 }, [periodStart, periodEnd])

 const handlePost = async () => {
 if (!bankAccountId) { toast.error('Select a bank account first'); return }
 if (!preview) { toast.error('Run preview first'); return }
 setPosting(true)
 try {
 await postVatSettlement({
 period_start: periodStart + 'T00:00:00',
 period_end: periodEnd + 'T23:59:59',
 bank_account_id: bankAccountId,
 })
 toast.success('VAT settlement posted to ledger')
 setPreview(null)
 } catch (e: any) {
 toast.error(e?.message || 'Failed to post settlement')
 } finally {
 setPosting(false)
 }
 }

 const handleRunAccrual = async () => {
 setRunningAccrual(true)
 try {
 const res = await runPeriodicTaxAccrual({
 period_start: periodStart + 'T00:00:00',
 period_end: periodEnd + 'T23:59:59',
 })
 toast.success(`Accrual run: ${res?.accruals?.length ?? 0} entries created`)
 // Refresh accruals list
 const acc = await getPeriodicTaxAccruals()
 setAccruals(Array.isArray(acc) ? acc : acc?.results || [])
 } catch (e: any) {
 toast.error(e?.message || 'Failed to run accrual')
 } finally {
 setRunningAccrual(false)
 }
 }

 const n = (v?: any) => parseFloat(String(v ?? '0')) || 0
 const netDue = n(preview?.net_vat_due)
 const isRefund = netDue < 0

 return (
 <div className="page-container">
 <header>
 <h1 className="page-header-title tracking-tighter text-app-text flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-200">
 <Scale size={28} className="text-white" />
 </div>
 VAT <span className="text-violet-600">Settlement</span>
 </h1>
 <p className="text-sm font-medium text-app-text-faint mt-2 uppercase tracking-widest">
 Calculate · Preview · Post to Ledger
 </p>
 </header>

 {/* Period + Config */}
 <Card className="border-dashed border-2 border-app-border">
 <CardContent className="py-4 flex flex-wrap items-end gap-4">
 <div>
 <label className="text-xs text-app-text-muted uppercase font-semibold mb-1 block">Period Start</label>
 <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="w-40" />
 </div>
 <div>
 <label className="text-xs text-app-text-muted uppercase font-semibold mb-1 block">Period End</label>
 <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="w-40" />
 </div>
 <div className="w-64">
 <label className="text-xs text-app-text-muted uppercase font-semibold mb-1 block">Bank / Settlement Account</label>
 <Select value={bankAccountId} onValueChange={setBankAccountId}>
 <SelectTrigger>
 <SelectValue placeholder="Select account…" />
 </SelectTrigger>
 <SelectContent>
 {accounts.map((a: any) => (
 <SelectItem key={a.id} value={String(a.id)}>
 {a.name} {a.account_number ? `(${a.account_number})` : ''}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <Button onClick={handlePreview} disabled={loading} variant="outline" className="border-violet-300 text-violet-700 hover:bg-violet-50">
 <RefreshCw size={14} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
 {loading ? 'Calculating…' : 'Preview'}
 </Button>
 </CardContent>
 </Card>

 {/* Preview Result */}
 {loading ? (
 <div className="grid grid-cols-3 gap-4">
 {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
 </div>
 ) : preview ? (
 <>
 <div className="grid grid-cols-3 gap-4">
 <Card className="border-l-4 border-emerald-500 bg-gradient-to-r from-emerald-50 to-white">
 <CardContent className="py-4">
 <div className="flex items-center gap-3">
 <TrendingUp size={22} className="text-emerald-500" />
 <div>
 <p className="text-[11px] text-app-text-muted uppercase font-semibold">TVA Collectée</p>
 <p className="text-xl font-black text-emerald-700">{fmt(n(preview.vat_collected))}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="border-l-4 border-blue-500 bg-gradient-to-r from-blue-50 to-white">
 <CardContent className="py-4">
 <div className="flex items-center gap-3">
 <TrendingDown size={22} className="text-blue-500" />
 <div>
 <p className="text-[11px] text-app-text-muted uppercase font-semibold">TVA Récupérable</p>
 <p className="text-xl font-black text-blue-700">{fmt(n(preview.vat_recoverable))}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className={`border-l-4 ${isRefund ? 'border-amber-400 bg-gradient-to-r from-amber-50 to-white' : 'border-rose-500 bg-gradient-to-r from-rose-50 to-white'}`}>
 <CardContent className="py-4">
 <div className="flex items-center gap-3">
 <Scale size={22} className={isRefund ? 'text-amber-500' : 'text-rose-500'} />
 <div>
 <p className="text-[11px] text-app-text-muted uppercase font-semibold">Net Due</p>
 <p className={`text-xl font-black ${isRefund ? 'text-amber-700' : 'text-rose-700'}`}>{fmt(Math.abs(netDue))}</p>
 <p className="text-[10px] text-app-text-faint">{isRefund ? 'Refund ← from state' : 'Payable → to state'}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Post Button */}
 <Card className={`border-2 ${isRefund ? 'border-amber-200 bg-amber-50' : 'border-rose-200 bg-rose-50'}`}>
 <CardContent className="py-5 flex items-center justify-between flex-wrap gap-4">
 <div className="flex items-start gap-3">
 {isRefund ? (
 <ReceiptText size={28} className="text-amber-500 shrink-0" />
 ) : (
 <AlertCircle size={28} className="text-rose-500 shrink-0" />
 )}
 <div>
 <p className="font-black text-base">
 {isRefund
 ? `Refund of ${fmt(Math.abs(netDue))} will be posted as receivable`
 : `${fmt(netDue)} will be debited from VAT Payable → Bank`}
 </p>
 <p className="text-sm text-app-text-muted mt-0.5">
 Journal entry will be created with scope=OFFICIAL, status=POSTED
 </p>
 </div>
 </div>
 <Button
 onClick={handlePost}
 disabled={posting || !bankAccountId}
 className="bg-violet-600 hover:bg-violet-700 text-white px-6"
 >
 <Send size={14} className="mr-2" />
 {posting ? 'Posting…' : 'Post Settlement'}
 </Button>
 </CardContent>
 </Card>
 </>
 ) : null}

 {/* Periodic Tax Accrual */}
 <Card>
 <CardHeader className="py-3 flex flex-row items-center justify-between">
 <CardTitle className="text-sm flex items-center gap-2">
 <Clock size={16} className="text-app-text-faint" /> Periodic Tax Accrual
 </CardTitle>
 <Button
 size="sm"
 variant="outline"
 onClick={handleRunAccrual}
 disabled={runningAccrual}
 className="text-xs"
 >
 <RefreshCw size={12} className={`mr-1.5 ${runningAccrual ? 'animate-spin' : ''}`} />
 {runningAccrual ? 'Running…' : 'Run Accrual'}
 </Button>
 </CardHeader>
 <CardContent className="p-0">
 {accruals.length === 0 ? (
 <div className="text-center py-10 text-app-text-faint text-sm">
 <Clock size={32} className="mx-auto mb-2 opacity-30" />
 No periodic accruals yet. Run accrual to generate entries for MICRO/ON_TURNOVER orgs.
 </div>
 ) : (
 <table className="w-full text-sm">
 <thead className="bg-app-bg border-b">
 <tr>
 <th className="text-left px-4 py-2 font-semibold text-app-text-muted">Period</th>
 <th className="text-left px-4 py-2 font-semibold text-app-text-muted">Type</th>
 <th className="text-right px-4 py-2 font-semibold text-app-text-muted">Base</th>
 <th className="text-right px-4 py-2 font-semibold text-app-text-muted">Rate</th>
 <th className="text-right px-4 py-2 font-semibold text-app-text-muted">Amount</th>
 <th className="text-center px-4 py-2 font-semibold text-app-text-muted">Status</th>
 </tr>
 </thead>
 <tbody>
 {accruals.map((a: any) => (
 <tr key={a.id} className="border-b hover:bg-app-bg">
 <td className="px-4 py-2 text-app-text-muted font-mono text-xs">
 {a.period_start?.slice(0, 10)} → {a.period_end?.slice(0, 10)}
 </td>
 <td className="px-4 py-2">
 <Badge variant="outline" className="text-xs">{a.tax_type}</Badge>
 </td>
 <td className="px-4 py-2 text-right">{fmt(n(a.base_amount))}</td>
 <td className="px-4 py-2 text-right font-mono">{(n(a.rate) * 100).toFixed(2)}%</td>
 <td className="px-4 py-2 text-right font-semibold text-violet-700">{fmt(n(a.accrual_amount))}</td>
 <td className="px-4 py-2 text-center">
 <Badge className={a.status === 'POSTED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
 {a.status === 'POSTED'
 ? <><CheckCircle size={10} className="mr-1 inline" />Posted</>
 : a.status}
 </Badge>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </CardContent>
 </Card>
 </div>
 )
}
