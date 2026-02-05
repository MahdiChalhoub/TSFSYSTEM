# MCP Standalone Server

## Overview

The MCP module includes a standalone MCP server that can be used with:
- **Claude Desktop**
- **Cursor**
- **Any MCP-compatible client**

Each organization runs their own isolated MCP server instance.

## Installation

### Prerequisites

```bash
pip install mcp httpx
```

### Files Location

All MCP server files are in:
```
erp_backend/apps/mcp/
├── server.py              # Main MCP server
├── claude_desktop_config.json  # Config template
└── ...
```

## Usage

### Running the Server

```bash
cd c:\tsfci\erp_backend

# Run for a specific organization
python -m apps.mcp.server --org-slug your-org-slug

# Or set environment variable
set DAJINGO_ORG_SLUG=your-org-slug
python -m apps.mcp.server
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DAJINGO_API_URL` | Django API base URL | `http://localhost:8000/api/v1/` |
| `DAJINGO_API_KEY` | API authentication key | (optional) |
| `DAJINGO_ORG_SLUG` | Organization slug | (required) |

## Claude Desktop Configuration

1. Open Claude Desktop settings
2. Go to **MCP Servers**
3. Add a new server with this configuration:

```json
{
  "mcpServers": {
    "dajingo-myorg": {
      "command": "python",
      "args": ["-m", "apps.mcp.server", "--org-slug", "myorg"],
      "cwd": "C:\\tsfci\\erp_backend",
      "env": {
        "DAJINGO_API_URL": "http://localhost:8000/api/v1/"
      }
    }
  }
}
```

Replace `myorg` with your actual organization slug.

## Available Tools

| Tool | Description |
|------|-------------|
| `get_products` | Query inventory products |
| `get_product_details` | Get specific product info |
| `get_stock_levels` | Get stock levels by warehouse |
| `get_categories` | List product categories |
| `get_warehouses` | List warehouses |
| `get_financial_summary` | Financial overview |
| `get_chart_of_accounts` | COA hierarchy |
| `get_account_balance` | Account balance |
| `get_sales_today` | Today's sales |
| `get_sales_history` | Sales history |
| `search_customers` | Search CRM |
| `get_customer_details` | Customer info |
| `get_organization_info` | Org details |

## Multi-Tenant Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Desktop                        │
├─────────────────────────────────────────────────────────┤
│  MCP Server (org-a)  │  MCP Server (org-b)  │    ...    │
├─────────────────────────────────────────────────────────┤
│                    Django API                            │
│              (with X-Tenant-Slug header)                │
├─────────────────────────────────────────────────────────┤
│                    Database                              │
│      (organization-isolated data)                        │
└─────────────────────────────────────────────────────────┘
```

Each organization runs a separate MCP server instance with:
- Isolated data access via tenant slug
- Organization-specific API context
- Separate configuration per client

## Security Notes

- API keys are never exposed to the MCP client
- Each organization has isolated data access
- Use proper authentication in production
