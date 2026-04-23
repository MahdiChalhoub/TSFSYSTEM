'use client'

import { useState } from 'react'
import {
    Plus, Edit3, Save, X, Loader2, FolderTree
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { COATreePicker } from './COATreePicker'
import { ICON_OPTIONS, COLOR_PRESETS, getIcon, DEFAULT_COLOR } from './constants'

export type CategoryFormData = {
    name: string
    code: string
    icon: string
    color: string
    description: string
    coa_parent: string
    sort_order: number
}

/* ═══════════════════════════════════════════════════════════
 *  CATEGORY FORM MODAL
 * ═══════════════════════════════════════════════════════════ */
export function CategoryFormModal({ form, setForm, coaList, editingId, saving, onSave, onClose }: {
    form: CategoryFormData
    setForm: React.Dispatch<React.SetStateAction<CategoryFormData>>
    coaList: any[]
    editingId: number | null
    saving: boolean
    onSave: () => void
    onClose: () => void
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-lg rounded-2xl border shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200"
                style={{ background: 'var(--app-surface)', borderColor: 'color-mix(in srgb, var(--app-primary) 20%, var(--app-border))' }}>
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-black text-app-text flex items-center gap-2">
                        {editingId ? <Edit3 size={14} style={{ color: 'var(--app-primary)' }} /> : <Plus size={14} style={{ color: 'var(--app-primary)' }} />}
                        {editingId ? 'Edit Category' : 'New Category'}
                    </h3>
                    <button onClick={onClose} className="text-app-text-muted hover:text-app-text p-1 rounded-lg hover:bg-app-background transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Row 1: Name + Code */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-app-text-faint block mb-1">Name *</label>
                        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="e.g. Cash Drawers" className="text-sm font-bold" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-app-text-faint block mb-1">Code *</label>
                        <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                            placeholder="e.g. CASH" className="text-sm font-bold font-mono" />
                    </div>
                </div>

                {/* Row 2: Description */}
                <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-app-text-faint block mb-1">Description</label>
                    <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Physical cash registers, tills, and petty cash boxes" className="text-sm" />
                </div>

                {/* Row 3: Icon + Color + Sort Order */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-app-text-faint block mb-1">Icon</label>
                        <Select value={form.icon} onValueChange={v => setForm(f => ({ ...f, icon: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {ICON_OPTIONS.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-app-text-faint block mb-1">Color</label>
                        <div className="flex items-center gap-2">
                            <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                                className="w-8 h-8 rounded-lg border border-app-border cursor-pointer shrink-0" />
                            <div className="flex gap-1 flex-wrap">
                                {COLOR_PRESETS.map(c => (
                                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                                        className={`w-5 h-5 rounded-full border-2 transition-all ${form.color === c ? 'border-app-text scale-110' : 'border-transparent hover:scale-110'}`}
                                        style={{ background: c }} />
                                ))}
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-app-text-faint block mb-1">Sort Order</label>
                        <Input type="number" value={form.sort_order}
                            onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                            className="text-sm font-bold" />
                    </div>
                </div>

                {/* Row 4: COA Parent */}
                <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-app-text-faint block mb-1">
                        COA Parent <span className="normal-case font-normal">(click to expand, select a node)</span>
                    </label>
                    {form.coa_parent && (() => {
                        const sel = coaList.find((a: any) => a.id.toString() === form.coa_parent)
                        return sel ? (
                            <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg border border-app-primary/30"
                                style={{ background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)' }}>
                                <FolderTree size={12} style={{ color: 'var(--app-primary)' }} />
                                <span className="text-xs font-bold text-app-text">{sel.code} — {sel.name}</span>
                                <span className="text-[9px] text-app-text-faint">({sel.type})</span>
                                <button onClick={() => setForm(f => ({ ...f, coa_parent: '' }))}
                                    className="ml-auto text-app-text-muted hover:text-rose-400 transition-colors">
                                    <X size={12} />
                                </button>
                            </div>
                        ) : null
                    })()}
                    <COATreePicker
                        coaList={coaList}
                        selectedId={form.coa_parent}
                        onSelect={(id: string) => setForm(f => ({ ...f, coa_parent: id }))}
                    />
                </div>

                {/* Preview + Save */}
                <div className="flex items-center justify-between pt-2 border-t border-app-border/30">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: `color-mix(in srgb, ${form.color || DEFAULT_COLOR} 15%, transparent)`, color: form.color || DEFAULT_COLOR }}>
                            {(() => { const Ic = getIcon(form.icon); return <Ic size={20} /> })()}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-app-text">{form.name || 'Preview'}</p>
                            <p className="text-[10px] text-app-text-faint font-mono">{form.code || 'CODE'}</p>
                        </div>
                    </div>
                    <Button onClick={onSave} disabled={saving} className="rounded-xl gap-2">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Category'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
