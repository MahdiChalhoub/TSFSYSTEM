// @ts-nocheck
'use client'

/**
 * MCP Conversations — V2 Dajingo Pro Redesign
 * =============================================
 * Premium conversation history with analytics strip,
 * search, and theme-aware card layout.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    MessageSquare, RefreshCw, Clock, Bot, Trash2,
    Search, BarChart3, Zap, ChevronRight, Sparkles,
    MessagesSquare, Calendar, Brain, TrendingUp
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

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
    const [searchQuery, setSearchQuery] = useState('')
    const [deleteConvId, setDeleteConvId] = useState<number | null>(null)

    useEffect(() => { loadData() }, [])

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

    async function confirmDeleteConv() {
        if (deleteConvId === null) return
        try {
            const res = await apiFetch(`/mcp/conversations/${deleteConvId}/`, { method: 'DELETE' })
            if (res.ok) {
                toast.success('Conversation deleted')
                await loadData()
            } else {
                toast.error('Failed to delete')
            }
        } catch {
            toast.error('Delete failed')
        }
        setDeleteConvId(null)
    }

    const filtered = conversations.filter(c =>
        !searchQuery || (c.title || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
    const totalMessages = conversations.reduce((sum, c) => sum + (c.message_count || 0), 0)
    const totalTokens = conversations.reduce((sum, c) => sum + (c.total_tokens || 0), 0)
    const avgMessages = conversations.length > 0 ? Math.round(totalMessages / conversations.length) : 0

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
                            <MessagesSquare className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
                                Conversations
                            </h1>
                            <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                                Browse and manage AI conversation history
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button onClick={loadData} disabled={loading} variant="outline"
                            className="rounded-xl px-4 h-11 font-bold" style={{ borderColor: 'var(--app-border)' }}>
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </Button>
                        <Link href="/mcp/chat">
                            <Button className="rounded-xl px-5 h-11 font-bold text-white"
                                style={{ background: 'var(--app-primary)', boxShadow: '0 4px 14px var(--app-primary-glow)' }}>
                                <Sparkles size={16} className="mr-2" />
                                New Chat
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Stats Strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                    {[
                        { label: 'Conversations', value: conversations.length, icon: MessagesSquare },
                        { label: 'Messages', value: totalMessages.toLocaleString(), icon: MessageSquare },
                        { label: 'Tokens Used', value: totalTokens > 0 ? `${(totalTokens / 1000).toFixed(1)}K` : '0', icon: Zap },
                        { label: 'Avg Msgs', value: avgMessages, icon: TrendingUp },
                    ].map((stat, i) => (
                        <div key={i} className="rounded-xl p-3"
                            style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                            <div className="flex items-center gap-2 mb-1">
                                <stat.icon size={14} style={{ color: 'var(--app-text-muted)' }} />
                                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>
                                    {stat.label}
                                </span>
                            </div>
                            <p className="text-lg font-black" style={{ color: 'var(--app-text)' }}>{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* Search */}
                <div className="mt-4 relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-text-muted)' }} />
                    <Input
                        placeholder="Search conversations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 rounded-xl h-10"
                        style={{ background: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                    />
                </div>
            </div>

            {/* ── Conversations List ──────────────────────────────── */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-3">
                        <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--app-primary)' }} />
                        <p className="text-sm font-medium" style={{ color: 'var(--app-text-muted)' }}>Loading conversations...</p>
                    </div>
                </div>
            ) : filtered.length === 0 ? (
                <div className="rounded-[28px] p-12 text-center"
                    style={{ background: 'var(--app-surface)', border: '2px dashed var(--app-border)' }}>
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                        style={{ background: 'var(--app-primary-light)' }}>
                        <Brain className="w-8 h-8" style={{ color: 'var(--app-primary)' }} />
                    </div>
                    <h3 className="text-xl font-black mb-2" style={{ color: 'var(--app-text)' }}>
                        {searchQuery ? 'No Matching Conversations' : 'No Conversations Yet'}
                    </h3>
                    <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--app-text-muted)' }}>
                        {searchQuery
                            ? `No conversations found matching "${searchQuery}"`
                            : 'Start your first AI conversation to unlock intelligent insights.'}
                    </p>
                    {!searchQuery && (
                        <Link href="/mcp/chat">
                            <Button className="rounded-xl px-6 h-11 font-bold text-white"
                                style={{ background: 'var(--app-primary)', boxShadow: '0 4px 14px var(--app-primary-glow)' }}>
                                <Sparkles size={16} className="mr-2" />
                                Start Your First Conversation
                            </Button>
                        </Link>
                    )}
                </div>
            ) : (
                <div className="rounded-[28px] overflow-hidden"
                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: 'var(--app-shadow-lg)' }}>
                    <div className="divide-y" style={{ borderColor: 'var(--app-border)' }}>
                        {filtered.map((conv) => (
                            <div
                                key={conv.id}
                                className="flex items-center justify-between p-5 transition-all cursor-pointer group"
                                style={{ borderColor: 'var(--app-border)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--app-surface-2)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ background: 'var(--app-primary-light)' }}>
                                        <Bot size={18} style={{ color: 'var(--app-primary)' }} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-bold text-[14px] truncate" style={{ color: 'var(--app-text)' }}>
                                            {conv.title || 'Untitled Conversation'}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}>
                                                <MessageSquare size={9} className="inline mr-1" />
                                                {conv.message_count || 0} msgs
                                            </span>
                                            {conv.provider_name && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                                    style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)' }}>
                                                    <Zap size={9} className="inline mr-1" />
                                                    {conv.provider_name}
                                                </span>
                                            )}
                                            {conv.total_tokens > 0 && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                                    style={{ background: 'var(--app-info-light)', color: 'var(--app-info)' }}>
                                                    <BarChart3 size={9} className="inline mr-1" />
                                                    {(conv.total_tokens / 1000).toFixed(1)}K
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0 ml-4">
                                    <div className="text-right hidden md:block">
                                        <div className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: 'var(--app-text-muted)' }}>
                                            <Calendar size={11} />
                                            {new Date(conv.created_at).toLocaleDateString()}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] mt-0.5" style={{ color: 'var(--app-text-faint)' }}>
                                            <Clock size={9} />
                                            Updated {new Date(conv.updated_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <Button size="sm" variant="ghost"
                                        onClick={(e) => { e.stopPropagation(); setDeleteConvId(conv.id) }}
                                        className="rounded-lg h-8 px-2 opacity-0 group-hover:opacity-100 transition-all text-red-500 hover:text-red-600 hover:bg-red-500/10">
                                        <Trash2 size={14} />
                                    </Button>
                                    <ChevronRight size={16} style={{ color: 'var(--app-text-faint)' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={deleteConvId !== null}
                onOpenChange={(open) => { if (!open) setDeleteConvId(null) }}
                onConfirm={confirmDeleteConv}
                title="Delete Conversation?"
                description="This conversation will be permanently deleted."
                variant="danger"
            />
        </div>
    )
}
