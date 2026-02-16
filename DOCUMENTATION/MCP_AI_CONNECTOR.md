# MCP AI Connector Module – Frontend Documentation

## Goal
Provide a frontend UI for the MCP (Model Context Protocol) AI Connector module, enabling SaaS administrators to manage AI providers, tools, conversations, and usage analytics.

## Architecture

### Routing
The MCP module follows the Dajingo modular architecture:
- **Module Source**: `src/modules/mcp/` — contains actual UI components
- **Route Wrappers**: `src/app/(privileged)/(saas)/mcp/` — thin re-export files that wire the module into Next.js routing
- **Access URL**: `https://saas.tsf.ci/mcp` (SaaS subdomain)

### Pages
| Page | URL | Component Source | Description |
|------|-----|-----------------|-------------|
| Dashboard | `/mcp` | `modules/mcp/page.tsx` | Overview with stats, nav cards, recent conversations |
| Providers | `/mcp/providers` | `modules/mcp/providers/page.tsx` | Add/edit/delete/test AI providers (OpenAI, Claude, Gemini, etc.) |
| Tools | `/mcp/tools` | `modules/mcp/tools/page.tsx` | Define and manage MCP tools exposed to AI |
| Chat | `/mcp/chat` | `modules/mcp/chat/page.tsx` | Interactive AI chat interface |

### Data Flow
- **READ**: All data fetched via server actions in `src/app/actions/saas/mcp.ts`
- **SAVE**: CRUD operations go through `erpFetch` → Backend API at `/api/mcp/`
- **Backend Endpoints**:
  - `GET/POST /api/mcp/providers/` — Provider CRUD
  - `GET/POST /api/mcp/tools/` — Tool CRUD
  - `GET /api/mcp/conversations/` — Conversation history
  - `GET /api/mcp/usage/` — Usage logs
  - `POST /api/mcp/chat/` — Chat interaction
  - `POST /api/mcp/tools/execute/` — Tool execution
  - `GET /api/mcp/dashboard/` — Dashboard aggregates

### Sidebar Entry
Located under **SaaS Control → Infrastructure → MCP AI Connector** in `src/components/admin/Sidebar.tsx`.

## Variables User Interacts With
- **Provider Config**: name, provider_type, api_key, api_base_url, model_name, max_tokens, temperature, timeout_seconds
- **Tool Config**: name, description, parameters (JSON schema)
- **Chat**: message input, provider selector, conversation history

## Step-by-Step Workflow
1. Admin navigates to **SaaS Control → Infrastructure → MCP AI Connector**
2. Dashboard shows provider count, tool count, 30-day usage, and recent conversations
3. Admin clicks **Providers** to add/configure AI providers (OpenAI, Claude, Gemini, Azure, Ollama, Custom)
4. For each provider: set name, type, API key, model, parameters → Save → Test connection
5. Admin clicks **Tools** to define tools the AI can use (maps to backend MCP tool registry)
6. Admin clicks **Chat** to interact with the configured AI provider
7. Admin clicks **Usage** to view token consumption and cost analytics
