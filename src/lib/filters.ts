/**
 * Filter Utility Functions
 * ========================
 * Helper functions for applying filters to data.
 */

import type { FilterGroup, FilterCondition, FilterOperator } from '@/types/filters'

/**
 * Apply a filter group to an array of items
 */
export function applyFilterGroup<T extends Record<string, any>>(
  items: T[],
  filterGroup: FilterGroup
): T[] {
  if (!filterGroup.conditions.length && !filterGroup.groups?.length) {
    return items
  }

  return items.filter(item => matchesFilterGroup(item, filterGroup))
}

/**
 * Check if an item matches a filter group
 */
function matchesFilterGroup<T extends Record<string, any>>(
  item: T,
  filterGroup: FilterGroup
): boolean {
  const conditionMatches = filterGroup.conditions.map(condition =>
    matchesCondition(item, condition)
  )

  const groupMatches = (filterGroup.groups || []).map(group =>
    matchesFilterGroup(item, group)
  )

  const allMatches = [...conditionMatches, ...groupMatches]

  if (filterGroup.logic === 'AND') {
    return allMatches.every(match => match)
  } else {
    return allMatches.some(match => match)
  }
}

/**
 * Check if an item matches a single condition
 */
function matchesCondition<T extends Record<string, any>>(
  item: T,
  condition: FilterCondition
): boolean {
  const value = getNestedValue(item, condition.field)
  const filterValue = condition.value

  switch (condition.operator) {
    case 'equals':
      return value === filterValue

    case 'notEquals':
      return value !== filterValue

    case 'contains':
      return String(value).toLowerCase().includes(String(filterValue).toLowerCase())

    case 'notContains':
      return !String(value).toLowerCase().includes(String(filterValue).toLowerCase())

    case 'startsWith':
      return String(value).toLowerCase().startsWith(String(filterValue).toLowerCase())

    case 'endsWith':
      return String(value).toLowerCase().endsWith(String(filterValue).toLowerCase())

    case 'greaterThan':
      return Number(value) > Number(filterValue)

    case 'greaterThanOrEqual':
      return Number(value) >= Number(filterValue)

    case 'lessThan':
      return Number(value) < Number(filterValue)

    case 'lessThanOrEqual':
      return Number(value) <= Number(filterValue)

    case 'between':
      return Number(value) >= Number(filterValue) && Number(value) <= Number(condition.value2)

    case 'in':
      const inArray = Array.isArray(filterValue) ? filterValue : [filterValue]
      return inArray.includes(value)

    case 'notIn':
      const notInArray = Array.isArray(filterValue) ? filterValue : [filterValue]
      return !notInArray.includes(value)

    case 'isNull':
      return value === null || value === undefined

    case 'isNotNull':
      return value !== null && value !== undefined

    case 'isEmpty':
      return value === '' || value === null || value === undefined || (Array.isArray(value) && value.length === 0)

    case 'isNotEmpty':
      return value !== '' && value !== null && value !== undefined && (!Array.isArray(value) || value.length > 0)

    default:
      return true
  }
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

/**
 * Convert filter group to URL query string
 */
export function filterGroupToQueryString(filterGroup: FilterGroup): string {
  const params = new URLSearchParams()

  filterGroup.conditions.forEach((condition, index) => {
    params.append(`filter[${index}][field]`, condition.field)
    params.append(`filter[${index}][operator]`, condition.operator)
    params.append(`filter[${index}][value]`, String(condition.value))
    if (condition.value2 !== undefined) {
      params.append(`filter[${index}][value2]`, String(condition.value2))
    }
  })

  if (filterGroup.logic) {
    params.append('filter_logic', filterGroup.logic)
  }

  return params.toString()
}

/**
 * Parse filter group from URL query string
 */
export function queryStringToFilterGroup(queryString: string): FilterGroup {
  const params = new URLSearchParams(queryString)
  const conditions: FilterCondition[] = []

  // Extract all filter conditions
  const filterIndices = new Set<number>()
  params.forEach((_, key) => {
    const match = key.match(/filter\[(\d+)\]/)
    if (match) {
      filterIndices.add(parseInt(match[1]))
    }
  })

  // Build conditions
  filterIndices.forEach(index => {
    const field = params.get(`filter[${index}][field]`)
    const operator = params.get(`filter[${index}][operator]`) as FilterOperator
    const value = params.get(`filter[${index}][value]`)
    const value2 = params.get(`filter[${index}][value2]`)

    if (field && operator) {
      conditions.push({
        id: `condition-${index}`,
        field,
        operator,
        value,
        value2,
      })
    }
  })

  const logic = (params.get('filter_logic') as 'AND' | 'OR') || 'AND'

  return {
    id: 'root',
    logic,
    conditions,
  }
}

/**
 * Validate filter group
 */
export function validateFilterGroup(filterGroup: FilterGroup): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  filterGroup.conditions.forEach((condition, index) => {
    if (!condition.field) {
      errors.push(`Condition ${index + 1}: Field is required`)
    }
    if (!condition.operator) {
      errors.push(`Condition ${index + 1}: Operator is required`)
    }
    if (!['isNull', 'isNotNull', 'isEmpty', 'isNotEmpty'].includes(condition.operator)) {
      if (condition.value === '' || condition.value === null || condition.value === undefined) {
        errors.push(`Condition ${index + 1}: Value is required`)
      }
    }
    if (condition.operator === 'between') {
      if (condition.value2 === '' || condition.value2 === null || condition.value2 === undefined) {
        errors.push(`Condition ${index + 1}: Second value is required for "between" operator`)
      }
    }
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Get filter summary text
 */
export function getFilterSummary(filterGroup: FilterGroup, fieldLabels: Record<string, string>): string {
  if (filterGroup.conditions.length === 0) {
    return 'No filters applied'
  }

  const summaries = filterGroup.conditions.map(condition => {
    const fieldLabel = fieldLabels[condition.field] || condition.field
    const operator = getOperatorText(condition.operator)
    const value = formatFilterValue(condition.value, condition.operator, condition.value2)
    return `${fieldLabel} ${operator} ${value}`
  })

  const logic = filterGroup.logic === 'AND' ? 'and' : 'or'
  return summaries.join(` ${logic} `)
}

/**
 * Get operator text for display
 */
function getOperatorText(operator: FilterOperator): string {
  const texts: Record<FilterOperator, string> = {
    equals: 'equals',
    notEquals: 'does not equal',
    contains: 'contains',
    notContains: 'does not contain',
    startsWith: 'starts with',
    endsWith: 'ends with',
    greaterThan: 'is greater than',
    greaterThanOrEqual: 'is at least',
    lessThan: 'is less than',
    lessThanOrEqual: 'is at most',
    between: 'is between',
    in: 'is one of',
    notIn: 'is not one of',
    isNull: 'is null',
    isNotNull: 'is not null',
    isEmpty: 'is empty',
    isNotEmpty: 'is not empty',
  }
  return texts[operator] || operator
}

/**
 * Format filter value for display
 */
function formatFilterValue(value: any, operator: FilterOperator, value2?: any): string {
  if (['isNull', 'isNotNull', 'isEmpty', 'isNotEmpty'].includes(operator)) {
    return ''
  }

  if (operator === 'between') {
    return `${value} and ${value2}`
  }

  if (Array.isArray(value)) {
    return value.join(', ')
  }

  return String(value)
}
