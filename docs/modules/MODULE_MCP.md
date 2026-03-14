# MCP (Model Context Protocol) Module

## Overview
The MCP module enables AI-powered features across TSFSYSTEM, providing connectors to Claude AI, conversation management, and intelligent automation capabilities. It implements the Model Context Protocol for structured AI interactions.

## Key Features
- Claude AI integration via MCP protocol
- Conversational AI for business queries
- Document understanding and analysis
- Automated data entry suggestions
- Natural language reporting
- AI-powered search and recommendations
- Conversation history and context management
- Multi-turn dialogues with context retention

## Core Models

### MCPConnection
**Purpose**: Configuration for AI model connections
**Key Fields**: name, provider, model, api_key (encrypted), is_active
**Relationships**: Belongs to Organization
**Key Methods**: `send_prompt()`, `stream_response()`, `test_connection()`

### Conversation
**Purpose**: Track user-AI interaction sessions
**Key Fields**: user, title, context, status, created_at
**Relationships**: Belongs to User, has many Messages
**Key Methods**: `add_message()`, `get_context()`, `summarize()`

### Message
**Purpose**: Individual messages in conversation
**Key Fields**: conversation, role (user/assistant), content, timestamp
**Relationships**: Belongs to Conversation
**Key Methods**: `render_markdown()`, `extract_entities()`

### AITask
**Purpose**: Asynchronous AI processing jobs
**Key Fields**: task_type, input_data, status, result, error
**Key Methods**: `execute()`, `retry()`, `cancel()`

## API Endpoints

### POST /api/mcp/conversations/
**Description**: Start new AI conversation
**Request Body**:
```json
{
  "title": "Sales Analysis",
  "initial_message": "Show me top 10 customers by revenue this month"
}
```

### POST /api/mcp/conversations/{id}/messages/
**Description**: Send message to conversation
**Request Body**:
```json
{
  "content": "What about last month?"
}
```
**Response**: AI-generated response with context

### GET /api/mcp/conversations/{id}/
**Description**: Retrieve conversation history
**Response**: Full conversation thread with messages

### POST /api/mcp/analyze-document/
**Description**: AI analysis of uploaded document
**Request Body**: Multipart file upload
**Response**: Extracted data and insights

### POST /api/mcp/suggest-entries/
**Description**: AI suggestions for data entry
**Use Case**: Smart form completion based on context
**Request Body**:
```json
{
  "module": "inventory",
  "partial_data": {"name": "Laptop"}
}
```
**Response**:
```json
{
  "suggestions": {
    "category": "Electronics",
    "unit": "Each",
    "default_price": 999.99
  }
}
```

## Business Logic

### Context Management
- Conversation context maintained across turns
- Organization data accessible to AI (with permission)
- User preferences remembered
- Historical patterns analyzed

### Security & Privacy
- All prompts scoped to organization
- No cross-tenant data leakage
- PII detection and masking
- Audit logging of AI interactions
- User consent for AI features

## Events

**Published**:
- `mcp.conversation.started`: New AI conversation
- `mcp.task.completed`: AI task finished processing
- `mcp.insight.generated`: AI generated business insight

**Consumed**:
- `*.data.changed`: Update AI context when data changes

## Configuration

**Settings**:
- `MCP_PROVIDER`: AI provider (claude, openai, etc.)
- `MCP_MODEL`: Model version (claude-sonnet-4-5, etc.)
- `MCP_MAX_CONTEXT_LENGTH`: Token limit (default: 200000)
- `MCP_ENABLE_STREAMING`: Stream responses (default: True)
- `AI_SUGGESTIONS_ENABLED`: Enable smart suggestions (default: True)

## Common Workflows

### Workflow: Natural Language Reporting
```python
from apps.mcp.services import ConversationService

service = ConversationService(user=request.user)
conversation = service.create_conversation(
    title="Monthly Sales Report"
)

response = conversation.send_message(
    "Generate a sales report for March 2026 with top products and revenue breakdown"
)

# AI analyzes data and generates report
print(response.content)  # Markdown formatted report
```

### Workflow: Smart Data Entry
```python
from apps.mcp.services import SuggestionService

suggestions = SuggestionService.suggest_product_data(
    partial_input={'name': 'Dell XPS 15'},
    organization=org
)

# Returns: category, brand, typical price range, etc.
```

## Dependencies
- `core`: User, Organization
- ALL modules: Read access to organization data for context

---

**Last Updated**: 2026-03-14
**Module Status**: Production
**AI Provider**: Anthropic Claude
