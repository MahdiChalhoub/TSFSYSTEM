// @ts-nocheck
'use client'

/**
 * MCP AI Chat — Analytics Assistant (Dajingo Pro redesign)
 * =========================================================
 * Charts, analysis, dynamic interfaces, saved reports. Two-pane
 * laptop+ layout (history sidebar + chat); single column on mobile
 * per design-language §18.
 */

import { useEffect, useRef, useState } from 'react'
import {
    ArrowLeft, Send, Bot, User, Loader2, Plus, Wrench, Sparkles,
    AlertCircle, BarChart3, TrendingUp, Save, Download, Target, FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { getMCPProviders, getMCPConversations, sendMCPChat } from '@/app/actions/saas/mcp'
import { AIChart, parseChartFromResponse } from '@/components/ai/AICharts'
import { ModulePage, PageHeader, EmptyState, Loading, GhostButton, PrimaryButton, StatusPill } from '../_design'

interface Message {
    id: string
    role: 'user' | 'assistant' | 'tool' | 'chart'
    content: string
    data?: Record<string, any>
    tool_calls?: { name: string; arguments: Record<string, any>; result?: string }[]
    timestamp: Date
}
interface Provider { id: number; name: string; provider_type: string; model_name: string; is_default: boolean }
interface Conversation { id: number; title: string; created_at: string; message_count: number }

const QUICK_ACTIONS = [
    { emoji: '📊', label: 'Sales Trend',      prompt: 'Show me a chart of sales trends for the last 6 months. Include analysis and recommendations.' },
    { emoji: '📦', label: 'Low Stock Alert',  prompt: 'Create a report of products with low stock levels. Show as a chart and suggest reorder strategy.' },
    { emoji: '💰', label: 'Financial Review', prompt: 'Analyze my financial performance this quarter. Show revenue vs expenses chart and strategic recommendations.' },
    { emoji: '👥', label: 'Customer Insights', prompt: 'Analyze my top customers and their purchase patterns. Create a pie chart of revenue by customer segment.' },
    { emoji: '🎯', label: 'Strategy',          prompt: 'Based on my current inventory, sales, and financial data, provide 5 strategic recommendations for growth.' },
    { emoji: '📈', label: 'Forecast',          prompt: 'Create a sales forecast for the next 3 months based on historical data. Show as a trend chart.' },
]

const PROVIDER_LABEL: Record<string, string> = {
    openai: 'OpenAI', anthropic: 'Claude', google: 'Gemini', azure: 'Azure', ollama: 'Ollama', custom: 'Custom',
}

export default function MCPChatPage() {
    const [providers, setProviders] = useState<Provider[]>([])
    const [selectedProvider, setSelectedProvider] = useState<number | null>(null)
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [currentConversation, setCurrentConversation] = useState<number | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [sending, setSending] = useState(false)
    const [showQuickActions, setShowQuickActions] = useState(true)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => { loadInitialData() }, [])
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

    async function loadInitialData() {
        setLoading(true)
        try {
            const [pData, cData] = await Promise.all([getMCPProviders(), getMCPConversations()])
            setProviders(pData); setConversations(cData)
            const def = pData.find((p: Provider) => p.is_default)
            if (def) setSelectedProvider(def.id)
            else if (pData.length) setSelectedProvider(pData[0].id)
        } catch {
            toast.error('Failed to load data')
        } finally { setLoading(false) }
    }

    function startNewConversation() {
        setCurrentConversation(null); setMessages([]); setShowQuickActions(true)
    }

    async function handleSend() {
        if (!input.trim() || !selectedProvider || sending) return
        setShowQuickActions(false)
        const userMessage: Message = { id: `user-${Date.now()}`, role: 'user', content: input.trim(), timestamp: new Date() }
        setMessages(p => [...p, userMessage]); setInput(''); setSending(true)

        try {
            const enhancedPrompt = `${userMessage.content}

IMPORTANT: When providing data analysis:
1. If showing data that can be visualized, include a chart in this JSON format:
   \`\`\`chart
   {"type": "bar|line|pie|area", "title": "Chart Title", "data": [...], "xKey": "name", "yKeys": ["value"]}
   \`\`\`
2. If providing insights, format them as:
   **Key Insight:** [insight title]
   - [detail]
3. If making strategic recommendations, format as numbered list with priority, action, impact, timeline.
Always be specific with numbers and actionable recommendations.`

            const response = await sendMCPChat({
                message: enhancedPrompt, provider_id: selectedProvider,
                conversation_id: currentConversation || undefined, include_tools: true,
            })
            if (!response.success) throw new Error(response.error || 'Failed to get response')
            if (response.conversation_id && !currentConversation) setCurrentConversation(response.conversation_id)

            if (response.tool_calls?.length) {
                setMessages(p => [...p, { id: `tool-${Date.now()}`, role: 'tool', content: 'Executed tools', tool_calls: response.tool_calls, timestamp: new Date() }])
            }
            const chartData = parseChartFromResponse(response.content || '')
            if (chartData) {
                setMessages(p => [...p, { id: `chart-${Date.now()}`, role: 'chart', content: 'Generated visualization', data: chartData, timestamp: new Date() }])
            }
            setMessages(p => [...p, { id: `assistant-${Date.now()}`, role: 'assistant', content: response.content || 'No response', timestamp: new Date() }])

            const cData = await getMCPConversations(); setConversations(cData)
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : String(e))
            setMessages(p => p.filter(m => m.id !== userMessage.id))
        } finally { setSending(false) }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
    }

    if (loading) {
        return (<ModulePage><Loading /></ModulePage>)
    }

    if (providers.length === 0) {
        return (
            <ModulePage>
                <PageHeader icon={<Sparkles size={20} className="text-white" />}
                    title="AI Analytics Assistant"
                    subtitle="No provider configured yet"
                    actions={<GhostButton icon={<ArrowLeft size={13} />} label="Back" href="/mcp" />} />
                <div className="flex-1 flex items-center justify-center">
                    <EmptyState
                        icon={<AlertCircle size={42} style={{ color: 'var(--app-warning, #f59e0b)' }} />}
                        title="No AI Providers Configured"
                        description="Configure an AI provider to unlock chat, analytics and the scope-suggester wizards."
                        action={<PrimaryButton icon={<Plus size={13} />} label="Add AI Provider" href="/mcp/providers/new" />} />
                </div>
            </ModulePage>
        )
    }

    return (
        <ModulePage>
            <PageHeader
                icon={<Sparkles size={20} className="text-white" />}
                title="AI Analytics Assistant"
                subtitle="Charts · Analysis · Strategy · Forecasts"
                actions={
                    <>
                        <GhostButton icon={<ArrowLeft size={13} />} label="Back" href="/mcp" />
                        {/* Provider selector */}
                        <select value={selectedProvider ?? ''}
                            onChange={e => setSelectedProvider(parseInt(e.target.value))}
                            className="text-[11px] font-bold px-2.5 py-1.5 bg-app-surface border border-app-border rounded-xl text-app-foreground outline-none focus:border-app-primary">
                            {providers.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({PROVIDER_LABEL[p.provider_type] || p.provider_type})</option>
                            ))}
                        </select>
                        {messages.length > 0 && (
                            <>
                                <GhostButton icon={<Save size={13} />} label="Save" onClick={() => toast.success('Report saved')} />
                                <GhostButton icon={<Download size={13} />} label="Export" onClick={() => toast.info('Coming soon')} />
                            </>
                        )}
                        <PrimaryButton icon={<Plus size={14} />} label="New Chat" onClick={startNewConversation} />
                    </>
                }
            />

            <div className="flex-1 min-h-0 flex gap-3">
                {/* History sidebar — hidden on mobile */}
                <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 rounded-2xl"
                    style={{
                        background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                    }}>
                    <div className="px-3 py-2 border-b flex-shrink-0"
                        style={{ borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                        <h3 className="uppercase text-app-muted-foreground">
                            Recent Analysis
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5">
                        {conversations.length === 0 ? (
                            <p className="text-[11px] text-app-muted-foreground text-center py-6 font-medium">No conversations yet</p>
                        ) : (
                            <ul className="space-y-1">
                                {conversations.slice(0, 12).map(c => {
                                    const active = currentConversation === c.id
                                    return (
                                        <li key={c.id}>
                                            <button onClick={() => setCurrentConversation(c.id)}
                                                className="w-full text-left px-2 py-1.5 rounded-lg transition-all"
                                                style={{
                                                    background: active ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)' : 'transparent',
                                                    color: active ? 'var(--app-primary)' : 'var(--app-foreground)',
                                                }}>
                                                <div className="flex items-center gap-1.5">
                                                    <BarChart3 size={11} className="flex-shrink-0" />
                                                    <span className="text-[12px] font-bold truncate">{c.title || 'Analysis'}</span>
                                                </div>
                                                <p className="text-[10px] text-app-muted-foreground tabular-nums mt-0.5">{c.message_count} messages</p>
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </div>
                </aside>

                {/* Chat panel */}
                <div className="flex-1 min-w-0 rounded-2xl flex flex-col"
                    style={{
                        background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                    }}>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                        {messages.length === 0 && showQuickActions ? (
                            <div className="h-full flex flex-col items-center justify-center">
                                <div className="text-center mb-6">
                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 mx-auto"
                                        style={{
                                            background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                                            color: 'var(--app-primary)',
                                        }}>
                                        <Sparkles size={28} />
                                    </div>
                                    <h2>AI Business Analytics</h2>
                                    <p className="text-[12px] text-app-muted-foreground mt-1 max-w-md font-medium">
                                        Get instant charts, data analysis, and strategic recommendations powered by AI.
                                    </p>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}
                                    className="w-full max-w-2xl">
                                    {QUICK_ACTIONS.map((a, i) => (
                                        <button key={i} onClick={() => { setInput(a.prompt); setShowQuickActions(false) }}
                                            className="p-3 rounded-xl border text-left transition-all hover:bg-app-surface group"
                                            style={{
                                                background: 'var(--app-surface)',
                                                borderColor: 'var(--app-border)',
                                            }}>
                                            <div className="text-lg">{a.emoji}</div>
                                            <p className="text-[12px] font-bold text-app-foreground mt-1 group-hover:text-app-primary transition-colors">{a.label}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {messages.map(msg => (
                                    <div key={msg.id}>
                                        {msg.role === 'chart' && msg.data && (
                                            <div className="my-3"><AIChart chart={msg.data} /></div>
                                        )}
                                        {msg.role !== 'chart' && (
                                            <div className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                {msg.role !== 'user' && (
                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                                        style={{
                                                            background: msg.role === 'assistant'
                                                                ? 'var(--app-primary)'
                                                                : 'color-mix(in srgb, var(--app-info, #3b82f6) 15%, transparent)',
                                                            color: msg.role === 'assistant' ? 'white' : 'var(--app-info, #3b82f6)',
                                                        }}>
                                                        {msg.role === 'assistant' ? <Bot size={14} /> : <Wrench size={13} />}
                                                    </div>
                                                )}
                                                <div className="max-w-[75%] px-3 py-2 rounded-2xl text-[12px] font-medium whitespace-pre-wrap"
                                                    style={
                                                        msg.role === 'user'
                                                            ? { background: 'var(--app-primary)', color: 'white', borderBottomRightRadius: '6px' }
                                                            : msg.role === 'tool'
                                                                ? { background: 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)', color: 'var(--app-info, #3b82f6)', borderBottomLeftRadius: '6px' }
                                                                : { background: 'color-mix(in srgb, var(--app-border) 25%, transparent)', color: 'var(--app-foreground)', borderBottomLeftRadius: '6px' }
                                                    }>
                                                    {msg.role === 'tool' && msg.tool_calls ? (
                                                        <div className="space-y-1.5">
                                                            <p className="text-[11px] font-bold flex items-center gap-1">
                                                                <Wrench size={11} /> Querying your data…
                                                            </p>
                                                            {msg.tool_calls.map((tc, i) => (
                                                                <code key={i} className="block text-[11px] font-mono px-2 py-0.5 rounded"
                                                                    style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)' }}>
                                                                    {tc.name}
                                                                </code>
                                                            ))}
                                                        </div>
                                                    ) : msg.content}
                                                </div>
                                                {msg.role === 'user' && (
                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                                        style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                                        <User size={14} />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {sending && (
                                    <div className="flex gap-2">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center"
                                            style={{ background: 'var(--app-primary)' }}>
                                            <Loader2 size={14} className="animate-spin text-white" />
                                        </div>
                                        <div className="px-3 py-2 rounded-2xl text-[12px] font-medium animate-pulse"
                                            style={{ background: 'color-mix(in srgb, var(--app-border) 25%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                            Analyzing your data…
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    {/* Input area */}
                    <div className="p-3 border-t flex-shrink-0"
                        style={{ borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                        <div className="flex gap-2 items-end">
                            <textarea
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask for analysis, charts, forecasts, or strategic recommendations…"
                                rows={1}
                                disabled={sending}
                                className="flex-1 min-h-[40px] max-h-32 text-[12px] md:text-[13px] font-medium px-3 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none focus:border-app-primary resize-none custom-scrollbar"
                            />
                            <button onClick={handleSend} disabled={!input.trim() || sending}
                                className="text-[11px] font-bold bg-app-primary text-white px-4 py-2.5 rounded-xl hover:brightness-110 transition-all disabled:opacity-50"
                                style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            </button>
                        </div>
                        <div className="flex items-center justify-between mt-2 flex-wrap gap-1.5">
                            <div className="flex gap-1 flex-wrap">
                                <StatusPill label="Charts"   color="var(--app-info, #3b82f6)"    icon={<BarChart3 size={9} />} />
                                <StatusPill label="Trends"   color="var(--app-success, #22c55e)" icon={<TrendingUp size={9} />} />
                                <StatusPill label="Strategy" color="var(--app-warning, #f59e0b)" icon={<Target size={9} />} />
                                <StatusPill label="Reports"  color="#8b5cf6"                     icon={<FileText size={9} />} />
                            </div>
                            <p className="text-[10px] text-app-muted-foreground font-medium">
                                <kbd className="px-1.5 py-0.5 rounded border border-app-border text-[9px] font-mono">Enter</kbd> to send · <kbd className="px-1.5 py-0.5 rounded border border-app-border text-[9px] font-mono">Shift+Enter</kbd> for newline
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </ModulePage>
    )
}
