'use client'

import { Crown, Package } from 'lucide-react'
import { ModuleCard } from './ModuleCard'
import type { SaasModule } from '@/types/erp'

interface ModulesTabProps {
    modules: SaasModule[]
    toggling: string | null
    onToggle: (code: string, status: string) => void
    onFeatureToggle: (code: string, featureCode: string, enabled: boolean) => void
}

export function ModulesTab({ modules, toggling, onToggle, onFeatureToggle }: ModulesTabProps) {
    const coreModules = modules.filter(m => m.is_core)
    const businessModules = modules.filter(m => !m.is_core)

    return (
        <div className="space-y-8">
            {coreModules.length > 0 && (
                <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-indigo-500 mb-4 flex items-center gap-2">
                        <Crown size={14} /> Core Infrastructure
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {coreModules.map(m => <ModuleCard key={m.code} module={m} onToggle={onToggle} toggling={toggling} onFeatureToggle={onFeatureToggle} />)}
                    </div>
                </div>
            )}
            <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-4 flex items-center gap-2">
                    <Package size={14} /> Business Modules
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {businessModules.map(m => <ModuleCard key={m.code} module={m} onToggle={onToggle} toggling={toggling} onFeatureToggle={onFeatureToggle} />)}
                </div>
            </div>
        </div>
    )
}
