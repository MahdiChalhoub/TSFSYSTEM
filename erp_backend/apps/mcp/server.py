#!/usr/bin/env python3
"""
Dajingo MCP Server (Multi-Tenant)
=================================
Standalone MCP server for Claude Desktop, Cursor, and other MCP clients.

Each organization has their own MCP server instance with isolated data access.

Usage:
    python -m apps.mcp.server --org-slug <organization-slug>

Environment Variables:
    DAJINGO_API_URL: Django API base URL (default: http://localhost:8000/api/v1/)
    DAJINGO_API_KEY: API authentication key
    DAJINGO_ORG_SLUG: Organization slug (can also use --org-slug)
"""

import os
import sys
import json
import asyncio
import argparse
import httpx
from typing import Any, Optional, List
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.types import (
    Tool,
    TextContent,
    CallToolRequest,
    ListToolsRequest,
)

# =============================================================================
# CONFIGURATION
# =============================================================================

API_BASE_URL = os.getenv("DAJINGO_API_URL", "http://localhost:8000/api/")
API_KEY = os.getenv("DAJINGO_API_KEY", "")

# =============================================================================
# MULTI-TENANT API CLIENT
# =============================================================================

class DajingoClient:
    """Multi-tenant HTTP client for Dajingo Django API."""
    
    def __init__(self, base_url: str, org_slug: str, api_key: str = ""):
        self.base_url = base_url.rstrip("/")
        self.org_slug = org_slug
        self.api_key = api_key
        self.org_id: Optional[int] = None
        self.org_name: Optional[str] = None
        self.client = httpx.AsyncClient(timeout=30.0)
    
    def _get_headers(self) -> dict:
        """Build request headers with tenant context."""
        headers = {
            "Content-Type": "application/json",
            "X-Tenant-Slug": self.org_slug,  # Multi-tenant header
        }
        if self.org_id:
            headers["X-Organization-ID"] = str(self.org_id)
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers
    
    async def initialize(self) -> bool:
        """Resolve organization and verify access."""
        try:
            url = f"{self.base_url}/tenant/resolve/?slug={self.org_slug}"
            response = await self.client.get(url, headers=self._get_headers())
            response.raise_for_status()
            data = response.json()
            self.org_id = data.get("id")
            self.org_name = data.get("name", self.org_slug)
            return True
        except Exception as e:
            print(f"Failed to resolve organization '{self.org_slug}': {e}", file=sys.stderr)
            return False
    
    async def get(self, endpoint: str, params: dict = None) -> dict:
        """GET request to API with tenant context."""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        response = await self.client.get(url, headers=self._get_headers(), params=params)
        response.raise_for_status()
        return response.json()
    
    async def post(self, endpoint: str, data: dict = None) -> dict:
        """POST request to API with tenant context."""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        response = await self.client.post(url, headers=self._get_headers(), json=data)
        response.raise_for_status()
        return response.json()
    
    async def close(self):
        await self.client.aclose()

# =============================================================================
# TOOLS DEFINITION
# =============================================================================

