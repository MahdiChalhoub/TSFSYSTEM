// @ts-nocheck
'use client'

/**
 * MCP AI Connector - Dashboard
 * ============================
 * Overview of AI integration status, providers, and usage.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Bot, Cloud, Wrench, MessageSquare, BarChart3,
    ArrowRight, RefreshCw, Zap, Settings
} from 'lucide-react'
import { toast } from 'sonner'
import { getMCPDashboard } from '@/app/actions/saas/mcp'

interface DashboardData {
    connection: {
        status: string
        provider_name: string
        total_requests: number
        total_tokens_used: number
    } | null
    providers_count: number
    tools_count: number
    usage_30d: {
        requests: number
        tokens: number
        cost: number
    }
    recent_conversations: Array<{
        id: number
        title: string
        message_count: number
        updated_at: string
    }>
}

export default function MCPDashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        try {
            const result = await getMCPDashboard()
            setData(result)
        } catch {
            toast.error('Failed to load dashboard')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg">
                            <Bot size={28} />
                        </div>
                    </div>
                    <h2 className="text-3xl font-black text-app-text tracking-tight">AI Intelligence</h2>
                    <p className="text-app-text-faint mt-2 font-medium">
                        Autonomous agents and AI-powered automation
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
                    <Link href="/mcp/settings">
                        <Button variant="outline" className="rounded-2xl px-6 py-5 font-bold">
                            <Settings size={18} />
                            Settings
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="rounded-2xl shadow-lg border-app-border">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 rounded-xl bg-purple-100 text-purple-600">
                                <Cloud size={24} />
                            </div>
                            <Badge variant="outline" className="text-purple-600 border-purple-200">
                                Providers
                            </Badge>
                        </div>
                        <div className="text-3xl font-black text-app-text">
                            {data?.providers_count || 0}
                        </div>
                        <p className="text-sm text-app-text-faint mt-1">AI providers configured</p>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-lg border-app-border">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600">
                                <Sparkles size={24} />
                            </div>
                            <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                                Agents
                            </Badge>
                        </div>
                        <div className="text-3xl font-black text-app-text">
                            {data?.agents_count || 0}
                        </div>
                        <p className="text-sm text-app-text-faint mt-1">Active virtual employees</p>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-lg border-app-border">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
                                <Wrench size={24} />
                            </div>
                            <Badge variant="outline" className="text-blue-600 border-blue-200">
                                Tools
                            </Badge>
                        </div>
                        <div className="text-3xl font-black text-app-text">
                            {data?.tools_count || 0}
                        </div>
                        <p className="text-sm text-app-text-faint mt-1">Tools exposed to AI</p>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-lg border-app-border">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 rounded-xl bg-green-100 text-green-600">
                                <Zap size={24} />
                            </div>
                            <Badge variant="outline" className="text-green-600 border-green-200">
                                30 Days
                            </Badge>
                        </div>
                        <div className="text-3xl font-black text-app-text">
                            {data?.usage_30d?.requests?.toLocaleString() || 0}
                        </div>
                        <p className="text-sm text-app-text-faint mt-1">API requests</p>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-lg border-app-border">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 rounded-xl bg-amber-100 text-amber-600">
                                <BarChart3 size={24} />
                            </div>
                            <Badge variant="outline" className="text-amber-600 border-amber-200">
                                Tokens
                            </Badge>
                        </div>
                        <div className="text-3xl font-black text-app-text">
                            {((data?.usage_30d?.tokens || 0) / 1000).toFixed(1)}K
                        </div>
                        <p className="text-sm text-app-text-faint mt-1">Tokens used (30d)</p>
                    </CardContent>
                </Card>
            </div>

            {/* Navigation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Link href="/mcp/chat">
                    <Card className="rounded-2xl shadow-lg border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 hover:shadow-xl transition-shadow cursor-pointer group">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
                                    <Bot size={24} />
                                </div>
                                <ArrowRight className="text-purple-300 group-hover:text-purple-500 transition-colors" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <CardTitle className="text-lg mb-1 text-purple-900">AI Chat</CardTitle>
                            <p className="text-sm text-purple-600">
                                Start a conversation with AI
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/mcp/providers">
                    <Card className="rounded-2xl shadow-lg border-app-border hover:shadow-xl transition-shadow cursor-pointer group">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div className="p-3 rounded-xl bg-purple-100 text-purple-600">
                                    <Cloud size={24} />
                                </div>
                                <ArrowRight className="text-gray-300 group-hover:text-purple-500 transition-colors" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <CardTitle className="text-lg mb-1">AI Providers</CardTitle>
                            <p className="text-sm text-app-text-faint">
                                Configure OpenAI, Claude, Gemini, etc.
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/mcp/tools">
                    <Card className="rounded-2xl shadow-lg border-app-border hover:shadow-xl transition-shadow cursor-pointer group">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
                                    <Wrench size={24} />
                                </div>
                                <ArrowRight className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <CardTitle className="text-lg mb-1">MCP Tools</CardTitle>
                            <p className="text-sm text-app-text-faint">
                                Define tools AI can use
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/mcp/conversations">
                    <Card className="rounded-2xl shadow-lg border-app-border hover:shadow-xl transition-shadow cursor-pointer group">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div className="p-3 rounded-xl bg-green-100 text-green-600">
                                    <MessageSquare size={24} />
                                </div>
                                <ArrowRight className="text-gray-300 group-hover:text-green-500 transition-colors" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <CardTitle className="text-lg mb-1">Conversations</CardTitle>
                            <p className="text-sm text-app-text-faint">
                                View AI chat history
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/mcp/usage">
                    <Card className="rounded-2xl shadow-lg border-app-border hover:shadow-xl transition-shadow cursor-pointer group">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div className="p-3 rounded-xl bg-amber-100 text-amber-600">
                                    <BarChart3 size={24} />
                                </div>
                                <ArrowRight className="text-gray-300 group-hover:text-amber-500 transition-colors" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <CardTitle className="text-lg mb-1">Usage & Billing</CardTitle>
                            <p className="text-sm text-app-text-faint">
                                Track token usage and costs
                            </p>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            {/* Recent Conversations */}
            <Card className="rounded-2xl shadow-lg border-app-border">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquare size={20} />
                        Recent Conversations
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {data?.recent_conversations?.length ? (
                        <div className="space-y-3">
                            {data.recent_conversations.map((conv) => (
                                <Link
                                    key={conv.id}
                                    href={`/mcp/conversations/${conv.id}`}
                                    className="flex items-center justify-between p-3 rounded-xl bg-app-bg hover:bg-app-surface-2 transition-colors"
                                >
                                    <div>
                                        <p className="font-medium text-app-text">
                                            {conv.title || 'Untitled'}
                                        </p>
                                        <p className="text-sm text-app-text-faint">
                                            {conv.message_count} messages
                                        </p>
                                    </div>
                                    <span className="text-xs text-app-text-faint">
                                        {new Date(conv.updated_at).toLocaleDateString()}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-app-text-faint">
                            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No conversations yet</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Getting Started */}
            {!data?.providers_count && (
                <Card className="rounded-2xl shadow-lg border-purple-100 bg-gradient-to-br from-purple-50 to-indigo-50">
                    <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                            <div className="p-3 rounded-xl bg-purple-100 text-purple-600">
                                <Bot size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-app-text mb-2">Get Started with AI Integration</h3>
                                <p className="text-app-text-muted mb-4">
                                    Connect your AI providers to enable intelligent automation across your platform.
                                </p>
                                <div className="flex gap-3">
                                    <Link href="/mcp/providers">
                                        <Button className="rounded-xl bg-purple-600 hover:bg-purple-500">
                                            <Cloud size={16} />
                                            Add Provider
                                        </Button>
                                    </Link>
                                    <Link href="/mcp/tools">
                                        <Button variant="outline" className="rounded-xl">
                                            <Wrench size={16} />
                                            Configure Tools
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
