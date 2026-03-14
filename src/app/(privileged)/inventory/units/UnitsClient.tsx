'use client'

import { useState, useMemo } from 'react'
import { buildTree } from '@/lib/utils/tree'
import { UnitTree } from '@/components/admin/UnitTree'
import { UnitCalculator } from '@/components/admin/UnitCalculator'
import { CreateUnitButton } from '@/components/admin/CreateUnitButton'
import { Calculator, Wrench, Layers } from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from '@/hooks/use-translation'

export default function UnitsClient({ initialUnits }: { initialUnits: any[] }) {
    const { t } = useTranslation()
    const [data] = useState(initialUnits)

    // Build tree structure
    const tree = useMemo(() => buildTree(data, 'base_unit'), [data])

    return (
        <div className="space-y-12 pb-20">
            {/* Premium Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-extrabold text-app-foreground tracking-tight flex items-center gap-3">
                        <Layers className="text-app-primary" size={32} />
                        {t('inventory.units_and_packaging')}
                    </h1>
                    <p className="text-app-muted-foreground font-medium tracking-tight">{t('inventory.units_info_subtitle')}</p>
                </div>

                <div className="flex items-center gap-4">
                    <Link
                        href="/inventory/maintenance?tab=unit"
                        className="p-3 bg-app-surface border border-app-border rounded-2xl text-app-muted-foreground hover:text-app-primary hover:border-app-success transition-all shadow-sm flex items-center gap-2"
                        title={t('inventory.reorganize_hierarchy')}
                    >
                        <Wrench size={18} />
                        <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">{t('inventory.bulk_align')}</span>
                    </Link>

                    <CreateUnitButton potentialParents={data} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Side: Tree View */}
                <div className="lg:col-span-8 relative">
                    {/* Decorative background gradient */}
                    <div className="absolute -top-24 -left-24 w-96 h-96 bg-app-primary-light/20 blur-[100px] pointer-events-none rounded-full" />

                    <div className="relative z-10 bg-app-foreground/50 backdrop-blur-md border border-app-border/50 rounded-[2.5rem] p-8 shadow-2xl shadow-app-border/20">
                        <UnitTree
                            units={tree}
                            potentialParents={data}
                        />
                    </div>
                </div>

                {/* Right Side: Calculator & Stats */}
                <div className="lg:col-span-4 space-y-6">
                    <UnitCalculator units={data} />

                    <div className="bg-app-primary rounded-[2.5rem] p-8 text-app-foreground shadow-2xl shadow-indigo-900/40 relative overflow-hidden group">
                        <div className="relative z-10">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Calculator className="text-app-primary" size={20} />
                                {t('inventory.conversion_logic')}
                            </h3>
                            <p className="text-app-primary text-sm mb-6 leading-relaxed">
                                {t('inventory.unit_registry_info')}
                            </p>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-app-primary">
                                    <span>{t('inventory.primary_registry')}</span>
                                    <span>{data.filter(u => !u.base_unit).length} {t('inventory.base_units')}</span>
                                </div>
                                <div className="w-full bg-app-foreground/10 h-1.5 rounded-full overflow-hidden">
                                    <div
                                        className="bg-app-success/10 h-full rounded-full transition-all duration-1000 group-hover:bg-app-success/10"
                                        style={{ width: `${(data.filter(u => !u.base_unit).length / data.length) * 100}%` }}
                                    />
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-app-primary font-medium">
                                    <span>{t('inventory.derived_packaging')}</span>
                                    <span>{data.filter(u => u.base_unit).length} {t('inventory.derived_units')}</span>
                                </div>
                            </div>
                        </div>
                        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-app-foreground/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                    </div>
                </div>
            </div>
        </div>
    )
}