def get_tools() -> List[Tool]:
    """Return available tools for this organization."""
    return [
        # === INVENTORY ===
        Tool(
            name="get_products",
            description="Get list of products from inventory. Returns product names, SKUs, prices, and stock levels.",
            inputSchema={
                "type": "object",
                "properties": {
                    "search": {"type": "string", "description": "Search term to filter products"},
                    "category": {"type": "string", "description": "Filter by category name"},
                    "limit": {"type": "integer", "description": "Max products to return", "default": 20}
                }
            }
        ),
        Tool(
            name="get_product_details",
            description="Get detailed information about a specific product.",
            inputSchema={
                "type": "object",
                "properties": {
                    "product_id": {"type": "integer", "description": "Product ID"},
                    "sku": {"type": "string", "description": "Product SKU (alternative)"}
                }
            }
        ),
        Tool(
            name="get_stock_levels",
            description="Get current stock levels, optionally filtered by warehouse.",
            inputSchema={
                "type": "object",
                "properties": {
                    "product_id": {"type": "integer", "description": "Filter by product"},
                    "warehouse_id": {"type": "integer", "description": "Filter by warehouse"},
                    "low_stock_only": {"type": "boolean", "description": "Only low stock items", "default": False}
                }
            }
        ),
        Tool(
            name="get_categories",
            description="Get list of product categories.",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="get_warehouses",
            description="Get list of warehouses and their locations.",
            inputSchema={"type": "object", "properties": {}}
        ),
        
        # === FINANCE ===
        Tool(
            name="get_financial_summary",
            description="Get financial summary (revenue, expenses, profit) for a date range.",
            inputSchema={
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "description": "Start date YYYY-MM-DD"},
                    "end_date": {"type": "string", "description": "End date YYYY-MM-DD"}
                }
            }
        ),
        Tool(
            name="get_chart_of_accounts",
            description="Get the chart of accounts hierarchy.",
            inputSchema={
                "type": "object",
                "properties": {
                    "account_type": {"type": "string", "description": "Filter by type (asset, liability, etc.)"}
                }
            }
        ),
        Tool(
            name="get_account_balance",
            description="Get the current balance of a specific account.",
            inputSchema={
                "type": "object",
                "properties": {
                    "account_id": {"type": "integer", "description": "Account ID"},
                    "account_code": {"type": "string", "description": "Account code (alternative)"}
                }
            }
        ),
        
        # === SALES / POS ===
        Tool(
            name="get_sales_today",
            description="Get today's sales summary including revenue and top products.",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="get_sales_history",
            description="Get sales history for a date range.",
            inputSchema={
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "description": "Start date YYYY-MM-DD"},
                    "end_date": {"type": "string", "description": "End date YYYY-MM-DD"},
                    "limit": {"type": "integer", "description": "Max transactions", "default": 50}
                }
            }
        ),
        
        # === CRM ===
        Tool(
            name="search_customers",
            description="Search for customers by name, email, or phone.",
            inputSchema={
                "type": "object",
                "properties": {
                    "search": {"type": "string", "description": "Search term"},
                    "limit": {"type": "integer", "description": "Max results", "default": 20}
                }
            }
        ),
        Tool(
            name="get_customer_details",
            description="Get detailed information about a specific customer.",
            inputSchema={
                "type": "object",
                "properties": {
                    "customer_id": {"type": "integer", "description": "Customer ID"}
                },
                "required": ["customer_id"]
            }
        ),
        
        # === SYSTEM ===
        Tool(
            name="get_organization_info",
            description="Get information about the current organization.",
            inputSchema={"type": "object", "properties": {}}
        ),
        
        # === ANALYTICS ===
        Tool(
            name="get_sales_trend",
            description="Get sales trend data for charting. Returns daily/weekly/monthly sales totals perfect for visualization.",
            inputSchema={
                "type": "object",
                "properties": {
                    "period": {"type": "string", "description": "Period: daily, weekly, monthly", "default": "monthly"},
                    "months": {"type": "integer", "description": "Number of months to look back", "default": 6}
                }
            }
        ),
        Tool(
            name="get_revenue_expenses",
            description="Get revenue vs expenses comparison data for charting.",
            inputSchema={
                "type": "object",
                "properties": {
                    "period": {"type": "string", "description": "Period: daily, weekly, monthly", "default": "monthly"},
                    "months": {"type": "integer", "description": "Number of months", "default": 6}
                }
            }
        ),
        Tool(
            name="get_top_products",
            description="Get top selling products with quantities. Perfect for pie/bar charts.",
            inputSchema={
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Number of products", "default": 10},
                    "metric": {"type": "string", "description": "Sort by: revenue, quantity", "default": "revenue"}
                }
            }
        ),
        Tool(
            name="get_inventory_status",
            description="Get inventory status breakdown (in stock, low stock, out of stock) for pie charts.",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="get_customer_segments",
            description="Get customer segments by purchase value. Perfect for pie charts.",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="save_report",
            description="Save analysis or report for future reference.",
            inputSchema={
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Report title"},
                    "content": {"type": "string", "description": "Report content/analysis"},
                    "report_type": {"type": "string", "description": "Type: sales, inventory, financial, strategy"}
                },
                "required": ["title", "content"]
            }
        ),
    ]

# =============================================================================
# TOOL HANDLERS
# =============================================================================

