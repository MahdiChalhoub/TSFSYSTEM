/**
 * Advanced Filtering System Types
 * ================================
 * Types for building complex, saveable filter queries.
 */

export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'between'
  | 'in'
  | 'notIn'
  | 'isNull'
  | 'isNotNull'
  | 'isEmpty'
  | 'isNotEmpty'

export type FilterLogic = 'AND' | 'OR'

export type FilterFieldType = 'string' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect'

export interface FilterField {
  key: string
  label: string
  type: FilterFieldType
  operators: FilterOperator[]
  options?: Array<{ value: string; label: string }> // For select/multiselect
}

export interface FilterCondition {
  id: string
  field: string
  operator: FilterOperator
  value: any
  value2?: any // For 'between' operator
}

export interface FilterGroup {
  id: string
  logic: FilterLogic
  conditions: FilterCondition[]
  groups?: FilterGroup[] // Nested groups for complex queries
}

export interface SavedFilter {
  id: string
  name: string
  description?: string
  module: 'crm' | 'finance' | 'inventory' | 'sales' | 'purchasing'
  entity: string // 'contact', 'invoice', 'product', etc.
  filterGroup: FilterGroup
  isPublic: boolean
  isDefault: boolean
  createdBy: number
  createdAt: string
  updatedAt: string
  usageCount: number
}

export interface FilterTemplate {
  id: string
  name: string
  description: string
  icon: string
  filterGroup: FilterGroup
}

// CRM-specific filter fields
export const CRM_CONTACT_FILTER_FIELDS: FilterField[] = [
  {
    key: 'name',
    label: 'Name',
    type: 'string',
    operators: ['equals', 'notEquals', 'contains', 'notContains', 'startsWith', 'isEmpty', 'isNotEmpty'],
  },
  {
    key: 'type',
    label: 'Contact Type',
    type: 'select',
    operators: ['equals', 'notEquals', 'in', 'notIn'],
    options: [
      { value: 'CUSTOMER', label: 'Customer' },
      { value: 'SUPPLIER', label: 'Supplier' },
      { value: 'LEAD', label: 'Lead' },
      { value: 'PARTNER', label: 'Partner' },
    ],
  },
  {
    key: 'customer_tier',
    label: 'Customer Tier',
    type: 'select',
    operators: ['equals', 'notEquals', 'in', 'notIn'],
    options: [
      { value: 'STANDARD', label: 'Standard' },
      { value: 'VIP', label: 'VIP' },
      { value: 'WHOLESALE', label: 'Wholesale' },
      { value: 'RETAIL', label: 'Retail' },
    ],
  },
  {
    key: 'email',
    label: 'Email',
    type: 'string',
    operators: ['equals', 'notEquals', 'contains', 'isEmpty', 'isNotEmpty'],
  },
  {
    key: 'phone',
    label: 'Phone',
    type: 'string',
    operators: ['equals', 'notEquals', 'contains', 'isEmpty', 'isNotEmpty'],
  },
  {
    key: 'current_balance',
    label: 'Balance',
    type: 'number',
    operators: ['equals', 'notEquals', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual', 'between'],
  },
  {
    key: 'credit_limit',
    label: 'Credit Limit',
    type: 'number',
    operators: ['equals', 'notEquals', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual', 'between'],
  },
  {
    key: 'total_orders',
    label: 'Total Orders',
    type: 'number',
    operators: ['equals', 'notEquals', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual', 'between'],
  },
  {
    key: 'lifetime_value',
    label: 'Lifetime Value',
    type: 'number',
    operators: ['equals', 'notEquals', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual', 'between'],
  },
  {
    key: 'loyalty_points',
    label: 'Loyalty Points',
    type: 'number',
    operators: ['equals', 'notEquals', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual', 'between'],
  },
  {
    key: 'is_active',
    label: 'Active Status',
    type: 'boolean',
    operators: ['equals'],
  },
  {
    key: 'created_at',
    label: 'Created Date',
    type: 'date',
    operators: ['equals', 'notEquals', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual', 'between'],
  },
  {
    key: 'last_purchase_date',
    label: 'Last Purchase Date',
    type: 'date',
    operators: ['equals', 'notEquals', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual', 'between', 'isNull', 'isNotNull'],
  },
]

// Pre-defined filter templates for CRM
export const CRM_CONTACT_FILTER_TEMPLATES: FilterTemplate[] = [
  {
    id: 'high-value-customers',
    name: 'High-Value Customers',
    description: 'Customers with lifetime value > $10,000',
    icon: '💎',
    filterGroup: {
      id: 'root',
      logic: 'AND',
      conditions: [
        {
          id: '1',
          field: 'type',
          operator: 'equals',
          value: 'CUSTOMER',
        },
        {
          id: '2',
          field: 'lifetime_value',
          operator: 'greaterThan',
          value: 10000,
        },
      ],
    },
  },
  {
    id: 'vip-customers',
    name: 'VIP Customers',
    description: 'All VIP tier customers',
    icon: '⭐',
    filterGroup: {
      id: 'root',
      logic: 'AND',
      conditions: [
        {
          id: '1',
          field: 'type',
          operator: 'equals',
          value: 'CUSTOMER',
        },
        {
          id: '2',
          field: 'customer_tier',
          operator: 'equals',
          value: 'VIP',
        },
      ],
    },
  },
  {
    id: 'inactive-contacts',
    name: 'Inactive Contacts',
    description: 'Contacts with no orders in last 90 days',
    icon: '😴',
    filterGroup: {
      id: 'root',
      logic: 'AND',
      conditions: [
        {
          id: '1',
          field: 'last_purchase_date',
          operator: 'lessThan',
          value: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    },
  },
  {
    id: 'new-contacts',
    name: 'New Contacts (Last 30 Days)',
    description: 'Recently added contacts',
    icon: '🆕',
    filterGroup: {
      id: 'root',
      logic: 'AND',
      conditions: [
        {
          id: '1',
          field: 'created_at',
          operator: 'greaterThan',
          value: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    },
  },
  {
    id: 'credit-risk',
    name: 'Credit Risk',
    description: 'Customers exceeding credit limit',
    icon: '⚠️',
    filterGroup: {
      id: 'root',
      logic: 'AND',
      conditions: [
        {
          id: '1',
          field: 'type',
          operator: 'equals',
          value: 'CUSTOMER',
        },
        {
          id: '2',
          field: 'current_balance',
          operator: 'greaterThan',
          value: 0,
        },
      ],
    },
  },
  {
    id: 'top-suppliers',
    name: 'Top Suppliers',
    description: 'Suppliers with highest purchase volume',
    icon: '🏭',
    filterGroup: {
      id: 'root',
      logic: 'AND',
      conditions: [
        {
          id: '1',
          field: 'type',
          operator: 'equals',
          value: 'SUPPLIER',
        },
        {
          id: '2',
          field: 'supplier_total_orders',
          operator: 'greaterThan',
          value: 10,
        },
      ],
    },
  },
]

// Utility types for filter UI
export interface FilterBuilderState {
  filterGroup: FilterGroup
  availableFields: FilterField[]
  templates: FilterTemplate[]
}

export interface FilterChip {
  id: string
  label: string
  field: string
  operator: FilterOperator
  value: string
  onRemove: () => void
}
