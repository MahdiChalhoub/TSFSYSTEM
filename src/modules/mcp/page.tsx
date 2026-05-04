'use client'

/**
 * MCP AI Connector — Dashboard (Dajingo Pro redesign)
 * ====================================================
 * Overview of AI integration status, providers, conversations and
 * 30-day usage. Every visual element conforms to design-language.md.
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
    Bot, Cloud, Wrench, MessageSquare, BarChart3, RefreshCw, Settings as SettingsIcon,
    Plus, Zap, ArrowRight, Sparkles,
} from 'lucide-react'
import { getMCPDashboard } from '@/app/actions/saas/mcp'
import {
    ModulePage, PageHeader, KPIStrip, NavTile, SectionCard,
    EmptyState, Loading, GhostButton, PrimaryButton,
} from './_design'

interface DashboardData {
    connection: { status: string; provider_name: string; total_requests: number; total_tokens_used: number } | null
    providers_count: number
    tools_count: number
    usage_30d: { requests: number; tokens: number; cost: number }
    recent_conversations: { id: number; title: string; message_count: number; updated_at: string }[]
}

export default function MCPDashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            setData(await getMCPDashboard())
        } catch {
            toast.error('Failed to load dashboard')
        } finally {
            setLoading(false)
        }
    }

    const kpis = [
        { label: 'Providers', value: data?.providers_count ?? 0, icon: <Cloud size={14} />, color: 'var(--app-primary)', href: '/mcp/providers' },
        { label: 'Tools',     value: data?.tools_count ?? 0,     icon: <Wrench size={14} />, color: 'var(--app-info, #3b82f6)', href: '/mcp/tools' },
        { label: 'Requests 30d', value: (data?.usage_30d?.requests ?? 0).toLocaleString(), icon: <Zap size={14} />, color: 'var(--app-success, #22c55e)', href: '/mcp/usage' },
        { label: 'Tokens 30d',   value: `${((data?.usage_30d?.tokens ?? 0) / 1000).toFixed(1)}K`, icon: <BarChart3 size={14} />, color: 'var(--app-warning, #f59e0b)', href: '/mcp/usage' },
        { label: 'Cost 30d',     value: `$${(data?.usage_30d?.cost ?? 0).toFixed(2)}`, icon: <BarChart3 size={14} />, color: '#8b5cf6' },
    ]

    return (
        <ModulePage>
            <PageHeader
                icon={<Bot size={20} className="text-white" />}
                title="AI Integration"
                subtitle={`${data?.providers_count ?? 0} Providers · ${data?.tools_count ?? 0} Tools · MCP Connector`}
                actions={
                    <>
                        <GhostButton icon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />} label="Refresh" onClick={loadData} disabled={loading} />
                        <GhostButton icon={<SettingsIcon size={13} />} label="Settings" href="/mcp/settings" />
                        <PrimaryButton icon={<Plus size={14} />} label="New Provider" href="/mcp/providers/new" />
                    </>
                }
            />

            <KPIStrip items={kpis} />

            {/* Navigation grid — auto-fit, no hardcoded breakpoints. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}
                className="mb-4 flex-shrink-0">
                <NavTile href="/mcp/chat"          icon={<Bot size={16} />}          color="var(--app-primary)"          title="AI Chat"           caption="Start a conversation with your AI provider." />
                <NavTile href="/mcp/agents"        icon={<Sparkles size={16} />}     color="#8b5cf6"                     title="Virtual Agents"    caption="Autonomous agents that run on a schedule." />
                <NavTile href="/mcp/conversations" icon={<MessageSquare size={16} />} color="var(--app-success, #22c55e)" title="Conversations"     caption="Browse history of past AI sessions." />
                <NavTile href="/mcp/providers"     icon={<Cloud size={16} />}        color="var(--app-primary)"          title="AI Providers"      caption="OpenAI, Anthropic, Gemini, Azure, Ollama." />
                <NavTile href="/mcp/tools"         icon={<Wrench size={16} />}       color="var(--app-info, #3b82f6)"    title="MCP Tools"         caption="Define ERP capabilities the AI can call." />
                <NavTile href="/mcp/agent-logs"    icon={<BarChart3 size={16} />}    color="var(--app-warning, #f59e0b)" title="Agent Logs"        caption="Decisions, thoughts and actions per agent." />
                <NavTile href="/mcp/usage"         icon={<Zap size={16} />}          color="var(--app-warning, #f59e0b)" title="Usage & Billing"   caption="Track tokens, requests and cost." />
                <NavTile href="/mcp/settings"      icon={<SettingsIcon size={16} />} color="var(--app-muted-foreground)" title="MCP Settings"      caption="Connector status, rate limits, defaults." />
            </div>

            {loading ? (
                <Loading />
            ) : (
                <div className="flex-1 min-h-0 grid gap-3"
                    style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                    {/* Recent conversations */}
                    <SectionCard
                        title="Recent Conversations"
                        icon={<MessageSquare size={11} />}
                        action={<a href="/mcp/conversations" className="text-[10px] font-bold text-app-primary hover:brightness-110 inline-flex items-center gap-0.5">View all <ArrowRight size={10} /></a>}>
                        {data?.recent_conversations?.length ? (
                            <ul className="space-y-1">
                                {data.recent_conversations.map(c => (
                                    <li key={c.id}>
                                        <a href={`/mcp/conversations/${c.id}`}
                                            className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-app-surface transition-all">
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[12px] font-bold text-app-foreground truncate">
                                                    {c.title || 'Untitled'}
                                                </div>
                                                <div className="text-[10px] text-app-muted-foreground font-medium">
                                                    {c.message_count} message{c.message_count === 1 ? '' : 's'}
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-app-muted-foreground tabular-nums whitespace-nowrap">
                                                {new Date(c.updated_at).toLocaleDateString()}
                                            </span>
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <EmptyState
                                icon={<MessageSquare size={28} />}
                                title="No conversations yet"
                                description="Start a chat under AI Chat to see history appear here." />
                        )}
                    </SectionCard>

                    {/* Getting started — only when no provider exists */}
                    {(!data?.providers_count || data.providers_count === 0) && (
                        <SectionCard
                            title="Get Started"
                            icon={<Sparkles size={11} />}>
                            <div className="px-2 py-1.5">
                                <p className="text-[12px] font-medium text-app-foreground leading-relaxed">
                                    Add at least one AI provider to start using AI features
                                    across the platform — chat, scope-suggester wizard,
                                    category-rule wizard, virtual agents, and more.
                                </p>
                                <div className="flex flex-wrap gap-1.5 mt-3">
                                    <PrimaryButton icon={<Cloud size={12} />} label="Add Provider" href="/mcp/providers/new" />
                                    <GhostButton icon={<Wrench size={13} />} label="Configure Tools" href="/mcp/tools" />
                                </div>
                            </div>
                        </SectionCard>
                    )}
                </div>
            )}
        </ModulePage>
    )
}
