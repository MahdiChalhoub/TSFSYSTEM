
"use client"

/**
 * Virtual Employees — V2 Dajingo Pro Redesign
 * =============================================
 * Autonomous AI agents dashboard with live console,
 * role-based cards, and permission scopes.
 */

import { useState, useEffect, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Cpu, Brain, Sparkles, Activity, Play, Pause,
    RefreshCw, Terminal, Clock, CheckCircle2, Search,
    ShieldCheck, Zap, Package, LineChart, Wallet,
    MessageSquare, ShieldAlert
} from "lucide-react"
import { getAgents, getAgentLogs, runAgentNow, updateAgent } from "@/app/actions/agents"
import { formatDistanceToNow } from 'date-fns'

interface Agent {
    id: number; name: string; role: string; role_display: string;
    persona: string; is_active: boolean; status: 'idle' | 'running' | 'paused' | 'error';
    auto_execute: boolean; frequency_minutes: number;
    last_run_at: string | null; next_run_at: string | null;
}
interface AgentLog {
    id: number; agent: number; agent_name: string;
    level: 'info' | 'thought' | 'action' | 'error' | 'decision';
    message: string; data: any; created_at: string;
}

export default function AgentDashboard() {
    const [agents, setAgents] = useState<Agent[]>([])
    const [logs, setLogs] = useState<AgentLog[]>([])
    const [loading, setLoading] = useState(true)
    const [runningMap, setRunningMap] = useState<Record<number, boolean>>({})

    const fetchData = useCallback(async () => {
        try {
            const [agentsData, logsData] = await Promise.all([getAgents(), getAgentLogs()])
            setAgents(agentsData)
            setLogs(logsData)
        } catch (e) { console.error(e) } finally { setLoading(false) }
    }, [])

    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, 10000)
        return () => clearInterval(interval)
    }, [fetchData])

    const handleRunNow = async (id: number) => {
        setRunningMap(prev => ({ ...prev, [id]: true }))
        try { await runAgentNow(id); fetchData() } catch (e) { console.error(e) }
        finally { setRunningMap(prev => ({ ...prev, [id]: false })) }
    }
    const toggleAgent = async (agent: Agent) => {
        try { await updateAgent(agent.id, { is_active: !agent.is_active }); fetchData() } catch (e) { console.error(e) }
    }

    const getAgentIcon = (role: string) => {
        switch (role) {
            case 'inventory_manager': return Package
            case 'finance_specialist': return Wallet
            case 'sales_analyst': return LineChart
            case 'customer_support': return MessageSquare
            default: return Brain
        }
    }

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'running': return { color: 'var(--app-success)', label: 'Running' }
            case 'error': return { color: 'var(--app-error)', label: 'Error' }
            case 'paused': return { color: 'var(--app-warning)', label: 'Paused' }
            default: return { color: 'var(--app-info)', label: 'Idle' }
        }
    }

    const getLogLevelColor = (level: string) => {
        switch (level) {
            case 'error': return 'var(--app-error)'
            case 'thought': return '#A78BFA'
            case 'action': return 'var(--app-warning)'
            case 'decision': return 'var(--app-primary)'
            default: return 'var(--app-text-muted)'
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* ── Page Header ──────────────────────────────────────── */}
            <div
                className="rounded-[28px] p-6 md:p-8"
                style={{
                    background: 'linear-gradient(135deg, var(--app-surface) 0%, var(--app-surface-2) 100%)',
                    border: '1px solid var(--app-border)',
                    boxShadow: 'var(--app-shadow-lg)',
                }}
            >
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                            style={{
                                background: 'linear-gradient(135deg, var(--app-primary), var(--app-primary-hover))',
                                boxShadow: '0 8px 24px var(--app-primary-glow)',
                            }}
                        >
                            <Sparkles className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
                                Virtual Employees
                            </h1>
                            <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                                {agents.length} autonomous agents · {agents.filter(a => a.is_active).length} active
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={fetchData}
                            className="rounded-xl px-4 h-11 font-bold" style={{ borderColor: 'var(--app-border)' }}>
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button className="rounded-xl px-5 h-11 font-bold text-white"
                            style={{ background: 'var(--app-primary)', boxShadow: '0 4px 14px var(--app-primary-glow)' }}>
                            <Cpu className="w-4 h-4 mr-2" />
                            Hire New Agent
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* ── Left: Agent Cards ─────────────────────────────── */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {loading && agents.length === 0 ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-[200px] rounded-[20px] animate-pulse"
                                    style={{ background: 'var(--app-surface-2)' }} />
                            ))
                        ) : (
                            agents.map(agent => {
                                const Icon = getAgentIcon(agent.role)
                                const status = getStatusInfo(agent.status)
                                return (
                                    <div
                                        key={agent.id}
                                        className="rounded-[20px] overflow-hidden transition-all duration-300 hover:translate-y-[-2px] group"
                                        style={{
                                            background: 'var(--app-surface)',
                                            border: '1px solid var(--app-border)',
                                            boxShadow: 'var(--app-shadow-md)',
                                        }}
                                    >
                                        <div className="p-5">
                                            {/* Header */}
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                                        style={{ background: 'var(--app-primary-light)' }}>
                                                        <Icon size={18} style={{ color: 'var(--app-primary)' }} />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-[15px]" style={{ color: 'var(--app-text)' }}>
                                                            {agent.name}
                                                        </h3>
                                                        <span className="text-[10px] font-bold uppercase tracking-wider"
                                                            style={{ color: 'var(--app-text-muted)' }}>
                                                            {agent.role_display}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full"
                                                        style={{
                                                            background: status.color,
                                                            boxShadow: agent.status === 'running' ? `0 0 8px ${status.color}` : 'none',
                                                            animation: agent.status === 'running' ? 'pulse 2s infinite' : 'none',
                                                        }} />
                                                    <span className="text-[10px] font-bold uppercase"
                                                        style={{ color: status.color }}>{status.label}</span>
                                                </div>
                                            </div>

                                            <p className="text-xs italic line-clamp-2 mb-3 leading-relaxed"
                                                style={{ color: 'var(--app-text-muted)' }}>
                                                &ldquo;{agent.persona}&rdquo;
                                            </p>

                                            <div className="flex items-center gap-3 mb-4 text-[11px] font-bold"
                                                style={{ color: 'var(--app-text-muted)' }}>
                                                <span className="flex items-center gap-1">
                                                    <Clock size={12} /> {agent.frequency_minutes}m
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Activity size={12} /> {agent.status}
                                                </span>
                                            </div>

                                            <div className="flex gap-2">
                                                <Button
                                                    variant={agent.is_active ? "outline" : "default"}
                                                    size="sm"
                                                    className="flex-1 rounded-xl h-9 font-bold text-xs"
                                                    style={!agent.is_active ? { background: 'var(--app-primary)', color: '#fff' } : { borderColor: 'var(--app-border)' }}
                                                    onClick={() => toggleAgent(agent)}
                                                >
                                                    {agent.is_active ? <><Pause size={13} className="mr-1.5" /> Pause</> : <><Play size={13} className="mr-1.5" /> Activate</>}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="rounded-xl h-9 px-4 font-bold text-xs text-white"
                                                    style={{ background: 'var(--app-primary)', boxShadow: '0 3px 10px var(--app-primary-glow)' }}
                                                    onClick={() => handleRunNow(agent.id)}
                                                    disabled={runningMap[agent.id] || agent.status === 'running'}
                                                >
                                                    {runningMap[agent.id] ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
                                                    <span className="ml-1.5 hidden sm:inline">Run</span>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>

                    {/* Permission Scopes */}
                    <div className="rounded-[20px] overflow-hidden"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: 'var(--app-shadow-md)' }}>
                        <div className="p-4" style={{ background: 'var(--app-surface-2)' }}>
                            <h3 className="text-[11px] font-black uppercase tracking-wider flex items-center gap-2"
                                style={{ color: 'var(--app-text-muted)' }}>
                                <ShieldCheck size={14} /> Agent Permission Scopes
                            </h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4" style={{ borderTop: '1px solid var(--app-border)' }}>
                            {[
                                { label: 'Read Context', icon: Search, color: 'var(--app-info)' },
                                { label: 'Tool Execution', icon: Zap, color: 'var(--app-warning)' },
                                { label: 'Write Access', icon: Sparkles, color: 'var(--app-primary)' },
                                { label: 'Self Improvement', icon: Brain, color: 'var(--app-success)' },
                            ].map((item, i) => (
                                <div key={item.label} className="p-5 flex flex-col items-center gap-2 text-center"
                                    style={{ borderRight: i < 3 ? '1px solid var(--app-border)' : 'none' }}>
                                    <item.icon size={20} style={{ color: item.color }} />
                                    <span className="text-[10px] font-black uppercase" style={{ color: 'var(--app-text-muted)' }}>{item.label}</span>
                                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-md"
                                        style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)' }}>
                                        Authorized
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Right: Live Console ───────────────────────────── */}
                <div className="space-y-4">
                    <div
                        className="rounded-[20px] h-[660px] flex flex-col overflow-hidden"
                        style={{
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                            boxShadow: 'var(--app-shadow-lg)',
                        }}
                    >
                        <div className="p-4 flex items-center justify-between"
                            style={{ borderBottom: '1px solid var(--app-border)', background: 'var(--app-surface-2)' }}>
                            <h3 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2"
                                style={{ color: 'var(--app-text-muted)' }}>
                                <Terminal size={14} style={{ color: 'var(--app-primary)' }} />
                                Live Agent Intelligence
                            </h3>
                            <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--app-error)', opacity: 0.3 }} />
                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--app-warning)', opacity: 0.3 }} />
                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--app-success)', opacity: 0.3 }} />
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-4 font-mono text-[11px] space-y-3">
                            {logs.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center gap-3">
                                    <Brain className="w-10 h-10 animate-pulse" style={{ color: 'var(--app-text-faint)', opacity: 0.3 }} />
                                    <p className="text-center text-xs" style={{ color: 'var(--app-text-faint)' }}>
                                        Waiting for agent activity...
                                    </p>
                                </div>
                            ) : (
                                logs.map(log => (
                                    <div key={log.id} className="animate-in slide-in-from-right duration-300">
                                        <div className="flex items-start gap-2">
                                            <span style={{ color: 'var(--app-text-faint)', opacity: 0.4 }} className="shrink-0">
                                                [{new Date(log.created_at).toLocaleTimeString()}]
                                            </span>
                                            <span className="shrink-0 font-bold" style={{ color: 'var(--app-primary)' }}>
                                                {log.agent_name} »
                                            </span>
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <p style={{ color: getLogLevelColor(log.level) }}>{log.message}</p>
                                                {log.level === 'decision' && (
                                                    <div className="p-2 rounded-lg" style={{
                                                        background: 'var(--app-primary-light)',
                                                        border: '1px solid var(--app-primary)',
                                                        color: 'var(--app-primary)',
                                                    }}>
                                                        <div className="flex items-center gap-1.5 mb-0.5">
                                                            <CheckCircle2 size={12} />
                                                            <span className="font-black uppercase tracking-widest text-[8px]">Decision</span>
                                                        </div>
                                                        {log.message}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-3" style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-surface-2)' }}>
                            <div className="flex items-center gap-3 rounded-xl px-3 py-2"
                                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                <Search size={14} style={{ color: 'var(--app-text-faint)' }} />
                                <input
                                    className="bg-transparent border-none text-xs w-full focus:outline-none"
                                    style={{ color: 'var(--app-text)' }}
                                    placeholder="Filter logs or query agent..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Security Banner */}
                    <div className="p-5 rounded-[20px] flex items-start gap-3"
                        style={{ background: 'var(--app-warning-light)', border: '1px solid var(--app-warning)' }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: 'var(--app-warning-light)' }}>
                            <ShieldAlert size={18} style={{ color: 'var(--app-warning)' }} />
                        </div>
                        <div>
                            <h4 className="font-black text-xs uppercase tracking-tight" style={{ color: 'var(--app-warning)' }}>
                                Agent Safeguards Active
                            </h4>
                            <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--app-warning)', opacity: 0.7 }}>
                                All virtual employees are sandboxed. Data modifications require audit logs and role-based permissions.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
