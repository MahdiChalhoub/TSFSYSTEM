'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Calendar, Clock, AlertCircle, Users, MessageSquare,
    ChevronRight, CheckCircle2, RefreshCw, Filter, Search,
    User, Phone, Mail, ArrowRight, Activity, TrendingUp, TrendingDown,
    Plus, ExternalLink, Zap, CalendarDays, MoreHorizontal,
    PhoneCall, Globe, Eye, Send, ListTodo, History, Settings, UserCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/lib/utils/currency';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { getActivityStats, getActivities, completeActivity, runPolicyScan, rescheduleActivity } from '@/app/actions/crm/followups';
import { getFollowUpContacts } from '@/app/actions/crm/contacts';
import { useTranslation } from '@/hooks/use-translation';

// ── DESIGN TOKENS ──────────────────────────────────────────────
const APP_CARD = "app-card fade-in-up"
const ICON_WRAP = "w-10 h-10 rounded-xl flex items-center justify-center shrink-0"

const CHANNEL_ICONS: Record<string, any> = {
    CALL: PhoneCall, VISIT: Eye, WHATSAPP: MessageSquare,
    EMAIL: Mail, NOTE: ListTodo, SMS: Send, OTHER: Globe,
}
const CHANNEL_COLORS: Record<string, string> = {
    CALL: 'var(--app-info)', VISIT: 'var(--app-success)', WHATSAPP: '#25D366',
    EMAIL: 'var(--app-warning)', NOTE: 'var(--app-muted-foreground)', SMS: 'var(--app-accent)', OTHER: 'var(--app-muted-foreground)',
}

type TabKey = 'queue' | 'history' | 'analytics'

