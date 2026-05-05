'use client'

/**
 * Virtual Employees — Dajingo Pro redesign
 * =========================================
 * Autonomous AI agents dashboard with live console, role-based cards,
 * and permission scopes. Theme tokens, KPI strip, auto-fit grids.
 */

import { useState, useEffect, useCallback } from 'react'
import {
    Cpu, Brain, Sparkles, Activity, Play, Pause, RefreshCw, Terminal,
    Clock, CheckCircle2, Search, ShieldCheck, Zap, Package, LineChart,
    Wallet, MessageSquare, ShieldAlert,
} from 'lucide-react'
import { getAgents, getAgentLogs, runAgentNow, updateAgent } from '@/app/actions/agents'
import {
    ModulePage, PageHeader, KPIStrip, EmptyState, Loading,
    GhostButton, PrimaryButton, StatusPill, SectionCard,
} from '@/modules/mcp/_design'

interface Agent {
    id: number; name: string; role: string; role_display: string
    persona: string; is_active: boolean; status: 'idle' | 'running' | 'paused' | 'error'
    auto_execute: boolean; frequency_minutes: number
    last_run_at: string | null; next_run_at: string | null
}
interface AgentLog {
    id: number; agent: number; agent_name: string
    level: 'info' | 'thought' | 'action' | 'error' | 'decision'
    message: string; data: any; created_at: string
}

const AGENT_ICON: Record<string, any> = {
    inventory_manager: Package,
    finance_specialist: Wallet,
    sales_analyst: LineChart,
    customer_support: MessageSquare,
}

const STATUS_META: Record<string, { color: string; label: string }> = {
    running: { color: 'var(--app-success, #22c55e)', label: 'Running' },
    error:   { color: 'var(--app-error, #ef4444)',   label: 'Error' },
    paused:  { color: 'var(--app-warning, #f59e0b)', label: 'Paused' },
    idle:    { color: 'var(--app-info, #3b82f6)',    label: 'Idle' },
}

const LOG_COLOR: Record<string, string> = {
    error:    'var(--app-error, #ef4444)',
    thought:  '#A78BFA',
    action:   'var(--app-warning, #f59e0b)',
    decision: 'var(--app-primary)',
    info:     'var(--app-muted-foreground)',
}

