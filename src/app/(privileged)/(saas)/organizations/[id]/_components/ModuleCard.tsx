'use client'

import { Loader2, ToggleLeft, ToggleRight, Crown, Package, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function ModuleCard({ module, onToggle, toggling, onFeatureToggle }: {
 module: Record<string, any>; onToggle: (code: string, status: string) => void; toggling: string | null
 onFeatureToggle: (code: string, featureCode: string, enabled: boolean) => void
}) {
 const isInstalled = module.status === 'INSTALLED'
 const isCore = module.is_core
 return (
 <div className={`p-5 rounded-2xl border transition-all group ${isInstalled
 ? 'bg-app-surface border-app-success/30 hover:border-app-success shadow-sm'
 : 'bg-app-background border-app-border hover:border-app-border'
 }`}>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCore
 ? 'bg-app-primary/5 text-app-primary'
 : isInstalled ? 'bg-app-primary-light text-app-primary' : 'bg-app-surface-2 text-app-muted-foreground'
 }`}>
 {isCore ? <Crown size={18} /> : <Package size={18} />}
 </div>
 <div>
 <h4 className="font-bold text-app-foreground">{module.name}</h4>
 <p className="text-[10px] text-app-muted-foreground font-mono uppercase tracking-widest">{module.code}</p>
 {module.description && (
 <p className="text-[10px] text-app-muted-foreground mt-0.5 line-clamp-1">{module.description}</p>
 )}
 </div>
 </div>
 <div className="flex items-center gap-3">
 <Badge className={isInstalled
 ? "bg-app-primary-light text-app-primary border-app-success/30 text-[10px]"
 : "bg-app-surface-2 text-app-muted-foreground border-app-border text-[10px]"
 }>
 {isInstalled ? 'Active' : 'Inactive'}
 </Badge>
 {isCore ? (
 <div className="text-[9px] text-app-primary font-black uppercase bg-app-primary/5 px-3 py-1.5 rounded-lg border border-app-primary/30">Core</div>
 ) : (
 <button
 onClick={() => onToggle(module.code, module.status)}
 disabled={toggling === module.code}
 className="transition-transform hover:scale-110 disabled:opacity-50"
 >
 {toggling === module.code ? (
 <Loader2 size={24} className="animate-spin text-app-muted-foreground" />
 ) : isInstalled ? (
 <ToggleRight size={28} className="text-app-primary" />
 ) : (
 <ToggleLeft size={28} className="text-app-muted-foreground" />
 )}
 </button>
 )}
 </div>
 </div>
 {/* Feature flags */}
 {isInstalled && module.available_features?.length > 0 && (
 <div className="mt-4 pt-3 border-t border-app-border">
 <p className="text-[9px] text-app-muted-foreground font-bold uppercase tracking-widest mb-2">Capabilities</p>
 <div className="flex flex-wrap gap-1.5">
 {module.available_features.map((f: Record<string, any>) => {
 const fCode = f.code || f
 const fName = f.name || f
 const isActive = module.active_features?.includes(fCode)
 return (
 <button
 key={fCode}
 onClick={() => onFeatureToggle(module.code, fCode, !isActive)}
 className={`text-[10px] px-2 py-0.5 rounded-md font-medium cursor-pointer transition-all ${isActive
 ? 'bg-app-primary-light text-app-primary border border-app-success/30 hover:bg-app-primary-light'
 : 'bg-app-background text-app-muted-foreground border border-app-border hover:bg-app-surface-2'
 }`}
 >
 {isActive && <Check size={8} className="inline mr-0.5" />}
 {fName}
 </button>
 )
 })}
 </div>
 </div>
 )}
 </div>
 )
}
