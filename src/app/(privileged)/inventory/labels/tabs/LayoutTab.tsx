'use client'

import { useState, useTransition, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
    Layout, Plus, Copy, Code2, Eye, Trash2, Save,
    Loader2, Monitor, Barcode, QrCode,
} from 'lucide-react'
import {
    listLabelTemplates, createLabelTemplate, updateLabelTemplate,
    deleteLabelTemplate, duplicateLabelTemplate, previewLabelTemplate,
    type LabelTemplate, type LabelTemplateInput,
} from '@/app/actions/labels'

const v = (name: string) => `var(${name})`
const soft = (varName: string, pct = 10) => ({ backgroundColor: `color-mix(in srgb, ${v(varName)} ${pct}%, transparent)` })
const grad = (varName: string) => ({ background: `linear-gradient(135deg, ${v(varName)}, color-mix(in srgb, ${v(varName)} 80%, black))` })

const VARIABLES = [
    'name', 'price', 'barcode', 'sku', 'unit', 'category', 'supplier',
    'packaging_name', 'date', 'note', 'variant', 'lot', 'weight',
]

type TemplateRow = LabelTemplate & {
    is_system?: boolean
    is_default?: boolean
    version?: string | number
}

interface Props {
    initialTemplates: TemplateRow[]
}

