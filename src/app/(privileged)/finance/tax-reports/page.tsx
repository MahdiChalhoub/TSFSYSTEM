'use client'

import { useState, useEffect, useCallback } from 'react'
import { getVatReturnReport, getVatReturnDashboard } from '@/app/actions/finance/tax-engine'
import { useCurrency } from '@/lib/utils/currency'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
    FileSpreadsheet, RefreshCw, TrendingUp, TrendingDown,
    Scale, AlertTriangle, DollarSign, Percent, ShoppingCart,
    ArrowDownLeft, ReceiptText, Building2
} from 'lucide-react'

interface VatReport {
    period_start: string
    period_end: string
    vat_collected: string
    vat_recoverable: string
    net_vat_due: string
    reverse_charge_vat: string
    total_sales_ht: string
    total_purchases_ht: string
    airsi?: {
        total_withheld: string
        total_base: string
    }
    purchase_tax?: {
        total: string
        base: string
    }
    by_rate?: Record<string, { collected: string; recoverable: string; base_sales: string; base_purchases: string }>
}

export default function VatReturnReportPage() {
    const { fmt } = useCurrency()

    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    const todayStr = today.toISOString().split('T')[0]

    const [periodStart, setPeriodStart] = useState(firstDay)
    const [periodEnd, setPeriodEnd] = useState(todayStr)
    const [report, setReport] = useState<VatReport | null>(null)
    const [dashboard, setDashboard] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [rep, dash] = await Promise.all([
                getVatReturnReport(periodStart + 'T00:00:00', periodEnd + 'T23:59:59'),
                getVatReturnDashboard(),
            ])
            setReport(rep?.error ? null : rep)
            setDashboard(dash?.error ? null : dash)
        } catch {
            toast.error('Failed to load VAT report')
        } finally {
            setLoading(false)
        }
    }, [periodStart, periodEnd])

    useEffect(() => { load() }, [load])

    const n = (v?: string | number) => parseFloat(String(v ?? '0')) || 0

    const kpis = [
        {
            label: 'TVA Collectée', value: fmt(n(report?.vat_collected)),
            sub: `on ${fmt(n(report?.total_sales_ht))} HT sales`,
            icon: TrendingUp, color: 'emerald', bg: 'from-emerald-50 to-white', border: 'border-emerald-500',
        },
        {
            label: 'TVA Récupérable', value: fmt(n(report?.vat_recoverable)),
            sub: `on ${fmt(n(report?.total_purchases_ht))} HT purchases`,
            icon: TrendingDown, color: 'blue', bg: 'from-blue-50 to-white', border: 'border-blue-500',
        },
        {
            label: 'Net TVA Due', value: fmt(n(report?.net_vat_due)),
            sub: n(report?.net_vat_due) < 0 ? '← Refund due to org' : '→ Payment due to state',
            icon: Scale, color: n(report?.net_vat_due) < 0 ? 'amber' : 'rose',
            bg: n(report?.net_vat_due) < 0 ? 'from-amber-50 to-white' : 'from-rose-50 to-white',
            border: n(report?.net_vat_due) < 0 ? 'border-amber-500' : 'border-rose-500',
        },
        {
            label: 'AIRSI Withheld', value: fmt(n(report?.airsi?.total_withheld)),
            sub: `on ${fmt(n(report?.airsi?.total_base))} base`,
            icon: Building2, color: 'violet', bg: 'from-violet-50 to-white', border: 'border-violet-500',
        },
    ]

    return (
        <div className="page-container">
            <header>
                <h1 className="page-header-title tracking-tighter text-gray-900 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-rose-600 flex items-center justify-center shadow-lg shadow-rose-200">
                        <FileSpreadsheet size={28} className="text-white" />
                    </div>
                    VAT Return <span className="text-rose-600">Report</span>
                </h1>
                <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">
                    TVA Collectée · TVA Récupérable · AIRSI · Reverse Charge
                </p>
            </header>

            {/* Period Selector */}
            <Card className="border-dashed border-2 border-gray-200">
                <CardContent className="py-4 flex flex-wrap items-end gap-4">
                    <div>
                        <label className="text-xs text-gray-500 uppercase font-semibold mb-1 block">Period Start</label>
                        <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="w-40" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 uppercase font-semibold mb-1 block">Period End</label>
                        <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="w-40" />
                    </div>
                    <Button onClick={load} disabled={loading} className="bg-rose-600 hover:bg-rose-700 text-white">
                        <RefreshCw size={15} className={loading ? 'animate-spin mr-2' : 'mr-2'} />
                        {loading ? 'Loading…' : 'Run Report'}
                    </Button>
                    {report && (
                        <Badge variant="outline" className="text-xs font-mono text-green-700 border-green-300">
                            ✓ {report.period_start?.slice(0, 10)} → {report.period_end?.slice(0, 10)}
                        </Badge>
                    )}
                </CardContent>
            </Card>

            {loading ? (
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
                </div>
            ) : (
                <>
                    {/* KPI Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {kpis.map((k) => (
                            <Card key={k.label} className={`border-l-4 ${k.border} bg-gradient-to-r ${k.bg}`}>
                                <CardContent className="py-4">
                                    <div className="flex items-start gap-3">
                                        <k.icon size={22} className={`text-${k.color}-500 mt-0.5 shrink-0`} />
                                        <div className="min-w-0">
                                            <p className="text-[11px] text-gray-500 uppercase font-semibold tracking-wide">{k.label}</p>
                                            <p className={`text-xl font-black text-${k.color}-700 truncate`}>{k.value}</p>
                                            <p className="text-[10px] text-gray-400 mt-0.5 truncate">{k.sub}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Net VAT Status Banner */}
                    {report && (
                        <Card className={`border-2 ${n(report.net_vat_due) >= 0 ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
                            <CardContent className="py-4 flex items-center gap-4">
                                {n(report.net_vat_due) >= 0 ? (
                                    <AlertTriangle size={28} className="text-rose-500 shrink-0" />
                                ) : (
                                    <ReceiptText size={28} className="text-amber-500 shrink-0" />
                                )}
                                <div>
                                    <p className={`text-base font-black ${n(report.net_vat_due) >= 0 ? 'text-rose-800' : 'text-amber-800'}`}>
                                        {n(report.net_vat_due) >= 0
                                            ? `Net TVA payable to state: ${fmt(n(report.net_vat_due))}`
                                            : `VAT refund receivable from state: ${fmt(Math.abs(n(report.net_vat_due)))}`}
                                    </p>
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        TVA Collectée ({fmt(n(report.vat_collected))}) − TVA Récupérable ({fmt(n(report.vat_recoverable))})
                                        {n(report.reverse_charge_vat) !== 0 && ` + Reverse Charge (${fmt(n(report.reverse_charge_vat))})`}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* By Rate Breakdown */}
                    {report?.by_rate && Object.keys(report.by_rate).length > 0 && (
                        <Card>
                            <CardHeader className="py-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Percent size={16} className="text-gray-400" /> Breakdown by VAT Rate
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="text-left px-4 py-2 font-semibold text-gray-600">Rate</th>
                                            <th className="text-right px-4 py-2 font-semibold text-gray-600">Sales HT</th>
                                            <th className="text-right px-4 py-2 font-semibold text-gray-600">TVA Collectée</th>
                                            <th className="text-right px-4 py-2 font-semibold text-gray-600">Purchases HT</th>
                                            <th className="text-right px-4 py-2 font-semibold text-gray-600">TVA Récupérable</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(report.by_rate).map(([rate, data]) => (
                                            <tr key={rate} className="border-b hover:bg-gray-50">
                                                <td className="px-4 py-2">
                                                    <Badge variant="outline" className="font-mono">{parseFloat(rate) * 100}%</Badge>
                                                </td>
                                                <td className="px-4 py-2 text-right font-medium">{fmt(n(data.base_sales))}</td>
                                                <td className="px-4 py-2 text-right font-semibold text-emerald-700">{fmt(n(data.collected))}</td>
                                                <td className="px-4 py-2 text-right font-medium">{fmt(n(data.base_purchases))}</td>
                                                <td className="px-4 py-2 text-right font-semibold text-blue-700">{fmt(n(data.recoverable))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    )}

                    {/* Additional Sections — AIRSI + Purchase Tax */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* AIRSI Summary */}
                        <Card>
                            <CardHeader className="py-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Building2 size={16} className="text-violet-400" /> AIRSI Withholding
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">Total Base</span>
                                    <span className="font-semibold">{fmt(n(report?.airsi?.total_base))}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">Total Withheld</span>
                                    <span className="font-semibold text-violet-700">{fmt(n(report?.airsi?.total_withheld))}</span>
                                </div>
                                <div className="pt-2 border-t text-[11px] text-gray-400">
                                    Withheld at source and payable to DGI (Direction Générale des Impôts)
                                </div>
                            </CardContent>
                        </Card>

                        {/* Purchase Tax Summary */}
                        <Card>
                            <CardHeader className="py-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <ShoppingCart size={16} className="text-blue-400" /> Purchase Tax
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">Taxable Base</span>
                                    <span className="font-semibold">{fmt(n(report?.purchase_tax?.base))}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">Total Purchase Tax</span>
                                    <span className="font-semibold text-blue-700">{fmt(n(report?.purchase_tax?.total))}</span>
                                </div>
                                <div className="pt-2 border-t text-[11px] text-gray-400">
                                    Applies when org_policy.purchase_tax_rate &gt; 0 (non-VAT purchases)
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Reverse Charge */}
                    {n(report?.reverse_charge_vat) !== 0 && (
                        <Card className="border-amber-200">
                            <CardHeader className="py-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <ArrowDownLeft size={16} className="text-amber-500" /> Reverse Charge VAT
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-500">Reverse Charge Amount</span>
                                    <span className="text-lg font-black text-amber-700">{fmt(n(report?.reverse_charge_vat))}</span>
                                </div>
                                <p className="text-[11px] text-gray-400 mt-2">
                                    Self-assessed VAT on intra-community / foreign supplier purchases. Offset in both collected and recoverable columns.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* No data state */}
                    {!report && !loading && (
                        <Card>
                            <CardContent className="py-16 text-center text-gray-400">
                                <DollarSign size={48} className="mx-auto mb-3 opacity-30" />
                                <p className="font-medium">No VAT data for selected period</p>
                                <p className="text-sm mt-1">Try a different date range or check that the org has VAT enabled</p>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    )
}
