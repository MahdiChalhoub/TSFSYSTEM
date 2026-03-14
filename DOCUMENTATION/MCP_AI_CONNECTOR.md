# MCP AI Connector Module

## Goal
Provides AI-powered chat, tool execution, provider management, and analytics for the SaaS platform through the Model Context Protocol (MCP).

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/mcp` | Overview with quick stats, provider status, and navigation cards |
| Providers | `/mcp/providers` | Manage AI providers (OpenAI, Anthropic, etc.) |
| Tools | `/mcp/tools` | Browse and test available AI tools |
| Chat | `/mcp/chat` | Interactive AI chat with streaming responses |
| Conversations | `/mcp/conversations` | Conversation history with analytics summary |
| Settings | `/mcp/settings` | Rate limiting, timeouts, security, data retention |
| Usage Analytics | `/mcp/usage` | Token consumption, costs, and usage trends |

## Architecture

### Route Structure
```
src/app/(privileged)/(saas)/mcp/
├── page.tsx                → re-exports from @/modules/mcp/page
├── providers/page.tsx      → re-exports from @/modules/mcp/providers/page
├── tools/page.tsx          → re-exports from @/modules/mcp/tools/page
├── chat/page.tsx           → re-exports from @/modules/mcp/chat/page
├── conversations/page.tsx  → re-exports from @/modules/mcp/conversations/page
├── settings/page.tsx       → re-exports from @/modules/mcp/settings/page
└── usage/page.tsx          → re-exports from @/modules/mcp/usage/page
```

### Module Files
```
src/modules/mcp/
├── page.tsx              ─ Dashboard with stats & navigation
├── providers/page.tsx    ─ Provider management (CRUD)
├── tools/page.tsx        ─ Tool browser & tester
├── chat/page.tsx         ─ AI chat interface
├── conversations/page.tsx─ History with analytics
├── settings/page.tsx     ─ Configuration panel
└── usage/page.tsx        ─ Usage analytics & trends
```

## Data Flow

### READ
- `GET /api/mcp/providers/` — List AI providers
- `GET /api/mcp/tools/` — List available tools
- `GET /api/mcp/conversations/` — List conversation history
- `GET /api/mcp/usage/?days=N` — Usage analytics

### WRITE
- `POST /api/mcp/chat/` — Send message, get AI response
- `POST /api/mcp/tools/execute/` — Execute an AI tool
- `DELETE /api/mcp/conversations/{id}/` — Delete conversation
- `PUT /api/mcp/settings/` — Save settings

## Variables User Interacts With

### Conversations Page
- `searchQuery` — Filter conversations by title
- `selectedConv` — Currently selected conversation detail

### Settings Page
- `max_requests_per_minute` — Rate limit (default: 60)
- `max_tokens_per_request` — Token ceiling (default: 8192)
- `max_concurrent_requests` — Concurrent limit (default: 10)
- `default_timeout` — Request timeout in seconds (default: 30)
- `streaming_timeout` — Streaming timeout (default: 120)
- `retry_attempts` — Number of retries (default: 3)
- `mask_api_keys` — Hide API keys in UI (default: true)
- `log_prompts` / `log_responses` — Audit logging toggles
- `retention_days` — Data retention period (default: 90)
- `auto_purge_enabled` — Auto-delete expired data
- `alert_on_failure` / `alert_on_quota` — Notification toggles
- `quota_threshold` — Alert threshold percentage (default: 80%)

### Usage Page
- `period` — Time range selector (7D, 30D, 90D)

## Important Notes

### Client vs Server Fetch
MCP module pages use `'use client'` directive. They MUST NOT import `erpFetch` from `@/lib/erp-fetch` because it uses `cookies` from `next/headers` (server-only API). Instead, use the local `apiFetch` helper:

```typescript
async function apiFetch(path: string, opts?: RequestInit) {
    return fetch(`/api${path}`, { credentials: 'include', ...opts })
}
```

### Sidebar Entry
MCP is registered in the sidebar under **SaaS Control → Infrastructure** section in `src/components/admin/Sidebar.tsx`.
