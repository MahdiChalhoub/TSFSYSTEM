'use client'

/**
 * MCP Conversations - History & Analytics
 * ========================================
 * Full conversation history with search, filters, analytics, and detail view.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    ArrowLeft, MessageSquare, RefreshCw, Clock, Bot, Trash2,
    Search, Filter, BarChart3, Zap, ChevronRight, Sparkles,
    MessagesSquare, Calendar, Brain, TrendingUp
} from 'lucide-react'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-fetch'

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
    const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        try {
            const res = await erpFetch('/mcp/conversations/')
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

    async function handleDelete(id: number) {
        if (!confirm('Delete this conversation permanently?')) return
        try {
            const res = await erpFetch(`/mcp/conversations/${id}/`, { method: 'DELETE' })
            if (res.ok) {
                toast.success('Conversation deleted')
                if (selectedConv?.id === id) setSelectedConv(null)
                await loadData()
            } else {
                toast.error('Failed to delete')
            }
        } catch {
            toast.error('Delete failed')
        }
    }

    const filtered = conversations.filter(c =>
        !searchQuery || (c.title || '').toLowerCase().includes(searchQuery.toLowerCase())
    )

    const totalMessages = conversations.reduce((sum, c) => sum + (c.message_count || 0), 0)
    const totalTokens = conversations.reduce((sum, c) => sum + (c.total_tokens || 0), 0)
    const avgMessages = conversations.length > 0 ? Math.round(totalMessages / conversations.length) : 0

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div>
                    <Link href="/mcp" className="text-gray-400 hover:text-gray-600 flex items-center gap-2 mb-4 text-sm font-medium transition-colors">
                        <ArrowLeft size={16} />
                        Back to MCP Dashboard
                    </Link>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg">
                            <MessagesSquare size={28} />
                        </div>
                        <Badge className="bg-green-100 text-green-700 border-green-200 px-3 py-1 font-black uppercase text-[10px]">
                            AI History
                        </Badge>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Conversations</h2>
                    <p className="text-gray-500 mt-2 font-medium">
                        Browse and manage your AI conversation history
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button
                        onClick={loadData}
                        disabled={loading}
                        variant="outline"
                        className="rounded-2xl px-6 py-5 font-bold"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </Button>
                    <Link href="/mcp/chat">
                        <Button className="rounded-2xl px-6 py-5 font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25">
                            <Sparkles size={18} />
                            New Chat
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Analytics Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-green-500 to-emerald-600 border-0 text-white rounded-3xl shadow-xl">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-3">
                            <MessagesSquare size={20} className="text-green-200" />
                            <Badge className="bg-white/20 text-white border-0 text-[10px] font-bold">Total</Badge>
                        </div>
                        <div className="text-4xl font-black">{conversations.length}</div>
                        <p className="text-green-100 text-sm mt-1 font-medium">Conversations</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 border-0 text-white rounded-3xl shadow-xl">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-3">
                            <MessageSquare size={20} className="text-blue-200" />
                            <Badge className="bg-white/20 text-white border-0 text-[10px] font-bold">Messages</Badge>
                        </div>
                        <div className="text-4xl font-black">{totalMessages.toLocaleString()}</div>
                        <p className="text-blue-100 text-sm mt-1 font-medium">Total messages</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500 to-violet-600 border-0 text-white rounded-3xl shadow-xl">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-3">
                            <Zap size={20} className="text-purple-200" />
                            <Badge className="bg-white/20 text-white border-0 text-[10px] font-bold">Tokens</Badge>
                        </div>
                        <div className="text-4xl font-black">{(totalTokens / 1000).toFixed(1)}K</div>
                        <p className="text-purple-100 text-sm mt-1 font-medium">Tokens consumed</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-500 to-orange-600 border-0 text-white rounded-3xl shadow-xl">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-3">
                            <TrendingUp size={20} className="text-amber-200" />
                            <Badge className="bg-white/20 text-white border-0 text-[10px] font-bold">Avg</Badge>
                        </div>
                        <div className="text-4xl font-black">{avgMessages}</div>
                        <p className="text-amber-100 text-sm mt-1 font-medium">Msgs per conversation</p>
                    </CardContent>
                </Card>
            </div>

            {/* Search & Filter Bar */}
            <Card className="rounded-2xl shadow-lg border-gray-100">
                <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <Input
                                placeholder="Search conversations by title..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-11 rounded-xl border-gray-200 bg-gray-50/50 h-12"
                            />
                        </div>
                        <Button variant="outline" className="rounded-xl h-12 px-4">
                            <Filter size={16} />
                            Filters
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Conversations List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-4">
                        <RefreshCw className="w-10 h-10 animate-spin text-green-500" />
                        <p className="text-gray-400 font-medium">Loading conversations...</p>
                    </div>
                </div>
            ) : filtered.length === 0 ? (
                <Card className="rounded-3xl shadow-xl border-gray-100">
                    <CardContent className="p-0">
                        <div className="text-center py-20">
                            <div className="p-6 rounded-[2rem] bg-gradient-to-br from-purple-50 to-indigo-50 w-fit mx-auto mb-6">
                                <Brain className="w-16 h-16 text-purple-400" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">
                                {searchQuery ? 'No matching conversations' : 'No conversations yet'}
                            </h3>
                            <p className="text-gray-500 mb-6 max-w-md mx-auto">
                                {searchQuery
                                    ? `No conversations found matching "${searchQuery}"`
                                    : 'Start your first AI conversation to unlock intelligent insights and automation.'
                                }
                            </p>
                            {!searchQuery && (
                                <Link href="/mcp/chat">
                                    <Button className="rounded-2xl px-8 py-6 font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25">
                                        <Sparkles size={18} />
                                        Start Your First Conversation
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="rounded-3xl shadow-xl border-gray-100 overflow-hidden">
                    <CardContent className="p-0">
                        <div className="divide-y divide-gray-100">
                            {filtered.map((conv, idx) => (
                                <div
                                    key={conv.id}
                                    className={`flex items-center justify-between p-5 hover:bg-gray-50/80 transition-all cursor-pointer group ${idx === 0 ? '' : ''
                                        }`}
                                    onClick={() => setSelectedConv(selectedConv?.id === conv.id ? null : conv)}
                                >
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className="p-3 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 text-green-600 border border-green-100 group-hover:from-green-100 group-hover:to-emerald-100 transition-colors shrink-0">
                                            <Bot size={20} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-bold text-gray-900 truncate group-hover:text-green-700 transition-colors">
                                                {conv.title || 'Untitled Conversation'}
                                            </h3>
                                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                                <Badge variant="outline" className="text-[10px] font-bold border-gray-200 text-gray-500">
                                                    <MessageSquare size={10} className="mr-1" />
                                                    {conv.message_count || 0} msgs
                                                </Badge>
                                                {conv.provider_name && (
                                                    <Badge className="text-[10px] font-bold bg-purple-50 text-purple-600 border-purple-200">
                                                        <Zap size={10} className="mr-1" />
                                                        {conv.provider_name}
                                                    </Badge>
                                                )}
                                                {conv.total_tokens > 0 && (
                                                    <Badge className="text-[10px] font-bold bg-blue-50 text-blue-600 border-blue-200">
                                                        <BarChart3 size={10} className="mr-1" />
                                                        {(conv.total_tokens / 1000).toFixed(1)}K tokens
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0 ml-4">
                                        <div className="text-right hidden md:block">
                                            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                                                <Calendar size={12} />
                                                {new Date(conv.created_at).toLocaleDateString()}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] text-gray-300 mt-1">
                                                <Clock size={10} />
                                                Updated {new Date(conv.updated_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={(e) => { e.stopPropagation(); handleDelete(conv.id) }}
                                            className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                        <ChevronRight size={16} className="text-gray-300 group-hover:text-green-500 transition-colors" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Quick Info Footer */}
            <div className="flex items-center justify-center gap-6 text-xs text-gray-400 font-medium py-2">
                <span className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    {conversations.length} total conversations
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    {totalMessages} total messages
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    {(totalTokens / 1000).toFixed(1)}K tokens used
                </span>
            </div>
        </div>
    )
}