export default function AgentDashboard() {
    const [agents, setAgents] = useState<Agent[]>([])
    const [logs, setLogs] = useState<AgentLog[]>([])
    const [loading, setLoading] = useState(true)
    const [runningMap, setRunningMap] = useState<Record<number, boolean>>({})
    const [logFilter, setLogFilter] = useState('')

    const fetchData = useCallback(async () => {
        try {
            const [a, l] = await Promise.all([getAgents(), getAgentLogs()])
            setAgents(a); setLogs(l)
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }, [])

    useEffect(() => {
        fetchData()
        const i = setInterval(fetchData, 10000)
        return () => clearInterval(i)
    }, [fetchData])

    const handleRunNow = async (id: number) => {
        setRunningMap(p => ({ ...p, [id]: true }))
        try { await runAgentNow(id); fetchData() } catch (e) { console.error(e) }
        finally { setRunningMap(p => ({ ...p, [id]: false })) }
    }
    const toggleAgent = async (a: Agent) => {
        try { await updateAgent(a.id, { is_active: !a.is_active }); fetchData() } catch (e) { console.error(e) }
    }

    const activeCount  = agents.filter(a => a.is_active).length
    const runningCount = agents.filter(a => a.status === 'running').length
    const errorCount   = agents.filter(a => a.status === 'error').length

    const kpis = [
        { label: 'Agents',  value: agents.length,  icon: <Cpu size={14} />,        color: 'var(--app-primary)' },
        { label: 'Active',  value: activeCount,    icon: <CheckCircle2 size={14} />, color: 'var(--app-success, #22c55e)' },
        { label: 'Running', value: runningCount,   icon: <Activity size={14} />,   color: 'var(--app-info, #3b82f6)' },
        { label: 'Errors',  value: errorCount,     icon: <ShieldAlert size={14} />, color: 'var(--app-error, #ef4444)' },
        { label: 'Logs',    value: logs.length,    icon: <Terminal size={14} />,   color: '#8b5cf6' },
    ]

    const filteredLogs = logFilter
        ? logs.filter(l =>
            l.message.toLowerCase().includes(logFilter.toLowerCase())
            || l.agent_name.toLowerCase().includes(logFilter.toLowerCase()))
        : logs

    return (
        <ModulePage>
            <PageHeader
                icon={<Sparkles size={20} className="text-white" />}
                title="Virtual Employees"
                subtitle={`${agents.length} autonomous agent${agents.length === 1 ? '' : 's'} · ${activeCount} active`}
                actions={
                    <>
                        <GhostButton icon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />} label="Refresh" onClick={fetchData} disabled={loading} />
                        <PrimaryButton icon={<Cpu size={14} />} label="Hire Agent" href="/mcp/agents/new" />
                    </>
                }
            />

            <KPIStrip items={kpis} />

            <div className="flex-1 min-h-0 grid gap-3"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignContent: 'start' }}>

                {/* Agent cards */}
                <div className="lg:col-span-2 flex flex-col gap-3 min-h-0"
                    style={{ gridColumn: 'span 2 / span 2' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px' }}>
                        {loading && agents.length === 0 ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-44 rounded-xl animate-pulse"
                                    style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)' }} />
                            ))
                        ) : agents.length === 0 ? (
                            <div style={{ gridColumn: '1 / -1' }}>
                                <EmptyState icon={<Cpu size={36} />} title="No virtual employees yet"
                                    description="Hire your first agent to start automating recurring tasks."
                                    action={<PrimaryButton icon={<Cpu size={13} />} label="Hire Agent" href="/mcp/agents/new" />} />
                            </div>
                        ) : agents.map(agent => {
                            const Icon = AGENT_ICON[agent.role] || Brain
                            const status = STATUS_META[agent.status] || STATUS_META.idle
                            return (
                                <div key={agent.id} className="rounded-xl p-3 transition-all hover:-translate-y-0.5"
                                    style={{
                                        background: 'var(--app-surface)',
                                        border: '1px solid var(--app-border)',
                                    }}>
                                    <div className="flex items-start justify-between mb-2 gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
                                                <Icon size={16} />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="truncate">{agent.name}</h3>
                                                <span className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">
                                                    {agent.role_display}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <span className="w-2 h-2 rounded-full"
                                                style={{
                                                    background: status.color,
                                                    boxShadow: agent.status === 'running' ? `0 0 8px ${status.color}` : 'none',
                                                    animation: agent.status === 'running' ? 'pulse 2s infinite' : 'none',
                                                }} />
                                            <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: status.color }}>
                                                {status.label}
                                            </span>
                                        </div>
                                    </div>

                                    <p className="text-[11px] italic text-app-muted-foreground line-clamp-2 mb-2 leading-relaxed">
                                        “{agent.persona}”
                                    </p>

                                    <div className="flex items-center gap-3 mb-2 text-[10px] font-bold text-app-muted-foreground">
                                        <span className="flex items-center gap-1"><Clock size={10} /> {agent.frequency_minutes}m</span>
                                        <span className="flex items-center gap-1"><Activity size={10} /> {agent.status}</span>
                                    </div>

                                    <div className="flex gap-1.5">
                                        <button onClick={() => toggleAgent(agent)}
                                            className="flex-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all flex items-center justify-center gap-1"
                                            style={{
                                                borderColor: 'var(--app-border)',
                                                background: agent.is_active ? 'transparent' : 'var(--app-primary)',
                                                color: agent.is_active ? 'var(--app-foreground)' : 'white',
                                            }}>
                                            {agent.is_active ? <><Pause size={11} /> Pause</> : <><Play size={11} /> Activate</>}
                                        </button>
                                        <button onClick={() => handleRunNow(agent.id)}
                                            disabled={runningMap[agent.id] || agent.status === 'running'}
                                            className="text-[11px] font-bold bg-app-primary text-white px-3 py-1.5 rounded-lg flex items-center gap-1 hover:brightness-110 transition-all disabled:opacity-50"
                                            style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                            {runningMap[agent.id] ? <RefreshCw size={11} className="animate-spin" /> : <Zap size={11} />}
                                            <span className="hidden sm:inline">Run</span>
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Permission scopes */}
                    <SectionCard title="Agent Permission Scopes" icon={<ShieldCheck size={11} />}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }} className="px-1 py-1">
                            {[
                                { label: 'Read Context',     icon: Search,   color: 'var(--app-info, #3b82f6)' },
                                { label: 'Tool Execution',   icon: Zap,      color: 'var(--app-warning, #f59e0b)' },
                                { label: 'Write Access',     icon: Sparkles, color: 'var(--app-primary)' },
                                { label: 'Self Improvement', icon: Brain,    color: 'var(--app-success, #22c55e)' },
                            ].map(item => (
                                <div key={item.label} className="flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-lg"
                                    style={{ background: 'color-mix(in srgb, var(--app-border) 15%, transparent)' }}>
                                    <item.icon size={18} style={{ color: item.color }} />
                                    <span className="text-[9px] font-black uppercase tracking-wider text-app-muted-foreground text-center">{item.label}</span>
                                    <StatusPill label="Authorized" color={item.color} />
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                </div>

                {/* Right: Live console */}
                <div className="flex flex-col gap-3 min-h-0">
                    <div className="rounded-2xl flex flex-col min-h-0"
                        style={{
                            background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                            height: '660px',
                        }}>
                        <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0"
                            style={{ borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                            <h3 className="uppercase text-app-muted-foreground flex items-center gap-1.5">
                                <Terminal size={11} className="text-app-primary" />
                                Live Agent Intelligence
                            </h3>
                            <div className="flex gap-1">
                                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--app-error, #ef4444)', opacity: 0.4 }} />
                                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--app-warning, #f59e0b)', opacity: 0.4 }} />
                                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--app-success, #22c55e)', opacity: 0.4 }} />
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto custom-scrollbar p-3 font-mono text-[11px] space-y-2">
                            {loading && filteredLogs.length === 0 ? (
                                <Loading />
                            ) : filteredLogs.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center gap-2">
                                    <Brain size={32} className="text-app-muted-foreground opacity-30 animate-pulse" />
                                    <p className="text-[11px] text-app-muted-foreground font-medium">
                                        {logFilter ? 'No matching logs' : 'Waiting for agent activity…'}
                                    </p>
                                </div>
                            ) : (
                                filteredLogs.map(log => (
                                    <div key={log.id} className="animate-in slide-in-from-right duration-300">
                                        <div className="flex items-start gap-2">
                                            <span className="flex-shrink-0 text-app-muted-foreground opacity-60">
                                                [{new Date(log.created_at).toLocaleTimeString()}]
                                            </span>
                                            <span className="flex-shrink-0 font-bold text-app-primary">
                                                {log.agent_name} »
                                            </span>
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <p style={{ color: LOG_COLOR[log.level] || LOG_COLOR.info }}>{log.message}</p>
                                                {log.level === 'decision' && (
                                                    <div className="px-2 py-1.5 rounded-lg flex items-start gap-1.5"
                                                        style={{
                                                            background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                                            border: '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)',
                                                            color: 'var(--app-primary)',
                                                        }}>
                                                        <CheckCircle2 size={11} className="mt-0.5 flex-shrink-0" />
                                                        <div>
                                                            <div className="font-black uppercase tracking-widest text-[8px] mb-0.5">Decision</div>
                                                            {log.message}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-2 border-t flex-shrink-0"
                            style={{ borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                            <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                <Search size={12} className="text-app-muted-foreground" />
                                <input
                                    value={logFilter}
                                    onChange={e => setLogFilter(e.target.value)}
                                    className="bg-transparent border-none text-[11px] w-full outline-none text-app-foreground placeholder:text-app-muted-foreground"
                                    placeholder="Filter logs by message or agent…"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Security banner */}
                    <div className="p-3 rounded-2xl flex items-start gap-2.5 flex-shrink-0"
                        style={{
                            background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)',
                        }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 15%, transparent)' }}>
                            <ShieldAlert size={15} style={{ color: 'var(--app-warning, #f59e0b)' }} />
                        </div>
                        <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-warning, #f59e0b)' }}>
                                Agent Safeguards Active
                            </h4>
                            <p className="text-[11px] mt-0.5 leading-relaxed font-medium" style={{ color: 'var(--app-foreground)', opacity: 0.85 }}>
                                All virtual employees are sandboxed. Data modifications require audit logs and role-based permissions.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </ModulePage>
    )
}
