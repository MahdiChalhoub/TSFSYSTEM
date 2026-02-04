# MCP AI Connector Module

## Overview

The MCP (Model Context Protocol) module enables AI integration with the Dajingo ERP platform. It provides a standardized interface for connecting large language models (LLMs) to platform-specific data and tools.

## Architecture

```
External AI → MCP Server → Django API → Business Logic
                           ↓
                     Connector Module (routing)
```

## Features

### AI Providers
- **OpenAI** - GPT-4, GPT-4-turbo, GPT-3.5-turbo
- **Anthropic** - Claude 3 Opus, Sonnet, Haiku
- **Google** - Gemini Pro, Gemini 1.5
- **Azure OpenAI** - Enterprise GPT deployments
- **Ollama** - Local models (Llama, Mistral, etc.)
- **Custom** - Any OpenAI-compatible API

### Tools
Pre-defined tools that AI can use to query and modify data:
- `get_products` - Query inventory products
- `get_product_stock` - Get stock levels
- `get_financial_summary` - Financial reports
- `get_sales_today` - Daily sales summary
- `get_customers` - CRM search

### Conversations
- Persistent conversation history
- Token usage tracking
- Cost estimation
- Multi-user support

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/mcp/providers/` | GET/POST | List/create providers |
| `/api/v1/mcp/providers/{id}/test/` | POST | Test provider connection |
| `/api/v1/mcp/providers/{id}/set_default/` | POST | Set as default provider |
| `/api/v1/mcp/tools/` | GET/POST | List/create tools |
| `/api/v1/mcp/tools/register_defaults/` | POST | Register default tools |
| `/api/v1/mcp/tools/execute/` | POST | Execute a tool directly |
| `/api/v1/mcp/chat/` | POST | Send chat message |
| `/api/v1/mcp/conversations/` | GET | List conversations |
| `/api/v1/mcp/dashboard/` | GET | Dashboard statistics |
| `/api/v1/mcp/usage/` | GET | Usage logs |

## Security

### API Key Encryption
API keys are encrypted using Fernet symmetric encryption (AES-128) derived from the Django SECRET_KEY.

### Permissions
- `mcp.view` - View MCP dashboard and settings
- `mcp.manage` - Manage providers and tools
- `mcp.chat` - Use AI chat functionality
- `mcp.tools` - Execute tools directly
- `mcp.admin` - Full administrative access

### Rate Limiting
Configurable rate limits per organization/user:
- Requests per minute/hour/day
- Tokens per day
- Cost per day

## Frontend Pages

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/saas/mcp` | Overview and navigation |
| Providers | `/saas/mcp/providers` | Manage AI providers |
| Tools | `/saas/mcp/tools` | Configure MCP tools |
| Conversations | `/saas/mcp/conversations` | View chat history |
| Usage | `/saas/mcp/usage` | Token usage and billing |

## Database Models

| Model | Description |
|-------|-------------|
| MCPProvider | AI provider configuration |
| MCPTool | Tool definitions |
| MCPConnection | Active MCP server connection |
| MCPConversation | Chat conversation sessions |
| MCPMessage | Individual messages |
| MCPUsageLog | Usage tracking |
| MCPRateLimit | Rate limit configuration |

## Version History

- **v2.6.0-b001** - Initial MCP module implementation
  - 7 database models
  - 6 AI provider adapters
  - Full CRUD REST API
  - Frontend admin UI
