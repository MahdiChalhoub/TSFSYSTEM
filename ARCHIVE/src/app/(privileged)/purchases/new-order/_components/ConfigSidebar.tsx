// @ts-nocheck
'use client'

/**
 * ConfigSidebar — Order Configuration Panel
 * =============================================
 */

import { Settings2 } from 'lucide-react'
import { fieldLabel, fieldSelect, fieldInput } from '../_lib/constants'

export function ConfigSidebar({ configOpen, setConfigOpen, selectedSiteId, setSelectedSiteId, selectedWarehouseId, setSelectedWarehouseId,
    selectedSupplierId, setSelectedSupplierId, selectedPaymentTermId, setSelectedPaymentTermId, selectedDriverId, setSelectedDriverId,
    assignedToId, setAssignedToId, availableWarehouses, safeSites, safeSuppliers, safePaymentTerms, safeDrivers, safeUsers,
    docNumberPreview, scope, setScope, canToggleScope, notes, setNotes,
}: {
    configOpen: boolean, setConfigOpen: (v: boolean) => void,
    selectedSiteId: number | '', setSelectedSiteId: (v: number) => void,
    selectedWarehouseId: number | '', setSelectedWarehouseId: (v: number) => void,
    selectedSupplierId: number | '', setSelectedSupplierId: (v: number) => void,
    selectedPaymentTermId: number | '', setSelectedPaymentTermId: (v: number) => void,
    selectedDriverId: number | '', setSelectedDriverId: (v: number) => void,
    assignedToId: number | '', setAssignedToId: (v: number) => void,
    availableWarehouses: any[], safeSites: any[], safeSuppliers: any[], safePaymentTerms: any[], safeDrivers: any[], safeUsers: any[],
    docNumberPreview: string, scope: string, setScope: (v: 'OFFICIAL' | 'INTERNAL') => void, canToggleScope: boolean,
    notes: string, setNotes: (v: string) => void,
}) {
    if (!configOpen) return null
    return (
        <>
            <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setConfigOpen(false)} />
            <div className="fixed top-0 right-0 h-full w-[340px] max-w-[85vw] z-50 bg-app-surface border-l border-app-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
                <div className="px-5 py-4 border-b border-app-border flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Settings2 size={16} className="text-app-primary" />
                        <h3 className="text-[14px] font-bold text-app-foreground">Order Configuration</h3>
                    </div>
                    <button type="button" onClick={() => setConfigOpen(false)}
                        className="w-7 h-7 rounded-lg border border-app-border flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-background transition-all">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    <div><label className={fieldLabel}>Branch <span className="text-app-error">*</span></label>
                        <select className={fieldSelect} value={selectedSiteId} onChange={e => setSelectedSiteId(Number(e.target.value))}>
                            <option value="">Select branch...</option>
                            {safeSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select></div>
                    <div><label className={fieldLabel}>Warehouse <span className="text-app-error">*</span></label>
                        <select className={fieldSelect} value={selectedWarehouseId} onChange={e => setSelectedWarehouseId(Number(e.target.value))}>
                            <option value="">Select warehouse...</option>
                            {availableWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}{w.location_type ? ` (${w.location_type})` : ''}</option>)}
                        </select></div>
                    <div><label className={fieldLabel}>Supplier <span className="text-app-error">*</span></label>
                        <select className={fieldSelect} value={selectedSupplierId} onChange={e => setSelectedSupplierId(Number(e.target.value))}>
                            <option value="">Select supplier...</option>
                            {safeSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select></div>
                    <div><label className={fieldLabel}>Payment Terms</label>
                        <select className={fieldSelect} value={selectedPaymentTermId} onChange={e => setSelectedPaymentTermId(Number(e.target.value))}>
                            <option value="">Default</option>
                            {safePaymentTerms.map(pt => <option key={pt.id} value={pt.id}>{pt.name || pt.label}</option>)}
                        </select></div>
                    <div><label className={fieldLabel}>Driver</label>
                        <select className={fieldSelect} value={selectedDriverId} onChange={e => setSelectedDriverId(Number(e.target.value))}>
                            <option value="">None</option>
                            {safeDrivers.map(d => <option key={d.id} value={d.id}>{d.first_name && d.last_name ? `${d.first_name} ${d.last_name}` : d.username || `User #${d.id}`}{d.is_driver ? ' 🚗' : ''}</option>)}
                        </select></div>
                    <div><label className={fieldLabel}>Assigned To</label>
                        <select className={fieldSelect} value={assignedToId} onChange={e => setAssignedToId(Number(e.target.value))}>
                            <option value="">Unassigned</option>
                            {safeUsers.map(u => <option key={u.id} value={u.id}>{u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username || `User #${u.id}`}</option>)}
                        </select></div>
                    <div><label className={fieldLabel}>Document</label>
                        <div className="flex items-center gap-2 px-3 py-[10px] rounded-lg border border-app-border bg-app-background/40">
                            <span className="text-[12px] font-black text-app-foreground tracking-wide">{docNumberPreview}</span>
                            {canToggleScope ? (
                                <div className="ml-auto flex p-0.5 rounded-md bg-app-background border border-app-border">
                                    <button type="button" onClick={() => setScope('OFFICIAL')}
                                        className={`px-2 py-0.5 rounded text-[8px] font-black uppercase transition-all ${scope === 'OFFICIAL' ? 'bg-emerald-500 text-white shadow-sm' : 'text-app-muted-foreground hover:text-app-foreground'}`}>Official</button>
                                    <button type="button" onClick={() => setScope('INTERNAL')}
                                        className={`px-2 py-0.5 rounded text-[8px] font-black uppercase transition-all ${scope === 'INTERNAL' ? 'bg-amber-500 text-white shadow-sm' : 'text-app-muted-foreground hover:text-app-foreground'}`}>Internal</button>
                                </div>
                            ) : (
                                <span className="ml-auto text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">OFFICIAL</span>
                            )}
                        </div></div>
                    <div><label className={fieldLabel}>Notes</label>
                        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className={fieldInput} placeholder="Internal notes..." /></div>
                </div>
                <div className="px-5 py-3 border-t border-app-border flex-shrink-0">
                    <button type="button" onClick={() => setConfigOpen(false)}
                        className="w-full py-2.5 rounded-xl text-[11px] font-bold bg-app-primary text-white hover:brightness-110 transition-all">Done</button>
                </div>
            </div>
        </>
    )
}
