'use client'

/**
 * Filter Chips Component
 * ======================
 * Visual chips showing active filters (like Gmail).
 * Allows quick removal of individual filters.
 */

import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { FilterCondition, FilterField, FilterOperator } from '@/types/filters'

interface FilterChipsProps {
  conditions: FilterCondition[]
  fields: FilterField[]
  onRemoveCondition: (conditionId: string) => void
  onClearAll: () => void
}

export function FilterChips({
  conditions,
  fields,
  onRemoveCondition,
  onClearAll,
}: FilterChipsProps) {
  if (conditions.length === 0) return null

  // Get field definition
  function getField(fieldKey: string): FilterField {
    return fields.find(f => f.key === fieldKey) || fields[0]
  }

  // Get operator label
  function getOperatorLabel(operator: FilterOperator): string {
    const labels: Record<FilterOperator, string> = {
      equals: '=',
      notEquals: '≠',
      contains: '⊃',
      notContains: '⊅',
      startsWith: '^',
      endsWith: '$',
      greaterThan: '>',
      greaterThanOrEqual: '≥',
      lessThan: '<',
      lessThanOrEqual: '≤',
      between: '↔',
      in: '∈',
      notIn: '∉',
      isNull: 'null',
      isNotNull: 'not null',
      isEmpty: 'empty',
      isNotEmpty: 'not empty',
    }
    return labels[operator] || operator
  }

  // Format value for display
  function formatValue(condition: FilterCondition): string {
    if (['isNull', 'isNotNull', 'isEmpty', 'isNotEmpty'].includes(condition.operator)) {
      return ''
    }

    if (condition.operator === 'between') {
      return `${condition.value} - ${condition.value2}`
    }

    if (Array.isArray(condition.value)) {
      return condition.value.join(', ')
    }

    // For select fields, show label instead of value
    const field = getField(condition.field)
    if (field.type === 'select' && field.options) {
      const option = field.options.find(o => o.value === condition.value)
      return option ? option.label : String(condition.value)
    }

    return String(condition.value)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-app-bg rounded-lg border theme-border">
      <span className="text-sm font-bold text-app-muted-foreground">
        Active Filters:
      </span>

      {conditions.map(condition => {
        const field = getField(condition.field)
        const value = formatValue(condition)

        return (
          <Badge
            key={condition.id}
            variant="secondary"
            className="gap-2 px-3 py-1.5 cursor-pointer hover:bg-app-error-soft dark:hover:bg-red-900/20 transition-colors group"
            onClick={() => onRemoveCondition(condition.id)}
          >
            <span className="font-semibold">{field.label}</span>
            <span className="text-app-muted-foreground">{getOperatorLabel(condition.operator)}</span>
            {value && <span className="text-app-info dark:text-blue-400">{value}</span>}
            <X className="w-3 h-3 opacity-50 group-hover:opacity-100 group-hover:text-app-error dark:group-hover:text-red-400" />
          </Badge>
        )
      })}

      {conditions.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="text-xs h-auto py-1"
        >
          Clear all
        </Button>
      )}
    </div>
  )
}
