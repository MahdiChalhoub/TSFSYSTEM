'use client'

/**
 * MCP Conversations — History (Dajingo Pro redesign)
 * ===================================================
 * Browse + delete past AI chat sessions. Theme-token only.
 */

import { useEffect, useRef, useState } from 'react'
import {
    ArrowLeft, RefreshCw, Trash2, Search, ChevronRight,
    MessagesSquare, Brain, Calendar, BarChart3,
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
    ModulePage, PageHeader, KPIStrip, EmptyState, Loading,
    GhostButton, SectionCard,
} from '../_design'

async function apiFetch(path: string, opts?: RequestInit) {
    return fetch(`/api${path}`, { credentials: 'include', ...opts })
}

interface Conversation {
    id: number
    title: string
    message_count: number
    provider_name: string
    total_tokens: number
    created_at: string
    updated_at: string
}

export default function MCPConversationsPage() {
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<Conversation | null>(null)
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
    const searchRef = useRef<HTMLInputElement>(null)

    useEffect(() => { loadData() }, [])

    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
        }
        window.addEventListener('keydown', h)
        return () => window.removeEventListener('keydown', h)
    }, [])

    async function loadData() {
        setLoading(true)
        try {
            const res = await apiFetch('/mcp/conversations/')
            if (res.ok) {
                const data = await res.json()
                setConversations(Array.isArray(data) ? data : data.results || [])
            }
        } catch {
            toast.error('Failed to load conversations')
        } finally {
            setLoading(false)
        }
    }

    async function confirmDeleteAction() {
        if (confirmDelete === null) return
        try {
            const res = await apiFetch(`/mcp/conversations/${confirmDelete}/`, { method: 'DELETE' })
            if (res.ok) {
                toast.success('Conversation deleted')
                if (selected?.id === confirmDelete) setSelected(null)
                await loadData()
            } else {
                toast.error('Failed to delete')
            }
        } catch {
            toast.error('Delete failed')
        }
        setConfirmDelete(null)
    }

    const filtered = conversations.filter(c =>
        !search || (c.title || '').toLowerCase().includes(search.toLowerCase())
    )
    const totalMessages = conversations.reduce((s, c) => s + (c.message_count || 0), 0)
    const totalTokens   = conversations.reduce((s, c) => s + (c.total_tokens || 0), 0)
    const avg = conversations.length ? Math.round(totalMessages / conversations.length) : 0

    const kpis = [
        { label: 'Conversations', value: conversations.length,         icon: <MessagesSquare size={14} />, color: 'var(--app-primary)' },
        { label: 'Total Messages', value: totalMessages,                icon: <Brain size={14} />,         color: '#8b5cf6' },
        { label: 'Avg Length',     value: avg,                          icon: <BarChart3 size={14} />,     color: 'var(--app-info, #3b82f6)' },
        { label: 'Total Tokens',   value: totalTokens.toLocaleString(), icon: <Calendar size={14} />,      color: 'var(--app-success, #22c55e)' },
    ]

    return (
        <ModulePage>
            <PageHeader
                icon={<MessagesSquare size={20} className="text-white" />}
                title="Conversations"
                subtitle={`${conversations.length} session${conversations.length === 1 ? '' : 's'} · ${totalMessages.toLocaleString()} messages`}
                actions={
                    <>
                        <GhostButton icon={<ArrowLeft size={13} />} label="Back" href="/mcp" />
                        <GhostButton icon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />} label="Refresh" onClick={loadData} disabled={loading} />
                    </>
                }
            />

            <KPIStrip items={kpis} />

            {/* Search */}
            <div className="mb-3 flex-shrink-0 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by title... (Ctrl+K)"
                    className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <Loading />
                ) : filtered.length === 0 ? (
                    <EmptyState icon={<MessagesSquare size={36} />}
                        title={search ? 'No matching conversations' : 'No conversations yet'}
                        description={search ? 'Try a different search.' : 'Start a chat under MCP Chat to see history appear here.'} />
                ) : (
                    <ul className="space-y-1">
                        {filtered.map(c => (
                            <li key={c.id}>
                                <a href={`/mcp/conversations/${c.id}`}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl border transition-all hover:bg-app-surface group"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                        borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)',
                                    }}>
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                        <MessagesSquare size={14} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[13px] font-bold text-app-foreground truncate">
                                            {c.title || 'Untitled'}
                                        </div>
                                        <div className="text-[10px] font-medium text-app-muted-foreground tabular-nums">
                                            {c.message_count} message{c.message_count === 1 ? '' : 's'} · {(c.total_tokens || 0).toLocaleString()} tokens · {c.provider_name || 'Unknown provider'}
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-app-muted-foreground tabular-nums hidden sm:inline">
                                        {new Date(c.updated_at).toLocaleDateString()}
                                    </span>
                                    <button onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(c.id) }}
                                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-app-border/30 transition-all"
                                        title="Delete">
                                        <Trash2 size={11} style={{ color: 'var(--app-error, #ef4444)' }} />
                                    </button>
                                    <ChevronRight size={13} className="text-app-muted-foreground" />
                                </a>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <ConfirmDialog
                open={confirmDelete !== null}
                onOpenChange={(open) => { if (!open) setConfirmDelete(null) }}
                onConfirm={confirmDeleteAction}
                title="Delete Conversation?"
                description="This will permanently remove the conversation and all its messages."
                variant="danger"
            />
        </ModulePage>
    )
}
