'use client'

import React, { useState } from 'react'
import {
    Tags, Plus, Pencil, Trash2, X, ChevronDown, ChevronRight,
    Search, Loader2, Maximize2, Minimize2, Package, Palette, Layers, Grid3X3,
    ChevronUp, Sparkles, Hash, Link2, Check, FolderTree, Building2, Barcode
} from 'lucide-react'

type AttributeChild = {
    id: number; name: string; code: string; sort_order: number;
    color_hex: string | null; image_url: string | null; products_count: number;
}
type LinkedCategory = { id: number; name: string }
type LinkedBrand = { id: number; name: string; logo: string | null }
type AttributeGroup = {
    id: number; name: string; code: string; is_variant: boolean;
    sort_order: number; children: AttributeChild[]; children_count: number;
    products_count: number; color_hex: string | null; image_url: string | null;
    linked_categories: LinkedCategory[];
    linked_brands: LinkedBrand[];
    // V3 Nomenclature
    show_in_name: boolean;
    name_position: number;
    short_label: string | null;
    is_required: boolean;
    show_by_default: boolean;
    requires_barcode: boolean;
}

/* ── Add Attribute Form (Group OR Value) ──────── */
export function AddGroupForm({ onSave, onCancel, groups }: {
    onSave: (data: {
        name: string; code: string; is_variant: boolean; parent?: number | null; color_hex?: string | null;
        show_in_name?: boolean; name_position?: number; short_label?: string | null;
        is_required?: boolean; show_by_default?: boolean; requires_barcode?: boolean;
    }) => Promise<void>
    onCancel: () => void
    groups: AttributeGroup[]
}) {
    const [name, setName] = useState('')
    const [code, setCode] = useState('')
    const [isVariant, setIsVariant] = useState(false)
    const [parentId, setParentId] = useState<string>('none')
    const [colorHex, setColorHex] = useState('')
    const [saving, setSaving] = useState(false)
    const [showAdvanced, setShowAdvanced] = useState(false)

    // V3 Nomenclature
    const [showInName, setShowInName] = useState(false)
    const [namePosition, setNamePosition] = useState(99)
    const [shortLabel, setShortLabel] = useState('')
    const [isRequired, setIsRequired] = useState(false)
    const [showByDefault, setShowByDefault] = useState(true)
    const [requiresBarcode, setRequiresBarcode] = useState(false)

    const isChild = parentId !== 'none'
    const selectedParent = groups.find(g => g.id === Number(parentId))

    return (
        <div className="flex-shrink-0 mb-3 p-4 border rounded-2xl animate-in slide-in-from-top-2 duration-200"
            style={{ background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))', borderColor: 'var(--app-border)', borderLeft: '3px solid var(--app-primary)' }}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <h3 className="text-[12px] font-black text-app-foreground uppercase tracking-wider">
                        {isChild ? `Add Value to "${selectedParent?.name}"` : 'New Attribute Group'}
                    </h3>
                    {!isChild && (
                        <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold transition-all ${showAdvanced ? 'bg-amber-500 text-white' : 'bg-app-bg border border-app-border/40 text-app-muted-foreground'}`}>
                            <Sparkles size={10} /> {showAdvanced ? 'Hide Advanced' : 'Rules & Governance'}
                        </button>
                    )}
                </div>
                <button onClick={onCancel} className="p-1 hover:bg-app-border/50 rounded-lg transition-colors">
                    <X size={14} className="text-app-muted-foreground" />
                </button>
            </div>
            <form onSubmit={async e => {
                e.preventDefault()
                if (!name.trim()) return
                setSaving(true)
                const data: any = {
                    name,
                    code: code || name.toLowerCase().replace(/\s+/g, '_'),
                    is_variant: isChild ? false : isVariant,
                    parent: isChild ? Number(parentId) : null,
                    color_hex: colorHex || null,
                }
                if (!isChild) {
                    data.show_in_name = showInName
                    data.name_position = namePosition
                    data.short_label = shortLabel || null
                    data.is_required = isRequired
                    data.show_by_default = showByDefault
                    data.requires_barcode = requiresBarcode
                }
                await onSave(data)
                setSaving(false)
                setName(''); setCode(''); setColorHex('')
                setShowInName(false); setNamePosition(99); setShortLabel(''); setIsRequired(false); setShowByDefault(true); setRequiresBarcode(false)
            }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', alignItems: 'end' }}>
                    <div>
                        <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Parent Group</label>
                        <select value={parentId} onChange={e => setParentId(e.target.value)}
                            className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none cursor-pointer">
                            <option value="none">✦ (New Root Group)</option>
                            {groups.map(g => (
                                <option key={g.id} value={g.id}>↳ {g.name} ({g.children.length} values)</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">{isChild ? 'Value Name *' : 'Group Name *'}</label>
                        <input value={name} onChange={e => setName(e.target.value)}
                            placeholder={isChild ? 'e.g. Red, XL, Floral' : 'e.g. Size, Color, Parfum'}
                            className="w-full text-[12px] font-mono font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none"
                            autoFocus />
                    </div>
                    <div>
                        <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Code</label>
                        <input value={code} onChange={e => setCode(e.target.value)} placeholder="auto from name"
                            className="w-full text-[12px] font-mono font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none" />
                    </div>
                    {!isChild && (
                        <div>
                            <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Type</label>
                            <select value={isVariant ? 'variant' : 'classify'} onChange={e => setIsVariant(e.target.value === 'variant')}
                                className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none cursor-pointer">
                                <option value="classify">🏷️ Tag (classification only)</option>
                                <option value="variant">📦 Variant (creates SKUs)</option>
                            </select>
                        </div>
                    )}
                    {isChild && (
                        <div>
                            <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Color</label>
                            <div className="flex items-center gap-1.5">
                                <input type="color" value={colorHex || '#666666'} onChange={e => setColorHex(e.target.value)}
                                    className="w-8 h-8 rounded-lg cursor-pointer flex-shrink-0" />
                                <input value={colorHex} onChange={e => setColorHex(e.target.value)} placeholder="optional"
                                    className="flex-1 text-[12px] font-mono font-bold px-2 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none" />
                            </div>
                        </div>
                    )}
                    <div>
                        <button type="submit" disabled={saving}
                            className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-4 py-2 rounded-xl transition-all whitespace-nowrap"
                            style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                            {isChild ? 'Add Value' : 'Create Group'}
                        </button>
                    </div>
                </div>

                {/* ── Advanced Rules (Nomenclature + Governance) ── */}
                {showAdvanced && !isChild && (
                    <div className="mt-4 pt-3 border-t border-app-border/30 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                            {/* Nomenclature Section */}
                            <div className="space-y-3">
                                <div className="text-[9px] font-black text-app-warning uppercase tracking-widest">📝 Nomenclature</div>

                                <ToggleRow
                                    label="Show in Name"
                                    description="Include values in auto-generated product name"
                                    checked={showInName}
                                    onChange={setShowInName}
                                    color="bg-amber-500"
                                />

                                {showInName && (
                                    <div className="ml-2 pl-3 border-l-2 border-amber-500/30 space-y-2 animate-in fade-in duration-150">
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Position</label>
                                                <input type="number" min={0} max={99} value={namePosition} onChange={e => setNamePosition(parseInt(e.target.value) || 0)}
                                                    className="w-full text-[12px] font-mono font-bold px-2.5 py-1.5 bg-app-bg border border-app-border/50 rounded-lg outline-none" />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Short Label</label>
                                                <input value={shortLabel} onChange={e => setShortLabel(e.target.value)} placeholder="e.g. ml, kg"
                                                    className="w-full text-[12px] font-mono font-bold px-2.5 py-1.5 bg-app-bg border border-app-border/50 rounded-lg outline-none" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Governance Section */}
                            <div className="space-y-3">
                                <div className="text-[9px] font-black text-app-primary uppercase tracking-widest">🔒 Governance</div>

                                <ToggleRow
                                    label="Required"
                                    description="Must select a value when creating products"
                                    checked={isRequired}
                                    onChange={setIsRequired}
                                    color="bg-red-500"
                                />

                                <ToggleRow
                                    label="Visible by Default"
                                    description="Show expanded in product forms"
                                    checked={showByDefault}
                                    onChange={setShowByDefault}
                                    color="bg-app-primary"
                                />

                                <ToggleRow
                                    label="Requires Barcode"
                                    description="Products with this attribute need individual barcodes"
                                    checked={requiresBarcode}
                                    onChange={setRequiresBarcode}
                                    color="bg-orange-500"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </form>
        </div>
    )
}

/* ── Toggle Row Component ─────────────────── */
function ToggleRow({ label, description, checked, onChange, color }: {
    label: string; description: string; checked: boolean; onChange: (v: boolean) => void; color: string;
}) {
    return (
        <label className="flex items-center justify-between cursor-pointer group">
            <div className="pr-4">
                <span className="text-[10px] font-black text-app-foreground uppercase tracking-wider block">{label}</span>
                <span className="text-[8px] text-app-muted-foreground block leading-tight">{description}</span>
            </div>
            <div onClick={() => onChange(!checked)} className={`w-8 h-4 rounded-full transition-all relative shrink-0 ${checked ? color : 'bg-app-border'}`}>
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-app-surface transition-all ${checked ? 'left-4.5' : 'left-0.5'}`} />
            </div>
        </label>
    )
}

/* ── Add Value Inline Form ──────────────── */
export function AddValueForm({ groupId, groupName, onSave, onCancel }: {
    groupId: number; groupName: string
    onSave: (data: { name: string; code?: string; color_hex?: string }) => Promise<void>
    onCancel: () => void
}) {
    const [name, setName] = useState('')
    const [code, setCode] = useState('')
    const [colorHex, setColorHex] = useState('')
    const [saving, setSaving] = useState(false)

    return (
        <div className="py-2 px-4 animate-in fade-in slide-in-from-top-1 duration-150 border-b border-app-border/30"
            style={{ marginLeft: '22px', paddingLeft: '32px', background: 'color-mix(in srgb, var(--app-primary) 2%, transparent)' }}>
            <form className="flex items-center gap-2" onSubmit={async e => {
                e.preventDefault()
                if (!name.trim()) return
                setSaving(true)
                await onSave({ name, code: code || undefined, color_hex: colorHex || undefined })
                setSaving(false)
                setName(''); setCode(''); setColorHex('')
            }}>
                <span className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest flex-shrink-0">{groupName} →</span>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Value name"
                    className="flex-1 min-w-0 text-[12px] font-bold px-2.5 py-1.5 bg-app-bg border border-app-border/50 rounded-lg text-app-foreground outline-none" autoFocus />
                <input value={code} onChange={e => setCode(e.target.value)} placeholder="Code"
                    className="w-20 text-[12px] font-mono font-bold px-2 py-1.5 bg-app-bg border border-app-border/50 rounded-lg text-app-foreground outline-none hidden md:block" />
                <input type="color" value={colorHex || '#666666'} onChange={e => setColorHex(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer flex-shrink-0" title="Color (optional)" />
                <button type="submit" disabled={saving} className="p-1.5 bg-app-primary text-white rounded-lg hover:brightness-110 transition-all flex-shrink-0">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                </button>
                <button type="button" onClick={onCancel} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground transition-colors flex-shrink-0">
                    <X size={13} />
                </button>
            </form>
        </div>
    )
}

/* ── Edit Modal ──────────────────────────── */
export function EditModal({ item, tree, onSave, onCancel }: {
    item: { id: number; parentId: number | null }
    tree: AttributeGroup[]
    onSave: (id: number, data: any) => Promise<void>
    onCancel: () => void
}) {
    let current: any = null
    if (item.parentId) {
        const group = tree.find(g => g.id === item.parentId)
        const child = group?.children.find(c => c.id === item.id)
        if (child) current = child
    } else {
        const group = tree.find(g => g.id === item.id)
        if (group) current = group
    }

    const [name, setName] = useState((current?.name as string) || '')
    const [code, setCode] = useState((current?.code as string) || '')
    const [isVariant, setIsVariant] = useState((current?.is_variant as boolean) || false)
    const [colorHex, setColorHex] = useState((current?.color_hex as string) || '')
    // V3 Nomenclature state (root groups only)
    const [showInName, setShowInName] = useState((current?.show_in_name as boolean) || false)
    const [namePosition, setNamePosition] = useState((current?.name_position as number) ?? 99)
    const [shortLabel, setShortLabel] = useState((current?.short_label as string) || '')
    const [isRequired, setIsRequired] = useState((current?.is_required as boolean) || false)
    const [showByDefault, setShowByDefault] = useState((current?.show_by_default as boolean) ?? true)
    const [requiresBarcode, setRequiresBarcode] = useState((current?.requires_barcode as boolean) || false)
    const [saving, setSaving] = useState(false)

    if (!current) return null

    const isRootGroup = item.parentId === null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
            <div className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <div className="px-5 py-3 flex items-center justify-between flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <Pencil size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-app-foreground">Edit {isRootGroup ? 'Attribute Group' : 'Value'}</h3>
                            <p className="text-[10px] font-bold text-app-muted-foreground">{current.name}</p>
                        </div>
                    </div>
                    <button onClick={onCancel} className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <X size={16} />
                    </button>
                </div>
                <form className="p-5 space-y-3 overflow-y-auto custom-scrollbar" onSubmit={async e => {
                    e.preventDefault(); setSaving(true)
                    const data: any = { name, code, color_hex: colorHex || null }
                    if (isRootGroup) {
                        data.is_variant = isVariant
                        data.show_in_name = showInName
                        data.name_position = namePosition
                        data.short_label = shortLabel || null
                        data.is_required = isRequired
                        data.show_by_default = showByDefault
                        data.requires_barcode = requiresBarcode
                    }
                    await onSave(item.id, data)
                    setSaving(false)
                }}>
                    <div>
                        <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Name</label>
                        <input value={name} onChange={e => setName(e.target.value)} className="w-full font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl outline-none" autoFocus />
                    </div>
                    <div>
                        <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Code</label>
                        <input value={code} onChange={e => setCode(e.target.value)} className="w-full font-mono px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl outline-none" />
                    </div>
                    {isRootGroup && (
                        <>
                            <div>
                                <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Type</label>
                                <select value={isVariant ? 'variant' : 'classify'} onChange={e => setIsVariant(e.target.value === 'variant')} className="w-full font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl outline-none cursor-pointer">
                                    <option value="classify">🏷️ Tag (classification only)</option>
                                    <option value="variant">📦 Variant (creates SKUs)</option>
                                </select>
                            </div>

                            {/* ── Nomenclature Section ── */}
                            <div className="pt-2 mt-2 border-t border-app-border/30">
                                <div className="text-[9px] font-black text-app-warning uppercase tracking-widest mb-3">📝 Nomenclature Rules</div>

                                <ToggleRow label="Show in Product Name" description="Values appear in auto-generated display name"
                                    checked={showInName} onChange={setShowInName} color="bg-amber-500" />

                                {showInName && (
                                    <div className="animate-in fade-in duration-150 space-y-2 ml-2 mt-1 pl-3 border-l-2 border-amber-500/30">
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Name Position</label>
                                                <input type="number" min={0} max={99} value={namePosition} onChange={e => setNamePosition(parseInt(e.target.value) || 0)}
                                                    className="w-full text-[12px] font-mono font-bold px-2.5 py-1.5 bg-app-bg border border-app-border/50 rounded-lg outline-none" />
                                                <div className="text-[8px] text-app-muted-foreground mt-0.5">0 = first after base name</div>
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Short Label</label>
                                                <input value={shortLabel} onChange={e => setShortLabel(e.target.value)} placeholder="e.g. ml, kg, L"
                                                    className="w-full text-[12px] font-mono font-bold px-2.5 py-1.5 bg-app-bg border border-app-border/50 rounded-lg outline-none" />
                                                <div className="text-[8px] text-app-muted-foreground mt-0.5">Suffix: &quot;180&quot; + &quot;ml&quot; → &quot;180ml&quot;</div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ── Governance Section ── */}
                            <div className="pt-2 mt-2 border-t border-app-border/30">
                                <div className="text-[9px] font-black text-app-primary uppercase tracking-widest mb-3">🔒 Governance</div>

                                <div className="space-y-2">
                                    <ToggleRow label="Required" description="Must select a value in linked categories"
                                        checked={isRequired} onChange={setIsRequired} color="bg-red-500" />

                                    <ToggleRow label="Visible by Default" description="Show expanded in Add/Edit Product form"
                                        checked={showByDefault} onChange={setShowByDefault} color="bg-app-primary" />

                                    <ToggleRow label="Requires Barcode" description="Products with this attribute need individual barcodes"
                                        checked={requiresBarcode} onChange={setRequiresBarcode} color="bg-orange-500" />
                                </div>
                            </div>
                        </>
                    )}
                    <div>
                        <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Color Swatch</label>
                        <div className="flex items-center gap-2">
                            <input type="color" value={colorHex || '#666666'} onChange={e => setColorHex(e.target.value)} className="w-10 h-10 rounded-xl cursor-pointer" />
                            <input value={colorHex} onChange={e => setColorHex(e.target.value)} className="flex-1 font-mono px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl outline-none" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onCancel} className="text-[11px] font-bold text-app-muted-foreground border border-app-border px-3 py-1.5 rounded-xl">Cancel</button>
                        <button type="submit" disabled={saving} className="bg-app-primary text-white px-4 py-1.5 rounded-xl font-bold flex items-center gap-1.5">{saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

/* ── Category Link Modal ─────────────────── */
export function CategoryLinkModal({ attributeId, attributeName, currentCategoryIds, allCategories, onSave, onCancel }: {
    attributeId: number; attributeName: string; currentCategoryIds: number[]; allCategories: { id: number; name: string }[];
    onSave: (categoryIds: number[]) => Promise<void>; onCancel: () => void
}) {
    const [selected, setSelected] = useState<Set<number>>(new Set(currentCategoryIds))
    const [catSearch, setCatSearch] = useState('')
    const [saving, setSaving] = useState(false)

    const filteredCats = allCategories.filter(c => !catSearch || c.name.toLowerCase().includes(catSearch.toLowerCase()))

    const toggle = (id: number) => {
        const next = new Set(selected)
        next.has(id) ? next.delete(id) : next.add(id)
        setSelected(next)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-app-bg/60 backdrop-blur-md" onClick={e => e.target === e.currentTarget && onCancel()}>
            <div className="w-full max-w-md bg-app-surface border border-app-border rounded-3xl overflow-hidden flex flex-col max-h-[70vh] shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="px-5 py-3 flex items-center justify-between flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <FolderTree size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-app-foreground">Link Categories</h3>
                            <p className="text-[10px] font-bold text-app-muted-foreground">{attributeName}</p>
                        </div>
                    </div>
                    <button onClick={onCancel} className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <X size={16} />
                    </button>
                </div>
                <div className="p-2 border-b border-app-border"><input value={catSearch} onChange={e => setCatSearch(e.target.value)} placeholder="Filter categories..." className="w-full p-2 text-xs bg-app-bg border-none outline-none font-bold" /></div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    {filteredCats.map(cat => (
                        <div key={cat.id} onClick={() => toggle(cat.id)} className={`flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer ${selected.has(cat.id) ? 'bg-app-primary/5 border-app-primary/30' : 'border-transparent hover:bg-app-surface'}`}>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${selected.has(cat.id) ? 'bg-app-primary border-app-primary text-white' : 'border-app-border'}`}>{selected.has(cat.id) && <Check size={10} />}</div>
                            <span className="text-xs font-bold text-app-foreground">{cat.name}</span>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-app-border flex justify-end gap-2">
                    <button onClick={onCancel} className="text-xs font-bold px-3 py-2">Cancel</button>
                    <button onClick={async () => { setSaving(true); await onSave(Array.from(selected)); setSaving(false) }} disabled={saving} className="bg-app-primary text-white px-4 py-2 rounded-xl text-xs font-bold">{saving ? 'Saving...' : 'Link Categories'}</button>
                </div>
            </div>
        </div>
    )
}

/* ── Brand Link Modal ─────────────────────── */
export function BrandLinkModal({ attributeId, attributeName, currentBrandIds, allBrands, onSave, onCancel }: {
    attributeId: number; attributeName: string; currentBrandIds: number[]; allBrands: { id: number; name: string; logo?: string | null }[];
    onSave: (brandIds: number[]) => Promise<void>; onCancel: () => void
}) {
    const [selected, setSelected] = useState<Set<number>>(new Set(currentBrandIds))
    const [brandSearch, setBrandSearch] = useState('')
    const [saving, setSaving] = useState(false)

    const filteredBrands = allBrands.filter(b => !brandSearch || b.name.toLowerCase().includes(brandSearch.toLowerCase()))

    const toggle = (id: number) => {
        const next = new Set(selected)
        next.has(id) ? next.delete(id) : next.add(id)
        setSelected(next)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-app-bg/60 backdrop-blur-md" onClick={e => e.target === e.currentTarget && onCancel()}>
            <div className="w-full max-w-md bg-app-surface border border-app-border rounded-3xl overflow-hidden flex flex-col max-h-[70vh] shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="px-5 py-3 flex items-center justify-between flex-shrink-0" style={{ background: 'color-mix(in srgb, #8b5cf6 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#8b5cf6', boxShadow: '0 4px 12px color-mix(in srgb, #8b5cf6 30%, transparent)' }}>
                            <Building2 size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-app-foreground">Link Brands</h3>
                            <p className="text-[10px] font-bold text-app-muted-foreground">{attributeName}</p>
                        </div>
                    </div>
                    <button onClick={onCancel} className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <X size={16} />
                    </button>
                </div>
                <div className="p-2 border-b border-app-border"><input value={brandSearch} onChange={e => setBrandSearch(e.target.value)} placeholder="Filter brands..." className="w-full p-2 text-xs bg-app-bg border-none outline-none font-bold" /></div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    {filteredBrands.length === 0 ? (
                        <div className="text-center text-[11px] text-app-muted-foreground italic py-8">No brands found</div>
                    ) : filteredBrands.map(brand => (
                        <div key={brand.id} onClick={() => toggle(brand.id)} className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${selected.has(brand.id) ? 'bg-purple-500/5 border-purple-500/30' : 'border-transparent hover:bg-app-surface'}`}>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${selected.has(brand.id) ? 'bg-purple-500 border-purple-500 text-white' : 'border-app-border'}`}>{selected.has(brand.id) && <Check size={11} />}</div>
                            <Building2 size={14} className="text-app-muted-foreground" />
                            <span className="text-[12px] font-bold text-app-foreground">{brand.name}</span>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-app-border flex justify-end gap-2">
                    <button onClick={onCancel} className="text-xs font-bold px-3 py-2 text-app-muted-foreground">Cancel</button>
                    <button onClick={async () => { setSaving(true); await onSave(Array.from(selected)); setSaving(false) }} disabled={saving}
                        className="text-white px-4 py-2 rounded-xl text-xs font-bold" style={{ background: '#8b5cf6' }}>{saving ? 'Saving...' : 'Link Brands'}</button>
                </div>
            </div>
        </div>
    )
}
