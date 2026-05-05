'use client'

import { useState, useEffect } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { ClipboardList, CheckCircle, Clock, AlertCircle, User } from 'lucide-react'

type ProductTask = {
    id?: number | string
    title?: string
    task_type?: string
    product?: number | string
    product_name?: string
    assigned_to_name?: string
    due_date?: string
    status?: string
}

function asArray(d: unknown): unknown[] {
    if (Array.isArray(d)) return d
    if (d && typeof d === 'object' && 'results' in d) {
        const r = (d as { results?: unknown }).results
        if (Array.isArray(r)) return r
    }
    return []
}

export default function ProductTasksPage() {
    const [tasks, setTasks] = useState<ProductTask[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const res = await erpFetch('/inventory/product-tasks/')
            setTasks(asArray(res) as ProductTask[])
        } catch { setTasks([]) }
        setLoading(false)
    }

    const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)

    const statusIcon = (s: string) => {
        if (s === 'COMPLETED' || s === 'DONE') return <CheckCircle size={14} className="text-app-success" />
        if (s === 'PENDING' || s === 'TODO') return <Clock size={14} className="text-app-warning" />
        return <AlertCircle size={14} className="text-app-error" />
    }

    if (loading) return (
        <div className="min-h-screen layout-container-padding flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
        </div>
    )

    return (
        <div className="min-h-screen layout-container-padding bg-app-bg">
            <div className="mb-6 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, var(--app-primary), var(--app-info))', boxShadow: '0 4px 15px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                    <ClipboardList className="w-6 h-6 text-white" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Inventory Ops</p>
                    <h1>
                        Product <span style={{ color: 'var(--app-primary)' }}>Tasks</span>
                    </h1>
                </div>
            </div>

            <div className="mb-4 flex items-center gap-2">
                {['all', 'PENDING', 'IN_PROGRESS', 'COMPLETED'].map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={{ background: filter === f ? 'var(--app-primary)' : 'var(--app-surface)', color: filter === f ? '#fff' : 'var(--app-foreground)', border: `1px solid ${filter === f ? 'var(--app-primary)' : 'var(--app-border)'}` }}>
                        {f === 'all' ? 'All' : f.replace('_', ' ')}
                    </button>
                ))}
                <span className="ml-auto text-xs font-bold text-app-muted-foreground">{filtered.length} tasks</span>
            </div>

            <div className="space-y-2">
                {filtered.map((task, i) => (
                    <div key={task.id || i} className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        {statusIcon(task.status || 'PENDING')}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-app-foreground truncate">{task.title || task.task_type || 'Task'}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-app-muted-foreground">{task.product_name || `Product #${task.product}`}</span>
                                {task.assigned_to_name && <span className="inline-flex items-center gap-1 text-[10px] text-app-muted-foreground"><User size={9} />{task.assigned_to_name}</span>}
                                {task.due_date && <span className="text-[10px] text-app-muted-foreground">Due: {new Date(task.due_date).toLocaleDateString()}</span>}
                            </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: `color-mix(in srgb, var(--app-${task.status === 'COMPLETED' ? 'success' : task.status === 'IN_PROGRESS' ? 'warning' : 'info'}) 15%, transparent)`, color: `var(--app-${task.status === 'COMPLETED' ? 'success' : task.status === 'IN_PROGRESS' ? 'warning' : 'info'})` }}>
                            {task.status || 'PENDING'}
                        </span>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className="text-center py-16">
                        <ClipboardList size={48} className="mx-auto mb-4 text-app-muted-foreground opacity-30" />
                        <p className="text-sm font-bold text-app-muted-foreground">No product tasks found</p>
                    </div>
                )}
            </div>
        </div>
    )
}
