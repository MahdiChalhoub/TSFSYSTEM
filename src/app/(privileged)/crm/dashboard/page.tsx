'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Activity, Clock, CheckCircle2, AlertCircle, AlertTriangle,
    Calendar, User, Plus, Search, Filter, ArrowRight,
    MessageSquare, Phone, MapPin, Building2, TrendingUp,
    ListChecks, Target, RefreshCw, BarChart3, Users, AlertOctagon,
    ShieldCheck, Zap, ExternalLink, UserCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
    getMyTasks, getDashboardStats
} from "@/app/actions/crm/dashboard"
import { completeActivity } from "@/app/actions/crm/followups"
import { useCurrency } from "@/lib/utils/currency"
import { toast } from "sonner"
import Link from 'next/link'

// ── V2 DESIGN TOKENS ──────────────────────────────────────────
const APP_CARD = "app-card fade-in-up"

export default function RelationshipDashboard() {
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({ due_today: 0, overdue: 0, upcoming: 0, completed_today: 0 })
    const [tasks, setTasks] = useState<any[]>([])
    const [filter, setFilter] = useState('my_tasks')

    useEffect(() => {
        loadDashboard()
    }, [filter])

    async function loadDashboard() {
        setLoading(true)
        try {
            const [s, t] = await Promise.all([
                getDashboardStats(),
                getMyTasks(filter)
            ])
            setStats(s)
            setTasks(t)
        } catch (e) {
            toast.error("Failed to load Relationship Center data")
        } finally {
            setLoading(false)
        }
    }

    const StatCard = ({ title, value, icon: Icon, color, subText }: any) => (
        <div className={APP_CARD} style={{ padding: '1.25rem', borderLeft: `3px solid ${color}` }}>
            <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-xl bg-app-surface border border-app-border flex items-center justify-center">
                    <Icon className="w-4 h-4" style={{ color }} />
                </div>
            </div>
            <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-app-muted-foreground tracking-widest">{title}</p>
                <h3 className="tabular-nums">{value}</h3>
                <p className="text-[10px] text-app-muted-foreground/60">{subText}</p>
            </div>
        </div>
    )

    return (
        <div className="app-page" style={{ padding: 'clamp(0.75rem, 2vw, 1.5rem)', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 fade-in-up">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-[1rem] bg-gradient-to-br from-app-primary to-app-info flex items-center justify-center shadow-lg shadow-app-primary/20">
                        <ShieldCheck size={24} color="#fff" />
                    </div>
                    <div>
                        <p className="text-[0.625rem] font-black uppercase tracking-[0.15em] text-app-muted-foreground/60 mb-0.5">CRM Intelligence</p>
                        <h1 className="italic uppercase">
                            Relationship <span className="text-app-primary">Command Center</span>
                        </h1>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/crm/followups">
                        <Button variant="outline" className="bg-app-surface border-app-border gap-2">
                            <Activity className="w-4 h-4" />
                            Work Queue
                        </Button>
                    </Link>
                    <Link href="/crm/contacts/new">
                        <Button className="bg-app-primary text-white gap-2 px-6 shadow-lg shadow-app-primary/20">
                            <Plus className="w-4 h-4" />
                            New Contact
                        </Button>
                    </Link>
                </div>
            </header>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                <StatCard title="Due Today" value={stats.due_today} icon={Clock} color="var(--app-primary)" subText="Critical assignments" />
                <StatCard title="Overdue" value={stats.overdue} icon={AlertOctagon} color="var(--app-error)" subText="Missed engagement" />
                <StatCard title="Upcoming" value={stats.upcoming} icon={Calendar} color="var(--app-info)" subText="Next 7 days" />
                <StatCard title="Completed" value={stats.completed_today} icon={CheckCircle2} color="var(--app-success)" subText="Action result today" />
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Work Queue (Focused) */}
                <div className="xl:col-span-8 space-y-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-app-primary/10 text-app-primary">
                                <ListChecks className="w-5 h-5" />
                            </div>
                            <h2 className="uppercase italic">Priority <span className="text-app-primary">Radar</span></h2>
                        </div>
                        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-app-surface border border-app-border">
                            {[
                                { id: 'my_tasks', label: 'My Tasks' },
                                { id: 'overdue', label: 'Overdue' },
                                { id: 'today', label: 'Today' }
                            ].map((btn) => (
                                <button
                                    key={btn.id}
                                    onClick={() => setFilter(btn.id)}
                                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${filter === btn.id
                                        ? 'bg-app-primary text-white shadow-md'
                                        : 'text-app-muted-foreground hover:bg-app-surface-2'
                                        }`}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <AnimatePresence mode="wait">
                            {loading ? (
                                <div className="space-y-4">
                                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
                                </div>
                            ) : tasks.length > 0 ? (
                                tasks.map((task, i) => (
                                    <motion.div
                                        key={task.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ delay: i * 0.05 }}
                                        className={`${APP_CARD} group hover:border-app-primary/30 transition-all p-4 border border-app-border/40`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all ${task.status === 'OVERDUE' ? 'bg-app-error/10 border-app-error/20 text-app-error' :
                                                        task.status === 'DUE' ? 'bg-app-warning/10 border-app-warning/20 text-app-warning' :
                                                            'bg-app-primary/10 border-app-primary/20 text-app-primary'
                                                    }`}>
                                                    <Zap size={20} className={task.status === 'OVERDUE' ? 'animate-pulse' : ''} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <h4 className="font-bold text-app-foreground truncate">{task.title || task.subject}</div>
                                                        <Badge variant="outline" className="bg-app-surface-2 border-none text-[8px] font-bold uppercase tracking-widest text-app-muted-foreground px-2 h-4">
                                                            {task.action_type_display || task.action_type}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-[10px] text-app-muted-foreground">
                                                        <div className="flex items-center gap-1.5 font-bold text-app-foreground/80">
                                                            <UserCircle size={14} className="text-app-primary/40" />
                                                            {task.contact_name}
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <Clock size={14} className="text-app-primary/40" />
                                                            Due: {new Date(task.due_date).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 ml-4">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 text-[10px] font-black uppercase tracking-widest text-app-success hover:bg-current/10 gap-1.5 px-3 rounded-lg"
                                                    onClick={() => {
                                                        toast.promise(completeActivity(task.id, 'SUCCESS', 'Handled via Dashboard'), {
                                                            loading: 'Executing...',
                                                            success: () => { loadDashboard(); return "Engagement logged successfully"; },
                                                            error: "Execution failed"
                                                        })
                                                    }}
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    Close
                                                </Button>
                                                <Link href={`/crm/contacts/${task.contact}`}>
                                                    <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-app-muted-foreground hover:text-app-primary hover:bg-app-primary/5">
                                                        <ArrowRight className="w-4 h-4" />
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            ) : (
                                <div className="py-20 flex flex-col items-center justify-center text-center app-card border-dashed border-2 bg-transparent opacity-40">
                                    <ShieldCheck className="w-12 h-12 text-app-muted-foreground/30 mb-4" />
                                    <h3 className="uppercase">Horizon Clear</h3>
                                    <p className="text-[10px] text-app-muted-foreground mt-1">No pending relationship actions detected.</p>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Sidebar Context */}
                <div className="xl:col-span-4 space-y-8">
                    {/* Smart Insights */}
                    <div className={APP_CARD} style={{ padding: '1.5rem', borderRadius: '2rem' }}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-app-info/10 text-app-info">
                                <Target size={18} />
                            </div>
                            <h3 className="uppercase italic">
                                Predictive <span className="text-app-info">Insights</span>
                            </h3>
                        </div>
                        <div className="space-y-4">
                            <div className="p-4 rounded-2xl bg-app-surface border border-app-border hover:border-app-info/30 transition-all group">
                                <div className="flex justify-between items-start mb-1">
                                    <p className="text-xs font-bold text-app-foreground group-hover:text-app-info transition-colors">Dormancy Detected</p>
                                    <Badge className="bg-app-info/10 text-app-info text-[8px] border-none">Analysis</Badge>
                                </div>
                                <p className="text-[10px] text-app-muted-foreground leading-relaxed">3 VIP customers haven't had an interaction in over 30 days. Relationship health is decreasing.</p>
                                <Button variant="link" className="p-0 h-auto text-[9px] font-black uppercase text-app-info mt-2">Surface Leads <ArrowRight size={10} className="ml-1" /></Button>
                            </div>
                            <div className="p-4 rounded-2xl bg-app-error/5 border border-app-error/10 hover:border-app-error/20 transition-all group">
                                <div className="flex justify-between items-start mb-1">
                                    <p className="text-xs font-bold text-app-error">Cadence Violation</p>
                                    <Badge className="bg-app-error/10 text-app-error text-[8px] border-none">Urgent</Badge>
                                </div>
                                <p className="text-[10px] text-app-muted-foreground leading-relaxed">Top-tier supplier performance is degrading. On-time delivery rate dropped by 15% this week.</p>
                                <Link href="/crm/supplier-performance">
                                    <Button variant="link" className="p-0 h-auto text-[9px] font-black uppercase text-app-error mt-2">Audit Scorecard <ExternalLink size={10} className="ml-1" /></Button>
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Operational Efficiency */}
                    <div className={`${APP_CARD} bg-gradient-to-br from-app-success/10 to-transparent border-app-success/10 p-6 rounded-[2rem] relative overflow-hidden group`}>
                        <TrendingUp className="absolute -right-4 -bottom-4 w-24 h-24 text-app-success opacity-[0.05] group-hover:scale-110 transition-transform duration-700" />
                        <div className="text-[10px] font-black uppercase text-app-success tracking-widest mb-4 flex items-center gap-2">
                            <BarChart3 size={14} /> Pipeline Stats
                        </h4>
                        <div className="space-y-6">
                            {[
                                { label: 'Resolution Rate', val: '88%', color: 'var(--app-primary)' },
                                { label: 'Reach Efficiency', val: '124', raw: true, color: 'var(--app-info)' },
                                { label: 'Client Sentiment', val: '4.8', raw: true, color: 'var(--app-success)' }
                            ].map((p) => (
                                <div key={p.label} className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.1em]">
                                        <span className="text-app-muted-foreground/60">{p.label}</span>
                                        <span style={{ color: p.color }}>{p.val}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-app-surface border border-app-border rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-1000" style={{ width: p.raw ? '80%' : p.val, backgroundColor: p.color }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
