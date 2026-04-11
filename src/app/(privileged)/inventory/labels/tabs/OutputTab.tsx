'use client'

import { useState, useTransition, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import {
    Printer, Wifi, WifiOff, Plus, Pencil, Trash2, Save,
    CheckCircle2, XCircle, AlertTriangle, Loader2, Zap,
    Settings, Radio, Bluetooth, Usb, FileText, Tag,
} from 'lucide-react'
import {
    listPrinterConfigs, createPrinterConfig, updatePrinterConfig,
    deletePrinterConfig, testPrinterConnection,
} from '@/app/actions/labels'

const v = (name: string) => `var(${name})`
const soft = (varName: string, pct = 10) => ({ backgroundColor: `color-mix(in srgb, ${v(varName)} ${pct}%, transparent)` })
const grad = (varName: string) => ({ background: `linear-gradient(135deg, ${v(varName)}, color-mix(in srgb, ${v(varName)} 80%, black))` })

interface Props {
    initialPrinters: any[]
    sessions: any[]
}

export default function OutputTab({ initialPrinters, sessions }: Props) {
    const [isPending, startTransition] = useTransition()
    const [printers, setPrinters] = useState<any[]>(initialPrinters)
    const [editId, setEditId] = useState<number | null>(null)
    const [formOpen, setFormOpen] = useState(false)
    const [form, setForm] = useState<Record<string, any>>({})

    // Print queue monitor
    const activeSessions = useMemo(() => sessions.filter(s => ['QUEUED', 'PRINTING'].includes(s.status)), [sessions])
    const recentCompleted = useMemo(() => sessions.filter(s => s.status === 'COMPLETED').slice(0, 5), [sessions])

    const editPrinter = useCallback((printer: any) => {
        setForm({
            name: printer.name || '', device_identifier: printer.device_identifier || '',
            model_name: printer.model_name || '', location: printer.location || '',
            printer_type: printer.printer_type || 'THERMAL',
            connection_type: printer.connection_type || 'NETWORK',
            address: printer.address || '', dpi: printer.dpi || 203,
            paper_width_mm: printer.paper_width_mm || '', driver_name: printer.driver_name || '',
            supports_pdf: printer.supports_pdf ?? true, supports_zpl: printer.supports_zpl ?? false,
            supports_epl: printer.supports_epl ?? false, supports_escpos: printer.supports_escpos ?? false,
            supported_label_types: printer.supported_label_types || [],
            default_label_type: printer.default_label_type || '',
            is_default: printer.is_default ?? false, is_active: printer.is_active ?? true,
        })
        setEditId(printer.id || null)
        setFormOpen(true)
    }, [])

    const newPrinter = useCallback(() => {
        editPrinter({})
        setEditId(null)
    }, [editPrinter])

    const handleSave = useCallback(() => {
        startTransition(async () => {
            try {
                const res = editId
                    ? await updatePrinterConfig(editId, form)
                    : await createPrinterConfig(form)
                if (res?.id) {
                    toast.success(editId ? 'Printer updated' : 'Printer added')
                    const fresh = await listPrinterConfigs()
                    setPrinters(fresh?.results || [])
                    setFormOpen(false)
                } else toast.error(res?.error || 'Save failed')
            } catch { toast.error('Save failed') }
        })
    }, [editId, form])

    const handleDelete = useCallback((id: number) => {
        startTransition(async () => {
            await deletePrinterConfig(id)
            const fresh = await listPrinterConfigs()
            setPrinters(fresh?.results || [])
            toast.success('Printer deleted')
        })
    }, [])

    const handleTest = useCallback((id: number) => {
        startTransition(async () => {
            const res = await testPrinterConnection(id)
            if (res?.status === 'PASS') toast.success('Connection test passed')
            else toast.error(`Test failed: ${res?.message || 'Unknown'}`)
            const fresh = await listPrinterConfigs()
            setPrinters(fresh?.results || [])
        })
    }, [])

    const connIcon = (type: string) => {
        switch (type) { case 'USB': return <Usb size={12} />; case 'BLUETOOTH': return <Bluetooth size={12} />; default: return <Radio size={12} /> }
    }

    const statusIcon = (status: string) => {
        switch (status) { case 'PASS': return <CheckCircle2 size={12} style={{ color: v('--app-success') }} />; case 'FAIL': return <XCircle size={12} style={{ color: v('--app-error') }} />; default: return <AlertTriangle size={12} style={{ color: v('--app-warning') }} /> }
    }

    const labelTypes = ['SHELF', 'BARCODE', 'PACKAGING', 'FRESH', 'CUSTOM']

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
            {/* ── Printers ── */}
            <div className="space-y-4">
                {/* Printer list */}
                <div className="bg-app-surface rounded-2xl border border-app-border/50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-app-border/50 bg-app-background flex items-center justify-between">
                        <h3 className="text-[13px] font-black text-app-foreground flex items-center gap-2"><Printer size={16} style={{ color: v('--app-primary') }} /> Printers ({printers.length})</h3>
                        <button onClick={newPrinter} className="flex items-center gap-1 px-3 h-7 rounded-lg text-white text-[10px] font-bold" style={grad('--app-primary')}><Plus size={12} /> Add Printer</button>
                    </div>
                    <div className="p-3 space-y-2">
                        {printers.length === 0 ? (
                            <div className="py-12 text-center"><Printer size={28} className="mx-auto text-app-muted-foreground opacity-20" /><p className="text-[10px] text-app-muted-foreground mt-2">No printers configured</p></div>
                        ) : printers.map(p => (
                            <div key={p.id} className="group p-3 rounded-xl border border-app-border/30 hover:bg-app-background/50 transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {statusIcon(p.test_status || 'UNKNOWN')}
                                        <span className="text-[12px] font-bold text-app-foreground">{p.name}</span>
                                        {p.is_default && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold" style={{ ...soft('--app-success', 10), color: v('--app-success') }}>DEFAULT</span>}
                                        {!p.is_active && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold" style={{ ...soft('--app-error', 10), color: v('--app-error') }}>INACTIVE</span>}
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleTest(p.id)} disabled={isPending} className="p-1.5 rounded-lg hover:bg-app-primary/10" title="Test"><Zap size={12} style={{ color: v('--app-primary') }} /></button>
                                        <button onClick={() => editPrinter(p)} className="p-1.5 rounded-lg hover:bg-app-primary/10" title="Edit"><Pencil size={12} style={{ color: v('--app-primary') }} /></button>
                                        <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-rose-500/10" title="Delete"><Trash2 size={12} className="text-rose-500" /></button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-app-muted-foreground">
                                    <span className="flex items-center gap-1">{connIcon(p.connection_type)} {p.connection_type}</span>
                                    <span>{p.printer_type}</span>
                                    {p.model_name && <span>{p.model_name}</span>}
                                    {p.location && <span>📍 {p.location}</span>}
                                    {p.dpi && <span>{p.dpi} DPI</span>}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1">
                                    {p.default_label_type && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold" style={{ ...soft('--app-info', 10), color: v('--app-info') }}>⇒ {p.default_label_type}</span>}
                                    {p.supports_zpl && <span className="px-1 py-0.5 rounded text-[7px] font-bold bg-app-background text-app-muted-foreground">ZPL</span>}
                                    {p.supports_epl && <span className="px-1 py-0.5 rounded text-[7px] font-bold bg-app-background text-app-muted-foreground">EPL</span>}
                                    {p.supports_escpos && <span className="px-1 py-0.5 rounded text-[7px] font-bold bg-app-background text-app-muted-foreground">ESC/POS</span>}
                                    {p.supports_pdf && <span className="px-1 py-0.5 rounded text-[7px] font-bold bg-app-background text-app-muted-foreground">PDF</span>}
                                </div>
                                {p.last_tested_at && <p className="text-[9px] text-app-muted-foreground mt-1">Last tested: {new Date(p.last_tested_at).toLocaleString()}</p>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Printer Form (inline) ── */}
                {formOpen && (
                    <div className="bg-app-surface rounded-2xl border border-app-border/50 p-4 space-y-3">
                        <h4 className="text-[12px] font-black text-app-foreground">{editId ? 'Edit Printer' : 'Add Printer'}</h4>
                        <div className="grid grid-cols-2 gap-3">
                            {[['name', 'Printer Name'], ['model_name', 'Model'], ['location', 'Location'], ['address', 'IP / Address'], ['device_identifier', 'Device ID'], ['driver_name', 'Driver']].map(([key, label]) => (
                                <div key={key}>
                                    <label className="text-[9px] font-bold text-app-muted-foreground uppercase">{label}</label>
                                    <input value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} className="w-full h-8 px-3 rounded-lg border border-app-border bg-app-background text-[11px] text-app-foreground outline-none mt-0.5" />
                                </div>
                            ))}
                            <div>
                                <label className="text-[9px] font-bold text-app-muted-foreground uppercase">Type</label>
                                <select value={form.printer_type} onChange={e => setForm(p => ({ ...p, printer_type: e.target.value }))} className="w-full h-8 px-3 rounded-lg border border-app-border bg-app-background text-[11px] text-app-foreground outline-none mt-0.5">
                                    <option value="THERMAL">Thermal</option><option value="INKJET">Inkjet</option><option value="LASER">Laser</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-app-muted-foreground uppercase">Connection</label>
                                <select value={form.connection_type} onChange={e => setForm(p => ({ ...p, connection_type: e.target.value }))} className="w-full h-8 px-3 rounded-lg border border-app-border bg-app-background text-[11px] text-app-foreground outline-none mt-0.5">
                                    <option value="NETWORK">Network</option><option value="USB">USB</option><option value="BLUETOOTH">Bluetooth</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-app-muted-foreground uppercase">DPI</label>
                                <input type="number" value={form.dpi || ''} onChange={e => setForm(p => ({ ...p, dpi: Number(e.target.value) }))} className="w-full h-8 px-3 rounded-lg border border-app-border bg-app-background text-[11px] text-app-foreground outline-none mt-0.5" />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-app-muted-foreground uppercase">Default Label Type</label>
                                <select value={form.default_label_type} onChange={e => setForm(p => ({ ...p, default_label_type: e.target.value }))} className="w-full h-8 px-3 rounded-lg border border-app-border bg-app-background text-[11px] text-app-foreground outline-none mt-0.5">
                                    <option value="">None</option>{labelTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            {[['supports_pdf', 'PDF'], ['supports_zpl', 'ZPL'], ['supports_epl', 'EPL'], ['supports_escpos', 'ESC/POS'], ['is_default', 'Default'], ['is_active', 'Active']].map(([key, lbl]) => (
                                <label key={key} className="flex items-center gap-1.5 text-[10px] font-bold text-app-muted-foreground cursor-pointer">
                                    <input type="checkbox" checked={!!form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.checked }))} className="w-3.5 h-3.5" /> {lbl}
                                </label>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                            <button onClick={handleSave} disabled={isPending} className="flex items-center gap-1 px-4 h-8 rounded-lg text-white text-[11px] font-bold" style={grad('--app-primary')}>{isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save</button>
                            <button onClick={() => setFormOpen(false)} className="px-4 h-8 rounded-lg border border-app-border text-[11px] font-bold text-app-muted-foreground hover:bg-app-background">Cancel</button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Queue Monitor + Output History ── */}
            <div className="space-y-4">
                {/* Active queue */}
                <div className="bg-app-surface rounded-2xl border border-app-border/50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-app-border/50 bg-app-background">
                        <h3 className="text-[12px] font-black text-app-foreground flex items-center gap-2"><Zap size={14} style={{ color: v('--app-warning') }} /> Active Queue ({activeSessions.length})</h3>
                    </div>
                    <div className="p-3 space-y-1.5">
                        {activeSessions.length === 0 ? (
                            <p className="text-[10px] text-app-muted-foreground text-center py-4">No active print jobs</p>
                        ) : activeSessions.map(s => (
                            <div key={s.id} className="flex items-center justify-between p-2.5 rounded-xl border border-app-border/30">
                                <div>
                                    <span className="text-[11px] font-mono font-bold text-app-foreground">{s.session_code}</span>
                                    <span className="ml-2 text-[10px] text-app-muted-foreground">{s.total_labels} labels</span>
                                </div>
                                <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold" style={{
                                    color: v(s.status === 'PRINTING' ? '--app-warning' : '--app-info'),
                                    ...soft(s.status === 'PRINTING' ? '--app-warning' : '--app-info', 10)
                                }}>{s.status === 'PRINTING' ? '🖨️ Printing...' : '⏳ Queued'}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent outputs */}
                <div className="bg-app-surface rounded-2xl border border-app-border/50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-app-border/50 bg-app-background">
                        <h3 className="text-[12px] font-black text-app-foreground flex items-center gap-2"><FileText size={14} style={{ color: v('--app-success') }} /> Recent Outputs</h3>
                    </div>
                    <div className="p-3 space-y-1.5">
                        {recentCompleted.length === 0 ? (
                            <p className="text-[10px] text-app-muted-foreground text-center py-4">No completed sessions yet</p>
                        ) : recentCompleted.map(s => (
                            <div key={s.id} className="flex items-center justify-between p-2.5 rounded-xl border border-app-border/30">
                                <div>
                                    <span className="text-[11px] font-mono font-bold text-app-foreground">{s.session_code}</span>
                                    <span className="ml-2 text-[9px] text-app-muted-foreground">{s.total_labels} labels</span>
                                </div>
                                <span className="text-[9px] text-app-muted-foreground">{s.completed_at ? new Date(s.completed_at).toLocaleString() : ''}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
