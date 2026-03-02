
"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
 Cpu, Brain, Sparkles, Activity, Settings,
 Play, Pause, RefreshCw, Terminal, Clock,
 AlertCircle, CheckCircle2, MoreHorizontal,
 Search, ShieldCheck, Zap, Package,
 LineChart, Wallet, MessageSquare, ShieldAlert
} from "lucide-react"
import { getAgents, getAgentLogs, runAgentNow, updateAgent } from "@/app/actions/agents"
import { formatDistanceToNow } from 'date-fns'

interface Agent {
 id: number
 name: string
 role: string
 role_display: string
 persona: string
 is_active: boolean
 status: 'idle' | 'running' | 'paused' | 'error'
 auto_execute: boolean
 frequency_minutes: number
 last_run_at: string | null
 next_run_at: string | null
}

interface AgentLog {
 id: number
 agent: number
 agent_name: string
 level: 'info' | 'thought' | 'action' | 'error' | 'decision'
 message: string
 data: any
 created_at: string
}

export default function AgentDashboard() {
 const [agents, setAgents] = useState<Agent[]>([])
 const [logs, setLogs] = useState<AgentLog[]>([])
 const [loading, setLoading] = useState(true)
 const [activeAgent, setActiveAgent] = useState<Agent | null>(null)
 const [runningMap, setRunningMap] = useState<Record<number, boolean>>({})

 const fetchData = useCallback(async () => {
 try {
 const [agentsData, logsData] = await Promise.all([
 getAgents(),
 getAgentLogs()
 ])
 setAgents(agentsData)
 setLogs(logsData)
 } catch (e) {
 console.error(e)
 } finally {
 setLoading(false)
 }
 }, [])

 useEffect(() => {
 fetchData()
 const interval = setInterval(fetchData, 10000)
 return () => clearInterval(interval)
 }, [fetchData])

 const handleRunNow = async (id: number) => {
 setRunningMap(prev => ({ ...prev, [id]: true }))
 try {
 await runAgentNow(id)
 fetchData()
 } catch (e) {
 console.error(e)
 } finally {
 setRunningMap(prev => ({ ...prev, [id]: false }))
 }
 }

 const toggleAgent = async (agent: Agent) => {
 try {
 await updateAgent(agent.id, { is_active: !agent.is_active })
 fetchData()
 } catch (e) {
 console.error(e)
 }
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

 const getStatusColor = (status: string) => {
 switch (status) {
 case 'running': return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
 case 'error': return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
 case 'paused': return 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
 default: return 'bg-blue-500/50'
 }
 }

 const getLogLevelColor = (level: string) => {
 switch (level) {
 case 'error': return 'text-red-400'
 case 'thought': return 'text-purple-400'
 case 'action': return 'text-amber-400'
 case 'decision': return 'text-emerald-400 font-bold'
 default: return 'text-white/60'
 }
 }

 return (
 <div className="flex flex-col gap-8 p-1 sm:p-2 animate-in fade-in duration-500">
 {/* --- Header Section --- */}
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
 <div className="space-y-1">
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
 <Sparkles className="w-6 h-6 text-white animate-pulse" />
 </div>
 <h1 className="page-header-title tracking-tight">Virtual Employees</h1>
 </div>
 <p className="text-app-text-muted font-medium ml-[60px]">Autonomous AI Agents managing your business data.</p>
 </div>

 <div className="flex items-center gap-3">
 <Button variant="outline" className="border-2 border-app-border font-bold" onClick={fetchData}>
 <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
 Refresh Status
 </Button>
 <Button className="bg-gray-900 text-white hover:bg-black font-bold px-6">
 <Cpu className="w-4 h-4 mr-2" />
 Hire New Agent
 </Button>
 </div>
 </header>

 <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
 {/* --- Left Column: Active Agents --- */}
 <div className="xl:col-span-2 space-y-6">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {loading && agents.length === 0 ? (
 Array.from({ length: 4 }).map((_, i) => (
 <div key={i} className="h-[200px] rounded-3xl bg-app-surface-2 animate-pulse" />
 ))
 ) : (
 agents.map(agent => {
 const Icon = getAgentIcon(agent.role)
 return (
 <Card key={agent.id} className="relative overflow-hidden group border-2 border-app-border hover:border-purple-200 transition-all duration-300 rounded-3xl shadow-sm hover:shadow-xl">
 <div className="absolute top-0 right-0 p-4">
 <div className={`w-3 h-3 rounded-full ${getStatusColor(agent.status)} ${agent.status === 'running' ? 'animate-pulse' : ''}`} />
 </div>

 <CardHeader className="pb-2">
 <div className="flex items-start gap-4">
 <div className="w-12 h-12 rounded-2xl bg-app-bg group-hover:bg-purple-50 flex items-center justify-center transition-colors">
 <Icon className="w-6 h-6 text-app-text-faint group-hover:text-purple-600" />
 </div>
 <div>
 <CardTitle className="text-lg font-black text-app-text">{agent.name}</CardTitle>
 <Badge variant="secondary" className="bg-app-surface-2 text-app-text-muted font-bold text-[10px] uppercase tracking-wider">{agent.role_display}</Badge>
 </div>
 </div>
 </CardHeader>

 <CardContent className="space-y-4">
 <p className="text-sm text-app-text-muted line-clamp-2 leading-relaxed italic">
 &quot;{agent.persona}&quot;
 </p>

 <div className="flex items-center gap-4 text-xs font-bold text-app-text-faint">
 <span className="flex items-center gap-1.5">
 <Clock className="w-3.5 h-3.5" />
 {agent.frequency_minutes}m frequency
 </span>
 <span className="flex items-center gap-1.5">
 <Activity className="w-3.5 h-3.5" />
 {agent.status.toUpperCase()}
 </span>
 </div>
 </CardContent>

 <CardFooter className="pt-2 flex gap-2">
 <Button
 variant={agent.is_active ? "outline" : "default"}
 className={`flex-1 font-bold ${!agent.is_active ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
 onClick={() => toggleAgent(agent)}
 >
 {agent.is_active ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
 {agent.is_active ? 'Pause' : 'Activate'}
 </Button>
 <Button
 className="bg-purple-600 hover:bg-purple-700 font-bold px-6 shadow-lg shadow-purple-500/20"
 onClick={() => handleRunNow(agent.id)}
 disabled={runningMap[agent.id] || agent.status === 'running'}
 >
 {runningMap[agent.id] ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
 <span className="sr-only sm:not-sr-only sm:ml-2">Run Now</span>
 </Button>
 </CardFooter>
 </Card>
 )
 })
 )}
 </div>

 {/* Agent Capability Grid */}
 <Card className="rounded-3xl border-2 border-app-border shadow-sm overflow-hidden">
 <CardHeader className="bg-gray-50/50">
 <CardTitle className="text-sm font-black uppercase tracking-wider text-app-text-faint flex items-center gap-2">
 <ShieldCheck className="w-4 h-4" />
 Agent Permission Scopes
 </CardTitle>
 </CardHeader>
 <CardContent className="p-0">
 <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y divide-gray-100">
 {[
 { label: 'Read Context', icon: Search, color: 'text-blue-500' },
 { label: 'Tool Execution', icon: Zap, color: 'text-amber-500' },
 { label: 'Write Access', icon: Sparkles, color: 'text-purple-500' },
 { label: 'Self Improv.', icon: Brain, color: 'text-emerald-500' },
 ].map(item => (
 <div key={item.label} className="p-6 flex flex-col items-center gap-2 hover:bg-app-bg transition-colors">
 <item.icon className={`w-6 h-6 ${item.color}`} />
 <span className="text-xs font-black text-app-text-muted uppercase">{item.label}</span>
 <Badge variant="outline" className="text-[9px] border-emerald-500/20 text-emerald-600 bg-emerald-50">Authorized</Badge>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </div>

 {/* --- Right Column: Live Console --- */}
 <div className="space-y-6">
 <Card className="rounded-3xl border-2 border-gray-900 bg-[#0d0d1a] shadow-2xl h-[700px] flex flex-col overflow-hidden">
 <CardHeader className="bg-gray-900 border-b border-white/5 py-4">
 <div className="flex items-center justify-between">
 <CardTitle className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-widest">
 <Terminal className="w-4 h-4 text-purple-400" />
 Live Agent Intelligence
 </CardTitle>
 <div className="flex gap-1.5">
 <div className="w-2 h-2 rounded-full bg-red-400" />
 <div className="w-2 h-2 rounded-full bg-amber-400" />
 <div className="w-2 h-2 rounded-full bg-emerald-400" />
 </div>
 </div>
 </CardHeader>

 <CardContent className="flex-1 overflow-auto p-4 font-mono text-[11px] space-y-3 custom-scrollbar">
 {logs.length === 0 ? (
 <div className="h-full flex flex-col items-center justify-center gap-4 opacity-50">
 <Brain className="w-12 h-12 text-white/10 animate-pulse" />
 <p className="text-white/30 text-center">Waiting for agent activity...</p>
 </div>
 ) : (
 logs.map(log => (
 <div key={log.id} className="group animate-in slide-in-from-right duration-300">
 <div className="flex items-start gap-2">
 <span className="text-white/20 shrink-0">[{new Date(log.created_at).toLocaleTimeString()}]</span>
 <span className="text-purple-400 shrink-0 font-bold">{log.agent_name} »</span>
 <div className="space-y-1 min-w-0 flex-1">
 <p className={getLogLevelColor(log.level)}>{log.message}</p>
 {log.level === 'thought' && (
 <div className="bg-white/5 p-2 rounded-lg border border-white/5 text-purple-200/50 leading-relaxed italic">
 {log.message}
 </div>
 )}
 {log.level === 'decision' && (
 <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-emerald-400 shadow-inner">
 <div className="flex items-center gap-2 mb-1">
 <CheckCircle2 className="w-4 h-4" />
 <span className="font-black uppercase tracking-widest text-[9px]">Decision Logged</span>
 </div>
 {log.message}
 </div>
 )}
 </div>
 </div>
 </div>
 ))
 )}
 </CardContent>

 <CardFooter className="bg-black/50 border-t border-white/5 p-3">
 <div className="w-full flex items-center gap-4 bg-white/5 rounded-2xl px-4 py-2 border border-white/10 group focus-within:border-purple-500/50 transition-all">
 <Search className="w-4 h-4 text-white/20 group-focus-within:text-purple-400" />
 <input
 className="bg-transparent border-none text-white text-xs w-full focus:outline-none placeholder:text-white/10"
 placeholder="Filter system logs or ask agent for status..."
 />
 </div>
 </CardFooter>
 </Card>

 {/* Agent Security Banner */}
 <div className="p-6 rounded-3xl bg-amber-50 border-2 border-amber-100 flex items-start gap-4">
 <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
 <ShieldAlert className="w-5 h-5 text-amber-600" />
 </div>
 <div>
 <h4 className="font-black text-amber-900 text-sm uppercase tracking-tight">Agent Safeguards Active</h4>
 <p className="text-amber-700/70 text-xs mt-1 leading-relaxed">
 All virtual employees are sandboxed. Data modifications require audit logs and role-based permissions check.
 </p>
 </div>
 </div>
 </div>
 </div>
 </div>
 )
}
