'use client'

/**
 * MCP AI Chat Interface
 * ======================
 * Chat with AI using your organization's configured provider.
 * AI has access to MCP tools for querying ERP data.
 */

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    ArrowLeft, Send, Bot, User, Loader2, RefreshCw, Plus,
    MessageSquare, Wrench, Sparkles, AlertCircle, ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import {
    getMCPProviders, getMCPConversations, sendMCPChat
} from '@/app/actions/saas/mcp'

interface Message {
    id: string
    role: 'user' | 'assistant' | 'tool'
    content: string
    tool_calls?: ToolCall[]
    timestamp: Date
}

interface ToolCall {
    name: string
    arguments: Record<string, any>
    result?: string
}

interface Provider {
    id: number
    name: string
    provider_type: string
    model_name: string
    is_default: boolean
}

interface Conversation {
    id: number
    title: string
    created_at: string
    message_count: number
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
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        loadInitialData()
    }, [])

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    async function loadInitialData() {
        setLoading(true)
        try {
            const [providersData, convsData] = await Promise.all([
                getMCPProviders(),
                getMCPConversations()
            ])
            setProviders(providersData)
            setConversations(convsData)

            // Select default provider
            const defaultProvider = providersData.find((p: Provider) => p.is_default)
            if (defaultProvider) {
                setSelectedProvider(defaultProvider.id)
            } else if (providersData.length > 0) {
                setSelectedProvider(providersData[0].id)
            }
        } catch {
            toast.error('Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    function scrollToBottom() {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    function startNewConversation() {
        setCurrentConversation(null)
        setMessages([])
    }

    async function handleSend() {
        if (!input.trim() || !selectedProvider) return
        if (sending) return

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: input.trim(),
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMessage])
        setInput('')
        setSending(true)

        try {
            const response = await sendMCPChat({
                message: userMessage.content,
                provider_id: selectedProvider,
                conversation_id: currentConversation || undefined,
                include_tools: true
            })

            if (!response.success) {
                throw new Error(response.error || 'Failed to get response')
            }

            // Update conversation ID if new
            if (response.conversation_id && !currentConversation) {
                setCurrentConversation(response.conversation_id)
            }

            // Add tool calls if any
            if (response.tool_calls && response.tool_calls.length > 0) {
                const toolMessage: Message = {
                    id: `tool-${Date.now()}`,
                    role: 'tool',
                    content: 'Executed tools',
                    tool_calls: response.tool_calls,
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, toolMessage])
            }

            // Add assistant response
            const assistantMessage: Message = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: response.content || 'No response',
                timestamp: new Date()
            }
            setMessages(prev => [...prev, assistantMessage])

            // Refresh conversations
            const convsData = await getMCPConversations()
            setConversations(convsData)

        } catch (e: any) {
            toast.error(e.message)
            // Remove the user message on error
            setMessages(prev => prev.filter(m => m.id !== userMessage.id))
        } finally {
            setSending(false)
        }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const getProviderLabel = (type: string) => {
        const labels: Record<string, string> = {
            openai: 'OpenAI',
            anthropic: 'Claude',
            google: 'Gemini',
            azure: 'Azure',
            ollama: 'Ollama',
            custom: 'Custom'
        }
        return labels[type] || type
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        )
    }

    if (providers.length === 0) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <Link href="/saas/mcp" className="text-gray-400 hover:text-gray-600 flex items-center gap-2 text-sm font-medium">
                    <ArrowLeft size={16} />
                    Back to MCP Dashboard
                </Link>

                <Card className="rounded-3xl shadow-xl border-gray-100">
                    <CardContent className="p-12 text-center">
                        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-amber-500" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">No AI Providers Configured</h2>
                        <p className="text-gray-500 mb-6">
                            You need to configure at least one AI provider to use the chat.
                        </p>
                        <Link href="/saas/mcp/providers">
                            <Button className="bg-purple-600 hover:bg-purple-500">
                                <Plus size={16} />
                                Add AI Provider
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="h-[calc(100vh-120px)] flex flex-col animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <Link href="/saas/mcp" className="text-gray-400 hover:text-gray-600">
                        <ArrowLeft size={20} />
                    </Link>
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">AI Assistant</h1>
                            <p className="text-xs text-gray-500">Powered by MCP</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Select
                        value={selectedProvider?.toString()}
                        onValueChange={(v) => setSelectedProvider(parseInt(v))}
                    >
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                            {providers.map((p) => (
                                <SelectItem key={p.id} value={p.id.toString()}>
                                    {p.name} ({getProviderLabel(p.provider_type)})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button
                        variant="outline"
                        onClick={startNewConversation}
                        className="rounded-xl"
                    >
                        <Plus size={16} />
                        New Chat
                    </Button>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex gap-4 min-h-0">
                {/* Sidebar - Conversations */}
                <div className="w-64 flex-shrink-0 hidden lg:block">
                    <Card className="h-full rounded-2xl shadow-lg border-gray-100">
                        <CardContent className="p-3 h-full overflow-y-auto">
                            <p className="text-xs font-semibold text-gray-400 uppercase mb-2 px-2">
                                Recent Chats
                            </p>

                            {conversations.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-8">
                                    No conversations yet
                                </p>
                            ) : (
                                <div className="space-y-1">
                                    {conversations.slice(0, 10).map((conv) => (
                                        <button
                                            key={conv.id}
                                            onClick={() => {
                                                setCurrentConversation(conv.id)
                                                // TODO: Load conversation messages
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${currentConversation === conv.id
                                                ? 'bg-purple-100 text-purple-700'
                                                : 'hover:bg-gray-100 text-gray-700'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <MessageSquare size={14} />
                                                <span className="truncate">{conv.title || 'Untitled'}</span>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1">
                                                {conv.message_count} messages
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Chat Messages */}
                <Card className="flex-1 rounded-2xl shadow-lg border-gray-100 flex flex-col min-h-0">
                    <CardContent className="flex-1 p-4 overflow-y-auto">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <Bot className="w-16 h-16 mb-4 opacity-50" />
                                <p className="text-lg font-medium">Start a conversation</p>
                                <p className="text-sm mt-1">Ask about inventory, sales, finance, or customers</p>

                                <div className="flex flex-wrap gap-2 mt-6 justify-center">
                                    {['What are today\'s sales?', 'Show low stock products', 'Financial summary'].map((q) => (
                                        <button
                                            key={q}
                                            onClick={() => setInput(q)}
                                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-600 transition-colors"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {messages.map((msg) => (
                                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'
                                        }`}>
                                        {msg.role !== 'user' && (
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'assistant'
                                                ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white'
                                                : 'bg-blue-100 text-blue-600'
                                                }`}>
                                                {msg.role === 'assistant' ? <Bot size={16} /> : <Wrench size={14} />}
                                            </div>
                                        )}

                                        <div className={`max-w-[70%] ${msg.role === 'user'
                                            ? 'bg-purple-600 text-white rounded-2xl rounded-br-md px-4 py-3'
                                            : msg.role === 'tool'
                                                ? 'bg-blue-50 text-blue-800 rounded-2xl px-4 py-3'
                                                : 'bg-gray-100 text-gray-800 rounded-2xl rounded-bl-md px-4 py-3'
                                            }`}>
                                            {msg.role === 'tool' && msg.tool_calls ? (
                                                <div className="space-y-2">
                                                    <p className="text-xs font-medium text-blue-600 flex items-center gap-1">
                                                        <Wrench size={12} />
                                                        Tool Execution
                                                    </p>
                                                    {msg.tool_calls.map((tc, i) => (
                                                        <div key={i} className="text-sm">
                                                            <code className="bg-blue-100 px-2 py-0.5 rounded text-xs">
                                                                {tc.name}
                                                            </code>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                            )}
                                        </div>

                                        {msg.role === 'user' && (
                                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                                <User size={16} className="text-gray-600" />
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {sending && (
                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                                            <Loader2 size={16} className="animate-spin text-white" />
                                        </div>
                                        <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                                            <p className="text-sm text-gray-500">Thinking...</p>
                                        </div>
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </CardContent>

                    {/* Input Area */}
                    <div className="p-4 border-t border-gray-100">
                        <div className="flex gap-3">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask about your business data..."
                                className="flex-1 rounded-xl bg-gray-50 border-gray-200"
                                disabled={sending}
                            />
                            <Button
                                onClick={handleSend}
                                disabled={!input.trim() || sending}
                                className="rounded-xl bg-purple-600 hover:bg-purple-500 px-6"
                            >
                                {sending ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <Send size={18} />
                                )}
                            </Button>
                        </div>
                        <p className="text-xs text-gray-400 mt-2 text-center">
                            AI has access to inventory, finance, sales, and CRM data
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    )
}
