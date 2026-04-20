'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { erpFetch } from '@/lib/erp-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Edit, Trash2, Send, Bot, User } from 'lucide-react'

export default function ConversationsDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [item, setItem] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadData()
  }, [id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function loadData() {
    try {
      setLoading(true)
      const [data, msgsData] = await Promise.all([
        erpFetch(`mcp/conversations/${id}/`),
        erpFetch(`mcp/conversations/${id}/messages/`)
      ])
      setItem(data)
      setMessages(msgsData || [])
    } catch (error) {
      console.error('Failed to load conversation logic:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadMessagesOnly() {
    try {
      const msgsData = await erpFetch(`mcp/conversations/${id}/messages/`)
      setMessages(msgsData || [])
    } catch (error) {
      console.error(error)
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      await erpFetch(`mcp/conversations/${id}/`, {
        method: 'DELETE'
      })
      router.push('/mcp/conversations')
    } catch (error) {
      console.error('Failed to delete:', error)
      alert('Failed to delete item')
    }
  }

  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!inputText.trim() || sending) return

    const userMessage = inputText.trim()
    setInputText('')
    setSending(true)

    // Optimistically add user message
    setMessages(prev => [
      ...prev,
      {
        id: 'optimistic-' + Date.now(),
        role: 'user',
        content: userMessage,
        created_at: new Date().toISOString()
      }
    ])

    try {
      await erpFetch(`mcp/chat/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userMessage,
          conversation_id: parseInt(id),
          include_tools: true
        })
      })

      // Reload messages to get the real DB IDs and the assistant response
      await loadMessagesOnly()
    } catch (error) {
      console.error('Failed to send message:', error)
      alert('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-app-primary"></div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="text-center py-12">
        <p className="text-app-muted-foreground">Item not found</p>
        <Button onClick={() => router.back()} variant="outline" className="mt-4">
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen layout-container-padding theme-bg flex flex-col">
      {/* Header */}
      <div className="mb-6 md:mb-8 flex-shrink-0">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="h-9 px-3"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-black theme-text">
              {item.title || item.name || `Conversation #${item.id}`}
            </h1>
            <p className="theme-text-muted mt-1 flex items-center gap-2">
               Provider: <span className="font-semibold">{item.provider_name || 'AI'}</span> &bull; Messages: {item.message_count || 0}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/mcp/conversations/${id}/edit`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <Tabs defaultValue="chat" className="flex flex-col flex-1 min-h-0">
        <TabsList className="mb-4">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="overview">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="flex-1 flex flex-col m-0 min-h-[500px] border border-app-border rounded-lg bg-app-surface overflow-hidden shadow-sm">
          {/* Chat History Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user'
              return (
                <div key={msg.id || idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-3 max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${isUser ? 'bg-app-primary text-primary-foreground' : 'bg-app-border text-app-foreground'}`}>
                      {isUser ? <User size={16} /> : <Bot size={16} />}
                    </div>
                    <div className={`px-4 py-3 rounded-2xl ${isUser ? 'bg-app-primary text-primary-foreground' : 'bg-app-background border border-app-border text-app-foreground'}`}>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                      
                      {/* Tool calls indicator */}
                      {msg.tool_calls && msg.tool_calls.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-opacity-20 border-current">
                          <p className="text-xs font-semibold opacity-70 mb-1">Executed Tools:</p>
                          <div className="flex flex-wrap gap-1">
                            {msg.tool_calls.map((tc: any, tcIdx: number) => (
                              <span key={tcIdx} className="px-2 py-1 bg-black/10 dark:bg-white/10 rounded text-xs font-mono">
                                {tc.function?.name || 'unknown_tool'}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {sending && (
              <div className="flex justify-start">
                <div className="flex gap-3 max-w-[80%] flex-row">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-app-border text-app-foreground">
                    <Bot size={16} />
                  </div>
                  <div className="px-5 py-4 rounded-2xl bg-app-background border border-app-border text-app-foreground flex items-center">
                    <span className="flex gap-1 text-app-muted-foreground">
                      <span className="animate-pulse">●</span>
                      <span className="animate-pulse delay-75">●</span>
                      <span className="animate-pulse delay-150">●</span>
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-app-border bg-app-background">
            <form onSubmit={handleSendMessage} className="flex gap-3 max-w-4xl mx-auto">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask the AI assistant..."
                className="flex-1 bg-app-surface border border-app-border rounded-full px-5 py-3 focus:outline-none focus:ring-2 focus:ring-app-primary text-sm shadow-sm"
                disabled={sending}
                autoFocus
              />
              <Button 
                type="submit" 
                disabled={sending || !inputText.trim()} 
                className="rounded-full h-11 w-11 p-0 flex-shrink-0"
              >
                <Send className="h-5 w-5 ml-1" />
              </Button>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="overview">
          <Card className="layout-card-radius theme-surface shadow-sm">
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(item).map(([key, value]) => (
                  <div key={key} className="border-b border-app-border pb-3">
                    <dt className="text-sm font-bold text-app-muted-foreground uppercase">
                      {key.replace(/_/g, ' ')}
                    </dt>
                    <dd className="mt-1 text-app-foreground">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