export default function LayoutTab({ initialTemplates }: Props) {
    const [isPending, startTransition] = useTransition()
    const [templates, setTemplates] = useState<TemplateRow[]>(initialTemplates)
    const [editId, setEditId] = useState<number | null>(null)
    const [editorOpen, setEditorOpen] = useState(false)
    const [form, setForm] = useState<LabelTemplateInput>({})
    const [previewHtml, setPreviewHtml] = useState('')
    const [previewCss, setPreviewCss] = useState('')
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _previewRef = useRef<HTMLIFrameElement>(null)

    const editTemplate = useCallback((template: Partial<TemplateRow>) => {
        setForm({
            name: template.name || '', label_type: template.label_type || 'SHELF',
            description: template.description || '',
            html_template: template.html_template || '',
            css_template: template.css_template || '',
            label_width_mm: template.label_width_mm || 50,
            label_height_mm: template.label_height_mm || 30,
            orientation: template.orientation || 'LANDSCAPE',
            dpi: template.dpi || 203,
            columns: template.columns || 3, rows: template.rows || 10,
            gap_horizontal_mm: template.gap_horizontal_mm || 2,
            gap_vertical_mm: template.gap_vertical_mm || 2,
            margin_top_mm: template.margin_top_mm || 5,
            margin_right_mm: template.margin_right_mm || 5,
            margin_bottom_mm: template.margin_bottom_mm || 5,
            margin_left_mm: template.margin_left_mm || 5,
            supports_barcode: template.supports_barcode ?? true,
            supports_qr: template.supports_qr ?? false,
            default_font_size: template.default_font_size || 12,
        })
        setEditId(template.id || null)
        setEditorOpen(true)
        setPreviewHtml('')
    }, [])

    const newTemplate = useCallback(() => {
        editTemplate({
            name: '', label_type: 'SHELF', description: '',
            html_template: '<div style="padding: 4px; text-align: center;">\n  <h3>{name}</h3>\n  <p style="font-size: 24px; font-weight: bold;">{price}</p>\n  <div style="font-family: monospace; font-size: 14px;">{barcode}</div>\n  <small>{sku} — {unit}</small>\n</div>',
            css_template: '',
            label_width_mm: 50, label_height_mm: 30, orientation: 'LANDSCAPE',
        })
        setEditId(null)
    }, [editTemplate])

    const handleSave = useCallback(() => {
        startTransition(async () => {
            try {
                const res = editId
                    ? await updateLabelTemplate(editId, form)
                    : await createLabelTemplate(form)
                if (res?.id) {
                    toast.success(editId ? 'Template updated' : 'Template created')
                    const fresh = await listLabelTemplates()
                    setTemplates(fresh?.results || [])
                    setEditorOpen(false)
                } else toast.error(res?.error || res?.detail || 'Save failed')
            } catch { toast.error('Save failed') }
        })
    }, [editId, form])

    const handleDelete = useCallback((id: number) => {
        startTransition(async () => {
            await deleteLabelTemplate(id)
            const fresh = await listLabelTemplates()
            setTemplates(fresh?.results || [])
            toast.success('Template deleted')
        })
    }, [])

    const handleDuplicate = useCallback((id: number) => {
        startTransition(async () => {
            await duplicateLabelTemplate(id)
            const fresh = await listLabelTemplates()
            setTemplates(fresh?.results || [])
            toast.success('Template duplicated')
        })
    }, [])

    const handlePreview = useCallback(() => {
        startTransition(async () => {
            if (editId) {
                const res = await previewLabelTemplate(editId)
                if (res?.html) { setPreviewHtml(res.html); setPreviewCss(res.css || '') }
            } else {
                let html = form.html_template || ''
                const sample: Record<string, string> = { name: 'Sample Product', price: '29.99', barcode: '5901234123457', sku: 'SKU-001', unit: 'KG', category: 'Beverages', supplier: 'ACME', packaging_name: 'Box of 12', date: new Date().toLocaleDateString(), note: '', variant: '', lot: '', weight: '1.5' }
                for (const [k, val] of Object.entries(sample)) html = html.replaceAll(`{${k}}`, val)
                setPreviewHtml(html)
                setPreviewCss(form.css_template || '')
            }
        })
    }, [editId, form])

    const insertVariable = useCallback((varName: string) => {
        setForm(prev => ({ ...prev, html_template: (prev.html_template || '') + `{${varName}}` }))
    }, [])

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
            {/* ── Template List ── */}
            <div className="bg-app-surface rounded-2xl border border-app-border/50 overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 340px)' }}>
                <div className="px-4 py-3 border-b border-app-border/50 bg-app-background shrink-0 flex items-center justify-between">
                    <h3 className="flex items-center gap-2"><Layout size={16} style={{ color: v('--app-primary') }} /> Templates</h3>
                    <button onClick={newTemplate} className="flex items-center gap-1 px-3 h-7 rounded-lg text-white text-[10px] font-bold" style={grad('--app-primary')}><Plus size={12} /> New</button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                    {templates.length === 0 ? (
                        <div className="py-12 text-center"><Layout size={28} className="mx-auto text-app-muted-foreground opacity-20" /><p className="text-[10px] text-app-muted-foreground mt-2">No templates</p></div>
                    ) : templates.map(t => (
                        <div key={t.id} className={`group p-3 rounded-xl border transition-colors cursor-pointer ${editId === t.id ? 'border-app-primary bg-app-primary/5' : 'border-app-border/30 hover:bg-app-background/50'}`} onClick={() => editTemplate(t)}>
                            <div className="flex items-center justify-between">
                                <span className="text-[12px] font-bold text-app-foreground">{t.name}</span>
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => { e.stopPropagation(); handleDuplicate(t.id) }} className="p-1 rounded hover:bg-app-primary/10"><Copy size={11} style={{ color: v('--app-primary') }} /></button>
                                    {!t.is_system && <button onClick={(e) => { e.stopPropagation(); handleDelete(t.id) }} className="p-1 rounded hover:bg-app-error/10"><Trash2 size={11} className="text-app-error" /></button>}
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold" style={{ ...soft('--app-info', 10), color: v('--app-info') }}>{t.label_type}</span>
                                <span className="text-[9px] text-app-muted-foreground">v{t.version}</span>
                                {t.is_system && <span className="text-[8px] font-bold text-app-warning">SYSTEM</span>}
                                {t.is_default && <span className="text-[8px] font-bold" style={{ color: v('--app-success') }}>DEFAULT</span>}
                                <span className="text-[9px] text-app-muted-foreground ml-auto">{t.label_width_mm}×{t.label_height_mm}mm</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Editor ── */}
            <div className="bg-app-surface rounded-2xl border border-app-border/50 overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 340px)' }}>
                {!editorOpen ? (
                    <div className="flex-1 flex items-center justify-center"><div className="text-center"><Layout size={40} className="mx-auto text-app-muted-foreground opacity-20" /><p className="text-[11px] text-app-muted-foreground mt-2">Select or create a template</p></div></div>
                ) : (
                    <>
                        {/* Top bar */}
                        <div className="px-4 py-3 border-b border-app-border/50 bg-app-background shrink-0 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Template name"
                                    className="h-8 px-3 rounded-lg border border-app-border bg-app-surface text-[12px] font-bold text-app-foreground w-[180px] outline-none" />
                                <select value={form.label_type} onChange={e => setForm(p => ({ ...p, label_type: e.target.value }))}
                                    className="h-8 px-2 rounded-lg border border-app-border bg-app-surface text-[10px] font-bold text-app-foreground outline-none">
                                    <option value="SHELF">Shelf</option><option value="BARCODE">Barcode</option><option value="PACKAGING">Packaging</option><option value="FRESH">Fresh</option><option value="CUSTOM">Custom</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={handlePreview} className="flex items-center gap-1 px-3 h-7 rounded-lg border border-app-border text-[10px] font-bold text-app-foreground hover:bg-app-background"><Eye size={12} /> Preview</button>
                                <button onClick={handleSave} disabled={isPending} className="flex items-center gap-1 px-4 h-7 rounded-lg text-white text-[10px] font-bold" style={grad('--app-primary')}>{isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save</button>
                            </div>
                        </div>

                        {/* Variable picker */}
                        <div className="px-4 py-2 border-b border-app-border/30 bg-app-background/50 shrink-0 flex items-center gap-2 overflow-x-auto">
                            <span className="text-[9px] font-bold text-app-muted-foreground shrink-0">Variables:</span>
                            {VARIABLES.map(v2 => (
                                <button key={v2} onClick={() => insertVariable(v2)}
                                    className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold text-app-foreground border border-app-border/30 hover:bg-app-primary/10 whitespace-nowrap shrink-0">
                                    {'{'}{v2}{'}'}
                                </button>
                            ))}
                        </div>

                        {/* Split: HTML + CSS editors + Preview */}
                        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
                            {/* Code side */}
                            <div className="flex flex-col border-r border-app-border/30 overflow-hidden">
                                <div className="px-3 py-1.5 border-b border-app-border/30 bg-app-background/50 flex items-center gap-2 shrink-0">
                                    <Code2 size={12} style={{ color: v('--app-primary') }} /><span className="text-[10px] font-bold text-app-foreground">HTML</span>
                                </div>
                                <textarea value={form.html_template} onChange={e => setForm(p => ({ ...p, html_template: e.target.value }))}
                                    className="flex-[3] p-3 bg-app-background text-[11px] font-mono text-app-foreground resize-none outline-none border-b border-app-border/30"
                                    placeholder="<div>...</div>" spellCheck={false} />
                                <div className="px-3 py-1.5 border-b border-app-border/30 bg-app-background/50 flex items-center gap-2 shrink-0">
                                    <Code2 size={12} style={{ color: v('--app-info') }} /><span className="text-[10px] font-bold text-app-foreground">CSS</span>
                                </div>
                                <textarea value={form.css_template} onChange={e => setForm(p => ({ ...p, css_template: e.target.value }))}
                                    className="flex-1 p-3 bg-app-background text-[11px] font-mono text-app-foreground resize-none outline-none"
                                    placeholder="h3 { ... }" spellCheck={false} />
                            </div>

                            {/* Preview side */}
                            <div className="flex flex-col overflow-hidden">
                                <div className="px-3 py-1.5 border-b border-app-border/30 bg-app-background/50 flex items-center gap-2 shrink-0">
                                    <Monitor size={12} style={{ color: v('--app-success') }} />
                                    <span className="text-[10px] font-bold text-app-foreground">Live Preview</span>
                                    <span className="text-[9px] text-app-muted-foreground ml-auto">{form.label_width_mm}×{form.label_height_mm}mm</span>
                                </div>
                                <div className="flex-1 overflow-auto p-4 bg-[#f0f0f0] flex items-start justify-center">
                                    {previewHtml ? (
                                        <div className="bg-app-surface shadow-lg border" style={{ width: `${Number(form.label_width_mm) * 3.78}px`, minHeight: `${Number(form.label_height_mm) * 3.78}px`, overflow: 'hidden' }}>
                                            <style dangerouslySetInnerHTML={{ __html: previewCss }} />
                                            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                                        </div>
                                    ) : (
                                        <div className="text-center py-12"><Eye size={28} className="mx-auto opacity-20" style={{ color: v('--app-muted-foreground') }} /><p className="text-[10px] mt-2" style={{ color: v('--app-muted-foreground') }}>Click <b>Preview</b> to render</p></div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Dimensions bar */}
                        <div className="px-4 py-2 border-t border-app-border/50 bg-app-background shrink-0 flex items-center gap-4 overflow-x-auto">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-app-muted-foreground">Width:</span>
                                <input type="number" value={form.label_width_mm ?? ''} onChange={e => setForm(p => ({ ...p, label_width_mm: Number(e.target.value) }))} className="w-14 h-6 px-1.5 rounded border border-app-border bg-app-surface text-[10px] text-center text-app-foreground outline-none" />
                                <span className="text-[8px] text-app-muted-foreground">mm</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-app-muted-foreground">Height:</span>
                                <input type="number" value={form.label_height_mm ?? ''} onChange={e => setForm(p => ({ ...p, label_height_mm: Number(e.target.value) }))} className="w-14 h-6 px-1.5 rounded border border-app-border bg-app-surface text-[10px] text-center text-app-foreground outline-none" />
                                <span className="text-[8px] text-app-muted-foreground">mm</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-app-muted-foreground">Col:</span>
                                <input type="number" value={form.columns ?? ''} onChange={e => setForm(p => ({ ...p, columns: Number(e.target.value) }))} className="w-10 h-6 px-1.5 rounded border border-app-border bg-app-surface text-[10px] text-center text-app-foreground outline-none" />
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-app-muted-foreground">Row:</span>
                                <input type="number" value={form.rows ?? ''} onChange={e => setForm(p => ({ ...p, rows: Number(e.target.value) }))} className="w-10 h-6 px-1.5 rounded border border-app-border bg-app-surface text-[10px] text-center text-app-foreground outline-none" />
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-app-muted-foreground">DPI:</span>
                                <input type="number" value={form.dpi ?? ''} onChange={e => setForm(p => ({ ...p, dpi: Number(e.target.value) }))} className="w-14 h-6 px-1.5 rounded border border-app-border bg-app-surface text-[10px] text-center text-app-foreground outline-none" />
                            </div>
                            <select value={form.orientation ?? ''} onChange={e => setForm(p => ({ ...p, orientation: e.target.value as LabelTemplate['orientation'] }))} className="h-6 px-1.5 rounded border border-app-border bg-app-surface text-[9px] font-bold text-app-foreground outline-none">
                                <option value="LANDSCAPE">Landscape</option><option value="PORTRAIT">Portrait</option>
                            </select>
                            <label className="flex items-center gap-1 text-[9px] font-bold text-app-muted-foreground"><input type="checkbox" checked={!!form.supports_barcode} onChange={e => setForm(p => ({ ...p, supports_barcode: e.target.checked }))} className="w-3 h-3" /><Barcode size={10} /> Barcode</label>
                            <label className="flex items-center gap-1 text-[9px] font-bold text-app-muted-foreground"><input type="checkbox" checked={!!form.supports_qr} onChange={e => setForm(p => ({ ...p, supports_qr: e.target.checked }))} className="w-3 h-3" /><QrCode size={10} /> QR</label>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
