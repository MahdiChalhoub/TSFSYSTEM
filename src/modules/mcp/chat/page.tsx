// @ts-nocheck
'use client'

/**
 * MCP AI Chat Interface - Enhanced with Charts & Analytics
 * =========================================================
 * Full AI capabilities: charts, analysis, dynamic interfaces, saved reports.
 */

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    ArrowLeft, Send, Bot, User, Loader2, RefreshCw, Plus,
    MessageSquare, Wrench, Sparkles, AlertCircle, BarChart3,
    TrendingUp, Save, Download, Lightbulb, Target, FileText
} from 'lucide-react'
import { toast } from 'sonner'
import {
    getMCPProviders, getMCPConversations, sendMCPChat
} from '@/app/actions/saas/mcp'
import { AIChart, AIInsightCard, AIStrategyCard, parseChartFromResponse } from '@/components/ai/AICharts'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import * as XLSX from 'xlsx'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Message {
    id: string
    role: 'user' | 'assistant' | 'tool' | 'chart' | 'insight' | 'strategy'
    content: string
    data?: Record<string, any>
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

// Quick action templates
const QUICK_ACTIONS = [
    {
        label: '📊 Sales Trend',
        prompt: 'Show me a chart of sales trends for the last 6 months. Include analysis and recommendations.'
    },
    {
        label: '📦 Low Stock Alert',
        prompt: 'Create a report of products with low stock levels. Show as a chart and suggest reorder strategy.'
    },
    {
        label: '💰 Financial Review',
        prompt: 'Analyze my financial performance this quarter. Show revenue vs expenses chart and strategic recommendations.'
    },
    {
        label: '👥 Customer Insights',
        prompt: 'Analyze my top customers and their purchase patterns. Create a pie chart of revenue by customer segment.'
    },
    {
        label: '🎯 Strategy',
        prompt: 'Based on my current inventory, sales, and financial data, provide 5 strategic recommendations for growth.'
    },
    {
        label: '📈 Forecast',
        prompt: 'Create a sales forecast for the next 3 months based on historical data. Show as a trend chart.'
    },
]

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
    const chatContainerRef = useRef<HTMLDivElement>(null)

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
        setShowQuickActions(true)
    }

    function handleQuickAction(prompt: string) {
        setInput(prompt)
        setShowQuickActions(false)
    }

    async function handleSend() {
        if (!input.trim() || !selectedProvider) return
        if (sending) return

        setShowQuickActions(false)

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
            // Enhanced system prompt for analytics
            const enhancedPrompt = `${userMessage.content}

IMPORTANT: When providing data analysis:
1. If showing data that can be visualized, include a chart in this JSON format:
   \`\`\`chart
   {"type": "bar|line|pie|area", "title": "Chart Title", "data": [...], "xKey": "name", "yKeys": ["value"]}
   \`\`\`

2. If providing insights, format them as:
   **Key Insight:** [insight title]
   - [detail]

3. If making strategic recommendations, format as numbered list with:
   - Priority (High/Medium/Low)
   - Action item
   - Expected impact
   - Timeline

Always be specific with numbers and actionable recommendations.`

            const response = await sendMCPChat({
                message: enhancedPrompt,
                provider_id: selectedProvider,
                conversation_id: currentConversation || undefined,
                include_tools: true
            })

            if (!response.success) {
                throw new Error(response.error || 'Failed to get response')
            }

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

            // Parse response for charts
            const chartData = parseChartFromResponse(response.content || '')
            if (chartData) {
                const chartMessage: Message = {
                    id: `chart-${Date.now()}`,
                    role: 'chart',
                    content: 'Generated visualization',
                    data: chartData,
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, chartMessage])
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

        } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)))
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

    async function handleSaveReport() {
        if (messages.length === 0) return

        let md = '# AI Business Analysis Report\n\n'
        md += `Generated on: ${new Date().toLocaleString()}\n\n---\n\n`

        messages.forEach(msg => {
            const roleStr = msg.role.charAt(0).toUpperCase() + msg.role.slice(1)
            md += `### ${roleStr}\n`
            if (msg.role === 'chart') {
                md += `*[Visual Chart: ${msg.data?.title || 'Data view'}]*\n\n`
            } else if (msg.role === 'tool' && msg.tool_calls) {
                md += `*Executed tools: ${msg.tool_calls.map(tc => tc.name).join(', ')}*\n\n`
            } else {
                md += `${msg.content}\n\n`
            }
        })

        const blob = new Blob([md], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'ai_analysis_report.md'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        toast.success('Report saved as Markdown document')
    }

    async function handleExportPDF() {
        if (!chatContainerRef.current) return
        try {
            toast.loading('Generating PDF...', { id: 'pdf-export' })
            const canvas = await html2canvas(chatContainerRef.current, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            })
            const imgData = canvas.toDataURL('image/png')
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [canvas.width, canvas.height]
            })
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
            pdf.save('ai_analysis_report.pdf')
            toast.success('PDF saved successfully!', { id: 'pdf-export' })
        } catch (error) {
            toast.error('Failed to generate PDF', { id: 'pdf-export' })
        }
    }

    async function handleExportExcel() {
        if (messages.length === 0) return
        try {
            const data = messages.map(msg => ({
                Time: new Date(msg.timestamp).toLocaleString(),
                Role: msg.role.toUpperCase(),
                Content: msg.role === 'chart' ? '[Visual Chart Data]' : msg.content,
                Details: msg.tool_calls ? 'Used tools: ' + msg.tool_calls.map(tc => tc.name).join(', ') : ''
            }))

            const ws = XLSX.utils.json_to_sheet(data)
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, "Chat History")
            XLSX.writeFile(wb, "ai_chat_export.xlsx")
            toast.success('Excel file saved successfully!')
        } catch (error) {
            toast.error('Failed to generate Excel file')
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
                <Link href="/mcp" className="text-app-text-faint hover:text-app-text-muted flex items-center gap-2 text-sm font-medium">
                    <ArrowLeft size={16} />
                    Back to MCP Dashboard
                </Link>

                <Card className="rounded-3xl shadow-xl border-app-border">
                    <CardContent className="p-12 text-center">
                        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-amber-500" />
                        <h2 className="text-2xl font-bold text-app-text mb-2">No AI Providers Configured</h2>
                        <p className="text-app-text-faint mb-6">
                            Configure an AI provider to unlock full analytics capabilities.
                        </p>
                        <Link href="/mcp/providers">
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
                    <Link href="/mcp" className="text-app-text-faint hover:text-app-text-muted">
                        <ArrowLeft size={20} />
                    </Link>
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-app-text">AI Analytics Assistant</h1>
                            <p className="text-xs text-app-text-faint">Charts • Analysis • Strategy</p>
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

                    {messages.length > 0 && (
                        <>
                            <Button variant="outline" size="sm" onClick={handleSaveReport}>
                                <Save size={14} className="mr-2" />
                                Save as Report
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        <Download size={14} className="mr-2" />
                                        Export
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={handleExportPDF}>
                                        Export as PDF
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleExportExcel}>
                                        Export as Excel
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </>
                    )}

                    <Button
                        variant="outline"
                        onClick={startNewConversation}
                        className="rounded-xl"
                    >
                        <Plus size={16} />
                        New
                    </Button>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex gap-4 min-h-0">
                {/* Sidebar - Conversations */}
                <div className="w-64 flex-shrink-0 hidden lg:block">
                    <Card className="h-full rounded-2xl shadow-lg border-app-border">
                        <CardContent className="p-3 h-full overflow-y-auto">
                            <p className="text-xs font-semibold text-app-text-faint uppercase mb-2 px-2">
                                Recent Analysis
                            </p>

                            {conversations.length === 0 ? (
                                <p className="text-sm text-app-text-faint text-center py-8">
                                    No conversations yet
                                </p>
                            ) : (
                                <div className="space-y-1">
                                    {conversations.slice(0, 10).map((conv) => (
                                        <button
                                            key={conv.id}
                                            onClick={() => setCurrentConversation(conv.id)}
                                            className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${currentConversation === conv.id
                                                ? 'bg-purple-100 text-purple-700'
                                                : 'hover:bg-app-surface-2 text-app-text-muted'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <BarChart3 size={14} />
                                                <span className="truncate">{conv.title || 'Analysis'}</span>
                                            </div>
                                            <p className="text-xs text-app-text-faint mt-1">
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
                <Card className="flex-1 rounded-2xl shadow-lg border-app-border flex flex-col min-h-0">
                    <CardContent className="flex-1 p-4 overflow-y-auto">
                        {messages.length === 0 && showQuickActions ? (
                            <div className="h-full flex flex-col items-center justify-center">
                                <div className="text-center mb-8">
                                    <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 inline-block mb-4">
                                        <Sparkles className="w-12 h-12 text-purple-600" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-app-text mb-2">AI Business Analytics</h2>
                                    <p className="text-app-text-faint max-w-md">
                                        Get instant charts, data analysis, and strategic recommendations powered by AI
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl">
                                    {QUICK_ACTIONS.map((action, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleQuickAction(action.prompt)}
                                            className="p-4 bg-app-surface border border-app-border rounded-xl hover:border-purple-300 hover:shadow-md transition-all text-left group"
                                        >
                                            <span className="text-lg">{action.label.split(' ')[0]}</span>
                                            <p className="text-sm font-medium text-app-text-muted group-hover:text-purple-700 mt-1">
                                                {action.label.split(' ').slice(1).join(' ')}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4" ref={chatContainerRef}>
                                {messages.map((msg) => (
                                    <div key={msg.id}>
                                        {/* Chart messages */}
                                        {msg.role === 'chart' && msg.data && (
                                            <div className="my-4">
                                                <AIChart chart={msg.data} />
                                            </div>
                                        )}

                                        {/* Regular messages */}
                                        {msg.role !== 'chart' && (
                                            <div className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'
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
                                                        : 'bg-app-surface-2 text-app-text rounded-2xl rounded-bl-md px-4 py-3'
                                                    }`}>
                                                    {msg.role === 'tool' && msg.tool_calls ? (
                                                        <div className="space-y-2">
                                                            <p className="text-xs font-medium text-blue-600 flex items-center gap-1">
                                                                <Wrench size={12} />
                                                                Querying your data...
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
                                                        <div className="text-sm whitespace-pre-wrap prose prose-sm max-w-none">
                                                            {msg.content}
                                                        </div>
                                                    )}
                                                </div>

                                                {msg.role === 'user' && (
                                                    <div className="w-8 h-8 rounded-full bg-app-border flex items-center justify-center flex-shrink-0">
                                                        <User size={16} className="text-app-text-muted" />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {sending && (
                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                                            <Loader2 size={16} className="animate-spin text-white" />
                                        </div>
                                        <div className="bg-app-surface-2 rounded-2xl rounded-bl-md px-4 py-3">
                                            <p className="text-sm text-app-text-faint flex items-center gap-2">
                                                <span className="animate-pulse">Analyzing your data...</span>
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </CardContent>

                    {/* Input Area */}
                    <div className="p-4 border-t border-app-border">
                        <div className="flex gap-3">
                            <Textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask for analysis, charts, forecasts, or strategic recommendations..."
                                className="flex-1 min-h-[44px] max-h-32 rounded-xl bg-app-bg border-app-border resize-none"
                                disabled={sending}
                                rows={1}
                            />
                            <Button
                                onClick={handleSend}
                                disabled={!input.trim() || sending}
                                className="rounded-xl bg-purple-600 hover:bg-purple-500 px-6 self-end"
                            >
                                {sending ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <Send size={18} />
                                )}
                            </Button>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            <div className="flex gap-2">
                                <Badge variant="outline" className="text-xs">
                                    <BarChart3 size={10} className="mr-1" />
                                    Charts
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                    <TrendingUp size={10} className="mr-1" />
                                    Trends
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                    <Target size={10} className="mr-1" />
                                    Strategy
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                    <FileText size={10} className="mr-1" />
                                    Reports
                                </Badge>
                            </div>
                            <p className="text-xs text-app-text-faint">
                                Press Enter to send
                            </p>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    )
}
