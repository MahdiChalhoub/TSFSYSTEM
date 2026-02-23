'use client'

import { useState, useMemo } from 'react'
import { buildTree } from '@/lib/utils/tree'
import { UnitTree } from '@/components/admin/UnitTree'
import { UnitCalculator } from '@/components/admin/UnitCalculator'
import { CreateUnitButton } from '@/components/admin/CreateUnitButton'
import { Ruler, Scale, Box, Calculator, Wrench, Layers } from 'lucide-react'
import Link from 'next/link'

export function UnitsClient({ initialUnits }: { initialUnits: any[] }) {
    const [data] = useState(initialUnits)

    // Build tree structure
    const tree = useMemo(() => buildTree(data, 'base_unit'), [data])

    return (
        <div className="space-y-12 pb-20">
            {/* Premium Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                        <Layers className="text-emerald-500" size={32} />
                        Units & Packaging
                    </h1>
                    <p className="text-gray-400 font-medium tracking-tight">Define scaling multipliers and base unit relationships.</p>
                </div>

                <div className="flex items-center gap-4">
                    <Link
                        href="/inventory/maintenance?tab=unit"
                        className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm flex items-center gap-2"
                        title="Reorganize Hierarchy"
                    >
                        <Wrench size={18} />
                        <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Bulk Align</span>
                    </Link>

                    <CreateUnitButton potentialParents={data} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Side: Tree View */}
                <div className="lg:col-span-8 relative">
                    {/* Decorative background gradient */}
                    <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-100/20 blur-[100px] pointer-events-none rounded-full" />

                    <div className="relative z-10 bg-white/50 backdrop-blur-md border border-gray-100/50 rounded-[2.5rem] p-8 shadow-2xl shadow-gray-200/50">
                        <UnitTree
                            units={tree}
                            potentialParents={data}
                        />
                    </div>
                </div>

                {/* Right Side: Calculator & Stats */}
                <div className="lg:col-span-4 space-y-6">
                    <UnitCalculator units={data} />

                    <div className="bg-indigo-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-indigo-900/40 relative overflow-hidden group">
                        <div className="relative z-10">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Calculator className="text-indigo-400" size={20} />
                                Conversion Logic
                            </h3>
                            <p className="text-indigo-200 text-sm mb-6 leading-relaxed">
                                Ensure every product is linked to a "Base Unit" for financial transparency and stock valuation accuracy.
                            </p>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-indigo-300">
                                    <span>Primary Registry</span>
                                    <span>{data.filter(u => !u.base_unit).length} Base Units</span>
                                </div>
                                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                                    <div
                                        className="bg-emerald-400 h-full rounded-full transition-all duration-1000 group-hover:bg-emerald-300"
                                        style={{ width: `${(data.filter(u => !u.base_unit).length / data.length) * 100}%` }}
                                    />
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-indigo-400 font-medium">
                                    <span>Derived Packaging</span>
                                    <span>{data.filter(u => u.base_unit).length} Units</span>
                                </div>
                            </div>
                        </div>
                        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                    </div>
                </div>
            </div>
        </div>
    )
}

