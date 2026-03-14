# CRM (Customer Relationship Management) Module

## Overview
Comprehensive CRM system for managing customer relationships, leads, opportunities, and sales pipeline:
- Contact and company management
- Lead tracking and qualification
- Opportunity pipeline management
- Activity tracking (calls, meetings, emails)
- Sales quotations
- Customer segmentation
- Follow-up reminders
- Performance analytics

**Location**: `erp_backend/apps/crm/` + `src/app/(privileged)/crm/`

## Features
- **Contact Management**: Customers, suppliers, leads with full profile
- **Lead Tracking**: Capture, qualify, convert leads to customers
- **Opportunity Pipeline**: Track deals through stages (prospect → close)
- **Activity Logging**: Calls, meetings, emails, notes
- **Quotations**: Create and send sales quotes
- **Follow-ups**: Automated reminders for tasks and follow-ups
- **Customer Segmentation**: Tags, categories, custom fields
- **Email Integration**: Send emails directly from CRM
- **Document Attachments**: Attach files to contacts/opportunities
- **Performance Metrics**: Conversion rates, pipeline value, win/loss analysis

## Models

### Contact
Individual person or company.

**Key Fields**:
- `name` - Contact name
- `email`, `phone` - Contact details
- `contact_type` - PERSON, COMPANY
- `is_customer`, `is_supplier`, `is_lead` - Relationship flags
- `company` - Parent company (if person)
- `tags` - Segmentation tags
- `lifetime_value` - Total value of purchases
- `credit_limit` - Credit limit
- `payment_terms` - Default payment terms

**Key Methods**:
- `convert_to_customer()` - Convert lead to customer
- `get_open_opportunities()` - Active deals
- `get_total_sales()` - Historical sales value

### Lead
Potential customer (before qualification).

**Key Fields**:
- `name` - Lead name
- `source` - Where lead came from (web, referral, etc.)
- `status` - NEW, CONTACTED, QUALIFIED, LOST
- `score` - Lead score (0-100)
- `assigned_to` - Sales rep
- `notes` - Lead notes

### Opportunity
Sales opportunity/deal.

**Key Fields**:
- `name` - Deal name
- `contact` - Associated contact
- `stage` - Pipeline stage (Prospect, Proposal, Negotiation, Closed Won/Lost)
- `value` - Expected deal value
- `probability` - Win probability (0-100%)
- `expected_close_date` - Projected close date
- `assigned_to` - Sales rep owner
- `status` - OPEN, WON, LOST

**Key Methods**:
- `advance_stage()` - Move to next stage
- `mark_won()` - Close as won
- `mark_lost(reason)` - Close as lost

### Activity
Interaction with contact.

**Key Fields**:
- `activity_type` - CALL, MEETING, EMAIL, NOTE
- `contact` - Related contact
- `subject` - Activity subject
- `description` - Details
- `due_date` - When activity is due
- `completed` - Completion status
- `assigned_to` - Responsible user

## API Endpoints

### GET /api/crm/contacts/
List contacts with filters.

**Query Params**:
- `is_customer` - Filter customers only
- `is_lead` - Filter leads only
- `tags` - Filter by tags

### POST /api/crm/opportunities/
Create new opportunity.

**Body**:
```json
{
  "name": "Acme Corp - Website Redesign",
  "contact_id": 123,
  "value": 50000.00,
  "stage": "PROPOSAL",
  "probability": 60,
  "expected_close_date": "2026-04-15"
}
```

### GET /api/crm/pipeline/
Get sales pipeline summary.

**Returns**: Opportunities grouped by stage with totals

## Events Published

### `crm.lead_converted`
**Trigger**: Lead converted to customer
**Subscribers**: Email marketing (move to customer list)

### `crm.opportunity_won`
**Trigger**: Deal marked as won
**Subscribers**: Finance (create invoice), Inventory (reserve stock)

## Configuration

**`CRM_LEAD_AUTO_SCORE`**: Auto-calculate lead scores (default: True)
**`CRM_DEFAULT_PIPELINE_STAGES`**: Default opportunity stages

---

**Last Updated**: 2026-03-14
**Status**: Production Ready
