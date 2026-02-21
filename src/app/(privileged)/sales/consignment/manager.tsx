'use client'

import React, { useState } from 'react'
import {
    Box,
    TrendingUp,
    History,
    Package,
    Users,
    DollarSign,
    ChevronRight,
    Plus,
    CheckCircle2,
    Clock,
    Printer,
    FileText,
    ArrowUpRight
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { generateConsignmentSettlement } from '@/app/actions/consignment'
import { toast } from 'sonner'

interface ConsignmentManagerProps {
    availableStock: Record<string, any>[]
    pendingItems: Record<string, any>[]
    settlements: Record<string, any>[]
    suppliers: Record<string, any>[]
}

export default function ConsignmentManager({
    availableStock: initialStock,
    pendingItems: initialPending,
    settlements: initialSettlements,
    suppliers
}: ConsignmentManagerProps) {
    const [availableStock] = useState(initialStock)
    const [pendingItems, setPendingItems] = useState(initialPending)
    const [settlements, setSettlements] = useState(initialSettlements)
    const [selectedItems, setSelectedItems] = useState<number[]>([])
    const [isGenerating, setIsGenerating] = useState(false)

    // Calculate Statistics
    const totalConsignmentValue = availableStock.reduce((acc, item) => acc + (Number(item.consignment_cost) * Number(item.quantity)), 0)
    const totalPendingPayout = pendingItems.reduce((acc, item) => acc + Number(item.payout_amount), 0)
    const totalSettledCount = settlements.length

    const handleToggleItem = (id: number) => {
        setSelectedItems(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const handleGenerateSettlement = async (supplierId: number) => {
        const supplierItems = pendingItems.filter(item =>
            item.supplier_id === supplierId && selectedItems.includes(item.id)
        )

        if (supplierItems.length === 0) {
            toast.error("No selected items for this supplier")
            return
        }

        setIsGenerating(true)
        try {
            const res = await generateConsignmentSettlement({
                supplier_id: supplierId,
                line_ids: supplierItems.map(i => i.id),
                notes: `System generated settlement for ${supplierItems.length} items.`
            })

            toast.success("Settlement generated successfully")
            setSettlements([res, ...settlements])
            setPendingItems(pendingItems.filter(item => !supplierItems.some(si => si.id === item.id)))
            setSelectedItems(selectedItems.filter(id => !supplierItems.some(si => si.id === id)))
        } catch (error) {
            toast.error("Failed to generate settlement")
        } finally {
            setIsGenerating(false)
        }
    }

    // Group items by supplier for the Payout Desk
    const pendingBySupplier = pendingItems.reduce((acc: Record<string, any>, item) => {
        const sId = item.supplier_id || 0
        if (!acc[sId]) {
            acc[sId] = {
                id: sId,
                name: item.supplier_name,
                items: [],
                total: 0
            }
        }
        acc[sId].items.push(item)
        acc[sId].total += Number(item.payout_amount)
        return acc
    }, {})

    return (
        <div className="space-y-6">
            {/* KPI Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-none shadow-lg">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-white/80 text-sm font-medium">In-Stock Consignment</p>
                                <h3 className="text-3xl font-bold mt-1">{totalConsignmentValue.toLocaleString()} <span className="text-sm font-normal text-white/70">XOF</span></h3>
                            </div>
                            <div className="bg-white/20 p-2 rounded-lg">
                                <Package size={24} />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-sm text-white/80">
                            <TrendingUp size={16} className="mr-1" />
                            <span>{availableStock.length} unique products</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white border-none shadow-lg">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-white/80 text-sm font-medium">Pending Payouts</p>
                                <h3 className="text-3xl font-bold mt-1">{totalPendingPayout.toLocaleString()} <span className="text-sm font-normal text-white/70">XOF</span></h3>
                            </div>
                            <div className="bg-white/20 p-2 rounded-lg">
                                <DollarSign size={24} />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-sm text-white/80">
                            <Clock size={16} className="mr-1" />
                            <span>{pendingItems.length} items sold awaiting settlement</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white border-none shadow-lg">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-white/80 text-sm font-medium">Completed Settlements</p>
                                <h3 className="text-3xl font-bold mt-1">{totalSettledCount}</h3>
                            </div>
                            <div className="bg-white/20 p-2 rounded-lg">
                                <History size={24} />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-sm text-white/80">
                            <CheckCircle2 size={16} className="mr-1" />
                            <span>Archive growing</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="stock" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-14 bg-gray-100 p-1 rounded-xl">
                    <TabsTrigger value="stock" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <Package size={18} className="mr-2" />
                        Stock Overview
                    </TabsTrigger>
                    <TabsTrigger value="payouts" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <DollarSign size={18} className="mr-2" />
                        Payout Desk
                    </TabsTrigger>
                    <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <History size={18} className="mr-2" />
                        Settlement History
                    </TabsTrigger>
                </TabsList>

                {/* --- STOCK OVERVIEW --- */}
                <TabsContent value="stock" className="mt-6">
                    <Card className="border-none shadow-xl">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Box className="text-indigo-500" />
                                Available Consignment Stock
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto ring-1 ring-gray-100 rounded-xl">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs uppercase bg-gray-50/50 text-gray-500 font-bold border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4">Product</th>
                                            <th className="px-6 py-4">Warehouse</th>
                                            <th className="px-6 py-4">Supplier</th>
                                            <th className="px-6 py-4 text-right">Qty</th>
                                            <th className="px-6 py-4 text-right">Cost/Unit</th>
                                            <th className="px-6 py-4 text-right">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {availableStock.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                                    No consignment stock currently available.
                                                </td>
                                            </tr>
                                        )}
                                        {availableStock.map((inv) => (
                                            <tr key={inv.id} className="hover:bg-gray-50/30 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-semibold text-gray-900">{inv.product_name}</div>
                                                    <div className="text-xs text-gray-400 font-mono tracking-tighter uppercase">{inv.sku}</div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-600">{inv.warehouse_name}</td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                                                        <Users size={12} className="mr-1" />
                                                        {inv.supplier_name}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-medium">{inv.quantity}</td>
                                                <td className="px-6 py-4 text-right text-gray-500">{Number(inv.consignment_cost).toLocaleString()}</td>
                                                <td className="px-6 py-4 text-right font-bold text-gray-900">
                                                    {(Number(inv.consignment_cost) * Number(inv.quantity)).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- PAYOUT DESK --- */}
                <TabsContent value="payouts" className="mt-6 overflow-hidden">
                    <div className="space-y-6">
                        {Object.values(pendingBySupplier).length === 0 && (
                            <Card className="border-none shadow-xl">
                                <CardContent className="py-20 text-center">
                                    <div className="bg-amber-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-500">
                                        <CheckCircle2 size={32} />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900">All Clear!</h3>
                                    <p className="text-gray-400 mt-1 max-w-sm mx-auto">All sold items have been settled with suppliers. Check your history for details.</p>
                                </CardContent>
                            </Card>
                        )}
                        {Object.values(pendingBySupplier).map((supplier: Record<string, any>) => (
                            <Card key={supplier.id} className="border-none shadow-xl overflow-hidden group">
                                <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 flex justify-between items-center text-white">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <Users size={20} className="text-amber-400" />
                                            <h3 className="text-lg font-bold">{supplier.name}</h3>
                                        </div>
                                        <p className="text-white/60 text-sm mt-1">{supplier.items.length} items sold • {supplier.total.toLocaleString()} XOF pending</p>
                                    </div>
                                    <button
                                        onClick={() => handleGenerateSettlement(supplier.id)}
                                        disabled={isGenerating || !supplier.items.some((i: Record<string, any>) => selectedItems.includes(i.id))}
                                        className="bg-white text-gray-900 px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-amber-400 transition-colors disabled:opacity-50"
                                    >
                                        {isGenerating ? "Processing..." : "Generate Settlement"}
                                        <ArrowUpRight size={18} />
                                    </button>
                                </div>
                                <CardContent className="p-0">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50/50 text-[10px] uppercase text-gray-400 font-bold border-b border-gray-100">
                                            <tr>
                                                <th className="w-12 px-6 py-3">Select</th>
                                                <th className="px-6 py-3">Date</th>
                                                <th className="px-6 py-3">Sold Product</th>
                                                <th className="px-6 py-3 text-right">Sold Qty</th>
                                                <th className="px-6 py-3 text-right">Payout Unit</th>
                                                <th className="px-6 py-3 text-right font-bold">Total Payout</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {supplier.items.map((line: Record<string, any>) => (
                                                <tr key={line.id} className="hover:bg-gray-50/20">
                                                    <td className="px-6 py-4">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedItems.includes(line.id)}
                                                            onChange={() => handleToggleItem(line.id)}
                                                            className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-500">
                                                        {new Date(line.sold_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="font-semibold text-gray-900">{line.product_name}</div>
                                                        <div className="text-[10px] text-gray-400 uppercase tracking-tighter">Order #{line.order_ref}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-medium">{line.quantity}</td>
                                                    <td className="px-6 py-4 text-right text-gray-500">{Number(Number(line.payout_amount) / (Number(line.quantity) || 1)).toLocaleString()}</td>
                                                    <td className="px-6 py-4 text-right font-bold text-emerald-600">{Number(line.payout_amount).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* --- HISTORY --- */}
                <TabsContent value="history" className="mt-6">
                    <Card className="border-none shadow-xl">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <History className="text-emerald-500" />
                                Settlement Archive
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {settlements.length === 0 && (
                                    <div className="col-span-full py-12 text-center text-gray-400">
                                        No settlement records found.
                                    </div>
                                )}
                                {settlements.map((settle) => (
                                    <div key={settle.id} className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5 hover:border-emerald-200 hover:bg-emerald-50/10 transition-all group">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="bg-white p-2.5 rounded-xl shadow-sm group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                                <FileText size={20} />
                                            </div>
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${settle.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                {settle.status}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-gray-900">{settle.reference}</h4>
                                        <p className="text-xs text-gray-400 mt-1 mb-4 flex items-center">
                                            <Users size={12} className="mr-1" />
                                            {settle.supplier_name}
                                        </p>
                                        <div className="flex justify-between items-end border-t border-gray-100 pt-4">
                                            <div>
                                                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Settlement Total</p>
                                                <p className="font-black text-lg text-gray-900">{Number(settle.total_amount).toLocaleString()} <span className="text-[10px] font-normal">XOF</span></p>
                                            </div>
                                            <button className="p-2 text-gray-400 hover:bg-white hover:shadow-sm hover:text-gray-900 rounded-lg transition-all">
                                                <Printer size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
