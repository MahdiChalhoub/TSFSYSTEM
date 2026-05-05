'use client'

import { useState, useEffect } from 'react'
import { getReportDefinitions, createReportDefinition, deleteReportDefinition, runReport, getReportDataSources, getReportExecutions } from '@/app/actions/finance/reports'
import { BarChart3, Plus, Play, Download, Trash2, RefreshCw, Database, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, FileSpreadsheet } from 'lucide-react'

type ReportDef = { id: number; name: string; description: string; data_source: string; fields: string[]; default_export_format: string }
type DataSource = { name: string; fields: { field: string; type: string }[] }
type Execution = { id: string; status: string; export_format: string; row_count: number; output_file: string; started_at: string; completed_at: string; error_message: string }

const STATUS_COLORS: Record<string, string> = {
    COMPLETED: 'text-app-primary',
    FAILED: 'text-app-error',
    RUNNING: 'text-app-warning',
}

export default function ReportBuilderPage() {
    const [reports, setReports] = useState<ReportDef[]>([])
    const [sources, setSources] = useState<DataSource[]>([])
    const [selected, setSelected] = useState<ReportDef | null>(null)
    const [executions, setExecutions] = useState<Execution[]>([])
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState(false)
    const [showNew, setShowNew] = useState(false)
    const [expandSource, setExpandSource] = useState<string | null>(null)
    const [form, setForm] = useState({ name: '', description: '', data_source: '', fields: '', default_export_format: 'JSON' })
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

    useEffect(() => { loadAll() }, [])

    async function loadAll() {
        setLoading(true)
        const [r, s] = await Promise.all([getReportDefinitions(), getReportDataSources()])
        setReports(Array.isArray(r) ? r : (r?.results ?? []))
        setSources(Array.isArray(s) ? s : [])
        setLoading(false)
    }

    async function openReport(rep: ReportDef) {
        setSelected(rep)
        const execs = await getReportExecutions(rep.id)
        setExecutions(Array.isArray(execs) ? execs : [])
    }

    async function handleRun(format?: string) {
        if (!selected) return
        setRunning(true)
        try {
            const res = await runReport(selected.id, format)
            showToast(`Report ran: ${res.row_count ?? 0} rows`, 'ok')
            const execs = await getReportExecutions(selected.id)
            setExecutions(Array.isArray(execs) ? execs : [])
        } catch { showToast('Report execution failed', 'err') } finally { setRunning(false) }
    }

    async function handleCreate() {
        if (!form.name || !form.data_source) return showToast('Name and data source are required', 'err')
        try {
            await createReportDefinition({ ...form, fields: form.fields ? form.fields.split(',').map(f => f.trim()) : [] })
            setShowNew(false)
            setForm({ name: '', description: '', data_source: '', fields: '', default_export_format: 'JSON' })
            loadAll()
            showToast('Report created', 'ok')
        } catch { showToast('Failed to create report', 'err') }
    }

    async function handleDelete(id: number) {
        await deleteReportDefinition(id)
        if (selected?.id === id) setSelected(null)
        loadAll()
        showToast('Report deleted', 'ok')
    }

    function showToast(msg: string, type: 'ok' | 'err') {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 4000)
    }

    return (
        <div className="min-h-screen bg-[#070D1B] text-app-foreground p-6 flex flex-col gap-6 bg-app-background">
            {toast && (
                <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-medium border ${toast.type === 'ok' ? 'bg-app-success/80 border-app-success/30 text-app-success' : 'bg-app-error/80 border-app-error/30 text-app-error'}`}>
                    {toast.type === 'ok' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-app-info flex items-center justify-center shadow-lg shadow-blue-900/40">
                        <BarChart3 size={22} className="text-app-primary-foreground" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter text-app-foreground flex items-center gap-4">
                            <div className="w-14 h-14 rounded-[1.5rem] bg-app-primary flex items-center justify-center shadow-lg shadow-indigo-200">
                                <BarChart3 size={28} className="text-app-primary-foreground" />
                            </div>
                            Report <span className="text-app-primary">Builder</span>
                        </h1>
                        <p className="text-sm font-medium text-app-muted-foreground mt-2 uppercase tracking-widest">Custom Financial Reports</p>
                    </div>
                </div>
                <button onClick={() => setShowNew(v => !v)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-app-primary-foreground text-sm font-semibold transition-colors">
                    <Plus size={14} />
                    New Report
                </button>
            </div>

            {/* New report form */}
            {showNew && (
                <div className="bg-[#0F1729] rounded-2xl border border-cyan-800/50 p-6 flex flex-col gap-4">
                    <h3 className="font-semibold text-app-primary-foreground">Create Report Definition</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-app-muted-foreground mb-1 block">Report Name *</label>
                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Monthly Sales Summary" className="w-full bg-[#070D1B] border border-app-border rounded-xl px-3 py-2 text-sm text-app-foreground focus:outline-none focus:border-cyan-600" />
                        </div>
                        <div>
                            <label className="text-xs text-app-muted-foreground mb-1 block">Data Source *</label>
                            <select value={form.data_source} onChange={e => setForm({ ...form, data_source: e.target.value })} className="w-full bg-[#070D1B] border border-app-border rounded-xl px-3 py-2 text-sm text-app-foreground focus:outline-none focus:border-cyan-600">
                                <option value="">Select source...</option>
                                {sources.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-app-muted-foreground mb-1 block">Fields (comma-separated, empty = all)</label>
                            <input value={form.fields} onChange={e => setForm({ ...form, fields: e.target.value })} placeholder="id, name, created_at" className="w-full bg-[#070D1B] border border-app-border rounded-xl px-3 py-2 text-sm text-app-foreground focus:outline-none focus:border-cyan-600" />
                        </div>
                        <div>
                            <label className="text-xs text-app-muted-foreground mb-1 block">Default Export Format</label>
                            <select value={form.default_export_format} onChange={e => setForm({ ...form, default_export_format: e.target.value })} className="w-full bg-[#070D1B] border border-app-border rounded-xl px-3 py-2 text-sm text-app-foreground focus:outline-none focus:border-cyan-600">
                                <option value="JSON">JSON (Preview)</option>
                                <option value="EXCEL">Excel (.xlsx)</option>
                                <option value="CSV">CSV</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleCreate} className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-app-primary-foreground text-sm font-semibold">Create Report</button>
                        <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-xl bg-app-surface hover:bg-app-surface text-app-muted-foreground text-sm">Cancel</button>
                    </div>
                </div>
            )}

            <div className="flex gap-6">
                {/* Reports list + Data sources */}
                <div className="w-1/2 flex flex-col gap-4">
                    <h3 className="text-sm font-semibold text-app-muted-foreground uppercase tracking-wider">My Reports</h3>
                    <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                        {loading ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 bg-app-surface/50 rounded-xl animate-pulse" />) :
                            reports.length === 0 ? <div className="text-sm text-app-muted-foreground py-4 text-center">No reports yet. Create your first one!</div> :
                                reports.map(rep => (
                                    <div key={rep.id} onClick={() => openReport(rep)} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${selected?.id === rep.id ? 'bg-cyan-900/30 border-cyan-700' : 'bg-[#0F1729] border-app-border hover:border-app-border'}`}>
                                        <FileSpreadsheet size={16} className="text-cyan-400 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-app-primary-foreground truncate">{rep.name}</div>
                                            <div className="text-xs text-app-muted-foreground">{rep.data_source} · {rep.default_export_format}</div>
                                        </div>
                                        <button onClick={e => { e.stopPropagation(); handleDelete(rep.id) }} className="p-1.5 rounded-lg hover:bg-app-error/40 text-app-muted-foreground hover:text-app-error transition-colors">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                    </div>

                    {/* Data sources browser */}
                    <h3 className="text-sm font-semibold text-app-muted-foreground uppercase tracking-wider">Available Data Sources</h3>
                    <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                        {sources.map(s => (
                            <div key={s.name} className="bg-[#0F1729] rounded-xl border border-app-border overflow-hidden">
                                <button onClick={() => setExpandSource(expandSource === s.name ? null : s.name)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-app-surface/50 transition-colors">
                                    <Database size={14} className="text-app-info shrink-0" />
                                    <span className="font-mono text-sm text-app-primary-foreground flex-1 text-left">{s.name}</span>
                                    <span className="text-xs text-app-muted-foreground">{s.fields.length} fields</span>
                                    {expandSource === s.name ? <ChevronUp size={12} className="text-app-muted-foreground" /> : <ChevronDown size={12} className="text-app-muted-foreground" />}
                                </button>
                                {expandSource === s.name && (
                                    <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                                        {s.fields.slice(0, 20).map(f => (
                                            <span key={f.field} className="px-2 py-0.5 rounded-md text-xs bg-app-surface text-app-muted-foreground font-mono">{f.field}</span>
                                        ))}
                                        {s.fields.length > 20 && <span className="text-xs text-app-muted-foreground">+{s.fields.length - 20} more</span>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Run panel */}
                <div className="w-1/2 bg-[#0F1729] rounded-2xl border border-app-border p-6 flex flex-col gap-4">
                    {!selected ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-app-muted-foreground gap-3 py-12">
                            <BarChart3 size={48} className="opacity-20" />
                            <p className="text-sm">Select a report to run it</p>
                        </div>
                    ) : (
                        <>
                            <div>
                                <h2 className="text-lg font-bold text-app-primary-foreground">{selected.name}</h2>
                                <p className="text-sm text-app-muted-foreground">{selected.data_source}</p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => handleRun()} disabled={running} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-app-primary-foreground text-sm font-semibold disabled:opacity-50">
                                    {running ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                                    {running ? 'Running...' : 'Run Report'}
                                </button>
                                <button onClick={() => handleRun('EXCEL')} disabled={running} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-app-success hover:bg-app-primary text-app-primary-foreground text-sm font-semibold disabled:opacity-50">
                                    <Download size={14} />
                                    Excel
                                </button>
                                <button onClick={() => handleRun('CSV')} disabled={running} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-app-surface hover:bg-app-surface text-app-primary-foreground text-sm font-semibold disabled:opacity-50">
                                    <Download size={14} />
                                    CSV
                                </button>
                            </div>

                            <div>
                                <h3 className="text-xs font-semibold text-app-muted-foreground uppercase tracking-wider mb-2">Execution History</h3>
                                {executions.length === 0 ? (
                                    <div className="text-sm text-app-muted-foreground py-4 text-center">No executions yet</div>
                                ) : (
                                    <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                                        {executions.map(ex => (
                                            <div key={ex.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#070D1B] border border-app-border">
                                                {ex.status === 'COMPLETED' ? <CheckCircle size={14} className="text-app-primary shrink-0" /> : ex.status === 'FAILED' ? <XCircle size={14} className="text-app-error shrink-0" /> : <Clock size={14} className="text-app-warning shrink-0" />}
                                                <div className="flex-1 min-w-0">
                                                    <div className={`text-xs font-semibold ${STATUS_COLORS[ex.status] || 'text-app-muted-foreground'}`}>{ex.status}</div>
                                                    <div className="text-xs text-app-muted-foreground">{ex.export_format} · {ex.row_count ?? 0} rows · {ex.started_at ? new Date(ex.started_at).toLocaleString() : '—'}</div>
                                                    {ex.error_message && <div className="text-xs text-app-error mt-1 truncate">{ex.error_message}</div>}
                                                </div>
                                                {ex.output_file && (
                                                    <a href={ex.output_file} download className="p-1.5 rounded-lg bg-app-surface hover:bg-app-surface text-app-muted-foreground">
                                                        <Download size={12} />
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