export default function FollowUpBoard() {
    const { t } = useTranslation();
    const { fmt } = useCurrency();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ due_today: 0, overdue: 0, upcoming: 0, completed_today: 0 });
    const [activities, setActivities] = useState<any[]>([]);
    const [riskContacts, setRiskContacts] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<TabKey>('queue');
    const [filterType, setFilterType] = useState<string>('all');

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const [s, a, c] = await Promise.all([
                getActivityStats(),
                getActivities({ mode: 'active', ordering: 'due_date' }),
                getFollowUpContacts('OVERDUE')
            ]);
            setStats(s);
            setActivities(a);
            setRiskContacts(c);
        } catch (e) {
            toast.error("Failed to load follow-up board");
        } finally {
            setLoading(false);
        }
    }

    const filteredActivities = useMemo(() => {
        let list = activities;
        if (filterType !== 'all') {
            list = list.filter(a => a.action_type === filterType);
        }
        if (searchQuery) {
            const s = searchQuery.toLowerCase();
            list = list.filter(a =>
                a.subject?.toLowerCase().includes(s) ||
                a.contact_name?.toLowerCase().includes(s)
            );
        }
        return list;
    }, [activities, searchQuery, filterType]);

    async function handleComplete(id: number) {
        toast.promise(completeActivity(id, 'SUCCESS', 'Completed via Work Queue'), {
            loading: 'Marking as done...',
            success: () => {
                loadData();
                return 'Activity completed successfully';
            },
            error: 'Failed to complete activity'
        });
    }

    if (loading) {
        return (
            <div className="page-container" style={{ padding: 'clamp(0.75rem, 2vw, 1.5rem)' }}>
                <div style={{ height: '3rem', width: '20rem', borderRadius: 'var(--app-radius-sm)', background: 'var(--app-surface-2)', marginBottom: '1.5rem' }} />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    {[1, 2, 3, 4].map(i => <div key={i} className="app-card" style={{ height: '6rem' }} />)}
                </div>
                <div className="app-card" style={{ height: '30rem' }} />
            </div>
        )
    }

    return (
        <div className="app-page" style={{ padding: 'clamp(0.75rem, 2vw, 1.5rem)', maxWidth: '1400px', margin: '0 auto' }}>
            {/* ── Header ────────────────────────────────────────── */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 fade-in-up">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-[1rem] bg-gradient-to-br from-app-primary to-app-info flex items-center justify-center shadow-lg shadow-app-primary/20">
                        <Activity size={24} color="#fff" />
                    </div>
                    <div>
                        <p className="text-[0.625rem] font-black uppercase tracking-[0.15em] text-app-muted-foreground/60 mb-0.5">Commercial Operations</p>
                        <h1 className="italic uppercase">
                            Follow-Up <span className="text-app-primary">Work Queue</span>
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative w-64 mr-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" size={14} />
                        <input
                            placeholder="Search tasks or contacts..."
                            className="w-full pl-9 pr-4 py-2 bg-app-surface border border-app-border rounded-lg text-sm outline-none focus:border-app-primary transition-colors"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button
                        onClick={() => {
                            toast.promise(runPolicyScan(), {
                                loading: 'Scanning relationship policies...',
                                success: () => { loadData(); return 'Policy scan completed'; },
                                error: 'Scan failed'
                            })
                        }}
                        variant="outline"
                        className="bg-app-surface border-app-border text-app-muted-foreground hover:text-app-primary hover:border-app-primary/30"
                    >
                        <Zap size={14} className="mr-2 text-app-primary shadow-[0_0_8px_rgba(var(--app-primary-rgb),0.3)]" /> Scan Policies
                    </Button>
                    <Button onClick={loadData} variant="outline" className="bg-app-surface border-app-border">
                        <RefreshCw size={14} className="mr-2" /> Refresh
                    </Button>
                </div>
            </header>

            {/* ── KPI Grid ────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'Due Today', value: stats.due_today, icon: CalendarDays, color: 'var(--app-primary)', sub: 'Urgent tasks' },
                    { label: 'Overdue', value: stats.overdue, icon: AlertCircle, color: 'var(--app-error)', sub: 'Immediate attention' },
                    { label: 'Risk Contacts', value: riskContacts.length, icon: Users, color: 'var(--app-warning)', sub: 'Interaction drought' },
                    { label: 'Recent Wins', value: stats.completed_today, icon: CheckCircle2, color: 'var(--app-success)', sub: 'Tasks finished today' },
                ].map((kpi, i) => (
                    <div key={i} className={APP_CARD} style={{ padding: '1.25rem', borderLeft: `4px solid ${kpi.color}`, animationDelay: `${i * 40}ms` }}>
                        <div className="flex items-center gap-4">
                            <div className={ICON_WRAP} style={{ background: `${kpi.color}12` }}>
                                <kpi.icon size={18} style={{ color: kpi.color }} />
                            </div>
                            <div>
                                <p className="text-[0.625rem] font-bold uppercase tracking-widest text-app-muted-foreground/60">{kpi.label}</p>
                                <p className="text-2xl font-black text-app-foreground tracking-tighter">{kpi.value}</p>
                                <p className="text-[0.6875rem] text-app-muted-foreground mt-0.5">{kpi.sub}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Main Workspace ──────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Task List (LHS) */}
                <div className="lg:col-span-8 space-y-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-6">
                            {[
                                { key: 'queue', label: 'Work Queue', icon: ListTodo },
                                { key: 'history', label: 'Recent History', icon: History },
                            ].map(t => (
                                <button
                                    key={t.key}
                                    onClick={() => setActiveTab(t.key as TabKey)}
                                    className={`flex items-center gap-2 pb-2 text-sm font-bold tracking-tight transition-all border-b-2 ${activeTab === t.key ? 'text-app-primary border-app-primary' : 'text-app-muted-foreground border-transparent opacity-60 hover:opacity-100'}`}
                                >
                                    <t.icon size={16} />
                                    {t.label}
                                </button>
                            ))}
                        </div>
                        <select
                            className="bg-app-surface border border-app-border rounded-md text-[10px] font-bold uppercase tracking-widest px-2 py-1 outline-none text-app-muted-foreground"
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                        >
                            <option value="all">All Types</option>
                            <option value="CALL">Calls Only</option>
                            <option value="VISIT">Visits Only</option>
                            <option value="EMAIL">Emails Only</option>
                        </select>
                    </div>

                    <div className="space-y-3">
                        {filteredActivities.length > 0 ? filteredActivities.map((act, i) => {
                            const ChIcon = CHANNEL_ICONS[act.action_type] || Activity
                            const chColor = CHANNEL_COLORS[act.action_type] || 'var(--app-primary)'
                            const isOverdue = new Date(act.due_date) < new Date() && act.status !== 'DONE'

                            return (
                                <div
                                    key={act.id}
                                    className={`${APP_CARD} group hover:border-app-primary/30 transition-all p-4`}
                                    style={{ animationDelay: `${150 + i * 30}ms` }}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={ICON_WRAP} style={{ background: `${chColor}12`, border: `1px solid ${chColor}20` }}>
                                            <ChIcon size={18} style={{ color: chColor }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge className={`${isOverdue ? 'bg-app-error/10 text-app-error' : 'bg-app-primary/10 text-app-primary'} text-[9px] font-bold border-none`}>
                                                    {act.action_type}
                                                </Badge>
                                                {isOverdue && <span className="text-[9px] font-black uppercase text-app-error animate-pulse">Overdue</span>}
                                                <span className="text-[10px] text-app-muted-foreground ml-auto font-medium">
                                                    Due: {new Date(act.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                            <h3 className="group-hover:text-app-primary transition-colors truncate">
                                                {act.subject}
                                            </h3>
                                            <div className="flex items-center gap-3 mt-2">
                                                <Link href={`/crm/contacts/${act.contact}`} className="flex items-center gap-1.5 hover:underline decoration-app-primary">
                                                    <div className="w-5 h-5 rounded-md bg-app-surface-2 flex items-center justify-center">
                                                        <User size={10} className="text-app-muted-foreground" />
                                                    </div>
                                                    <span className="text-xs font-bold text-app-muted-foreground/80">{act.contact_name}</span>
                                                </Link>
                                                {act.description && (
                                                    <div className="flex items-center gap-1.5 text-xs text-app-muted-foreground/60 italic truncate">
                                                        <span className="w-1 h-1 rounded-full bg-app-border" />
                                                        {act.description}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-3 text-[10px] font-black uppercase tracking-widest text-app-success hover:bg-app-success/10 hover:text-app-success"
                                                onClick={() => handleComplete(act.id)}
                                            >
                                                <CheckCircle2 size={12} className="mr-1.5" /> Done
                                            </Button>
                                            <Link href={`/crm/contacts/${act.contact}`}>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 px-3 text-[10px] font-black uppercase tracking-widest text-app-primary hover:bg-app-primary/10"
                                                >
                                                    Profile <ArrowRight size={12} className="ml-1.5 text-app-primary/40" />
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            )
                        }) : (
                            <div className="text-center py-20 border-2 border-dashed border-app-border rounded-[2rem] opacity-40">
                                <ListTodo size={48} className="mx-auto mb-4 text-app-muted-foreground" />
                                <p className="text-sm font-bold uppercase tracking-widest">Inbox Zero</p>
                                <p className="text-[10px] mt-1">No pending tasks for the current filters.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar (RHS) */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Relationship Alerts */}
                    <div className={APP_CARD} style={{ animationDelay: '200ms', padding: '1.5rem', borderRadius: '2rem' }}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-app-error/10 text-app-error">
                                <AlertCircle size={18} />
                            </div>
                            <h2 className="uppercase italic">Relationship <span className="text-app-error">Risk</span></h2>
                        </div>

                        <div className="space-y-4">
                            {riskContacts.length > 0 ? riskContacts.slice(0, 6).map((c, i) => (
                                <Link
                                    key={c.id}
                                    href={`/crm/contacts/${c.id}`}
                                    className="flex items-center gap-3 p-3 rounded-2xl hover:bg-app-surface-2 transition-all group border border-transparent hover:border-app-border"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-app-surface border border-app-border flex items-center justify-center shrink-0">
                                        <UserCircle size={20} className="text-app-muted-foreground/40 group-hover:text-app-primary transition-colors" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-app-foreground truncate group-hover:text-app-primary transition-colors">{c.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`text-[10px] font-black ${c.interaction_score < 30 ? 'text-app-error' : 'text-app-warning'}`}>
                                                {c.interaction_score} pts
                                            </span>
                                            <span className="text-[8px] text-app-muted-foreground uppercase font-black tracking-widest bg-app-surface rounded px-1.5 py-0.5 border border-app-border">
                                                {c.followup_status}
                                            </span>
                                        </div>
                                    </div>
                                    <ExternalLink size={14} className="text-app-muted-foreground/20 group-hover:text-app-primary transition-colors" />
                                </Link>
                            )) : (
                                <div className="text-center py-10 opacity-30">
                                    <Users size={32} className="mx-auto mb-2" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">No Alerts</p>
                                </div>
                            )}
                        </div>

                        {riskContacts.length > 6 && (
                            <Link href="/crm/contacts?followup_status=OVERDUE">
                                <Button variant="ghost" className="w-full mt-4 text-[10px] font-black uppercase tracking-widest text-app-primary py-6 rounded-2xl hover:bg-app-primary/5">
                                    View all risk contacts <ArrowRight size={14} className="ml-2" />
                                </Button>
                            </Link>
                        )}
                    </div>

                    {/* Performance Mini-Stats */}
                    <div className={`${APP_CARD} bg-gradient-to-br from-app-primary/10 to-transparent border-app-primary/10 p-6 rounded-[2rem] relative overflow-hidden group`}>
                        <TrendingUp className="absolute -right-4 -bottom-4 w-24 h-24 text-app-primary opacity-[0.05] group-hover:rotate-12 transition-all duration-700" />
                        <h4 className="text-[10px] font-black uppercase text-app-primary tracking-[0.2em] mb-4">Flow Accuracy</h4>
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-3xl font-black italic tracking-tighter text-app-foreground">92%</p>
                                    <p className="text-[9px] font-bold text-app-muted-foreground uppercase tracking-widest">Weekly Accuracy</p>
                                </div>
                                <div className="text-app-success font-black text-xs flex items-center gap-1 mb-1">
                                    <TrendingUp size={14} /> +4%
                                </div>
                            </div>
                            <div className="h-2 w-full bg-app-surface border border-app-border rounded-full overflow-hidden">
                                <div className="h-full bg-app-primary rounded-full shadow-[0_0_12px_rgba(var(--app-primary-rgb),0.4)] transition-all duration-1000" style={{ width: '92%' }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
