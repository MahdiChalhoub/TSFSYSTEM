'use client'

/**
 * AI ASSISTANT CHAT
 * =================
 * Interactive AI chat interface for business assistance
 */

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bot, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function MCPChatPage() {
  return (
    <div className="min-h-screen bg-app-bg p-6">
      <div className="max-w-4xl mx-auto">
        <Card className="border-app-border/30">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-app-info-bg flex items-center justify-center">
              <Bot size={40} className="text-app-info" />
            </div>
            <h1 className="text-2xl font-black text-app-foreground mb-2">AI Assistant Chat</h1>
            <p className="text-sm text-app-muted-foreground mb-8">
              Interactive AI-powered business assistant
            </p>
            <div className="space-y-4">
              <div className="p-4 bg-app-info-bg border border-app-info rounded-xl text-left">
                <p className="text-sm font-bold text-app-info mb-2">🚧 Coming Soon</p>
                <p className="text-xs text-app-info">
                  Chat interface for AI-powered business assistance, document analysis, and automated workflows.
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button asChild>
                  <Link href="/mcp/conversations">
                    <ArrowRight size={16} className="mr-2" />
                    View Conversations
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/mcp/agents">
                    View AI Agents
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