async def handle_tool_call(client: DajingoClient, name: str, arguments: dict) -> str:
    """Execute a tool and return the result."""
    
    try:
        # === INVENTORY ===
        if name == "get_products":
            params = {k: v for k, v in arguments.items() if v is not None}
            result = await client.get("products/", params)
            
        elif name == "get_product_details":
            if arguments.get("product_id"):
                result = await client.get(f"products/{arguments['product_id']}/")
            elif arguments.get("sku"):
                result = await client.get("products/", {"sku": arguments["sku"]})
            else:
                return "Error: Either product_id or sku is required"
                
        elif name == "get_stock_levels":
            params = {}
            if arguments.get("product_id"):
                params["product"] = arguments["product_id"]
            if arguments.get("warehouse_id"):
                params["warehouse"] = arguments["warehouse_id"]
            if arguments.get("low_stock_only"):
                params["low_stock"] = "true"
            result = await client.get("inventory/", params)
            
        elif name == "get_categories":
            result = await client.get("categories/")
            
        elif name == "get_warehouses":
            result = await client.get("warehouses/")
            
        # === FINANCE ===
        elif name == "get_financial_summary":
            params = {k: v for k, v in arguments.items() if v is not None}
            result = await client.get("finance/dashboard/", params)
            
        elif name == "get_chart_of_accounts":
            params = {}
            if arguments.get("account_type"):
                params["type"] = arguments["account_type"]
            result = await client.get("coa/", params)
            
        elif name == "get_account_balance":
            if arguments.get("account_id"):
                result = await client.get(f"coa/{arguments['account_id']}/balance/")
            elif arguments.get("account_code"):
                result = await client.get("coa/", {"code": arguments["account_code"]})
            else:
                return "Error: Either account_id or account_code is required"
                
        # === SALES / POS ===
        elif name == "get_sales_today":
            result = await client.get("pos/sales/today/")
            
        elif name == "get_sales_history":
            params = {k: v for k, v in arguments.items() if v is not None}
            result = await client.get("pos/sales/", params)
            
        # === CRM ===
        elif name == "search_customers":
            params = {k: v for k, v in arguments.items() if v is not None}
            result = await client.get("contacts/", params)
            
        elif name == "get_customer_details":
            result = await client.get(f"contacts/{arguments['customer_id']}/")
            
        # === SYSTEM ===
        elif name == "get_organization_info":
            result = {
                "id": client.org_id,
                "name": client.org_name,
                "slug": client.org_slug
            }
            # Try to get more details
            try:
                details = await client.get(f"organizations/{client.org_id}/")
                result.update(details)
            except:
                pass
        
        # === ANALYTICS ===
        elif name == "get_sales_trend":
            params = {
                "period": arguments.get("period", "monthly"),
                "months": arguments.get("months", 6)
            }
            result = await client.get("finance/analytics/sales-trend/", params)
            
        elif name == "get_revenue_expenses":
            params = {
                "period": arguments.get("period", "monthly"),
                "months": arguments.get("months", 6)
            }
            result = await client.get("finance/analytics/revenue-expenses/", params)
            
        elif name == "get_top_products":
            params = {
                "limit": arguments.get("limit", 10),
                "metric": arguments.get("metric", "revenue")
            }
            result = await client.get("products/analytics/top/", params)
            
        elif name == "get_inventory_status":
            result = await client.get("inventory/analytics/status/")
            
        elif name == "get_customer_segments":
            result = await client.get("contacts/analytics/segments/")
            
        elif name == "save_report":
            result = await client.post("reports/", {
                "title": arguments["title"],
                "content": arguments["content"],
                "report_type": arguments.get("report_type", "general")
            })
            
        else:
            return f"Unknown tool: {name}"
        
        # Format result
        if isinstance(result, dict):
            return json.dumps(result, indent=2, default=str)
        return str(result)
        
    except httpx.HTTPStatusError as e:
        return f"API Error: {e.response.status_code} - {e.response.text}"
    except Exception as e:
        return f"Error: {str(e)}"

# =============================================================================
# MCP SERVER
# =============================================================================

async def run_server(org_slug: str):
    """Run the MCP server for a specific organization."""
    
    # Initialize API client
    client = DajingoClient(API_BASE_URL, org_slug, API_KEY)
    
    # Resolve organization
    if not await client.initialize():
        print(f"ERROR: Could not connect to organization '{org_slug}'", file=sys.stderr)
        sys.exit(1)
    
    print(f"MCP Server starting for organization: {client.org_name} ({org_slug})", file=sys.stderr)
    
    # Create MCP server
    server = Server(f"dajingo-{org_slug}")
    
    @server.list_tools()
    async def list_tools() -> list[Tool]:
        """Return available tools."""
        return get_tools()
    
    @server.call_tool()
    async def call_tool(name: str, arguments: dict) -> list[TextContent]:
        """Handle tool calls."""
        result = await handle_tool_call(client, name, arguments)
        return [TextContent(type="text", text=result)]
    
    # Run server
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name=f"dajingo-{org_slug}",
                server_version="1.0.0",
                capabilities=server.get_capabilities(
                    notification_options=None,
                    experimental_capabilities={}
                )
            )
        )

def main():
    """Parse arguments and run server."""
    parser = argparse.ArgumentParser(description="Dajingo MCP Server")
    parser.add_argument(
        "--org-slug", "-o",
        default=os.getenv("DAJINGO_ORG_SLUG", ""),
        help="Organization slug to connect to"
    )
    args = parser.parse_args()
    
    if not args.org_slug:
        print("ERROR: Organization slug is required. Use --org-slug or set DAJINGO_ORG_SLUG", file=sys.stderr)
        sys.exit(1)
    
    asyncio.run(run_server(args.org_slug))

if __name__ == "__main__":
    main()
