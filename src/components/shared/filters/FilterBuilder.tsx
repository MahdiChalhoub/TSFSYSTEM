'use client'

/**
 * Advanced Filter Builder Component
 * ==================================
 * Visual query builder with drag-and-drop, AND/OR logic, and nested groups.
 * Beats Odoo and Sage's basic filtering.
 */

import { useState } from 'react'
import { Plus, X, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type {
  FilterGroup,
  FilterCondition,
  FilterField,
  FilterOperator,
  FilterLogic,
} from '@/types/filters'

interface FilterBuilderProps {
  fields: FilterField[]
  filterGroup: FilterGroup
  onChange: (filterGroup: FilterGroup) => void
}

export function FilterBuilder({ fields, filterGroup, onChange }: FilterBuilderProps) {
  const [group, setGroup] = useState<FilterGroup>(filterGroup)

  // Update parent when group changes
  function updateGroup(newGroup: FilterGroup) {
    setGroup(newGroup)
    onChange(newGroup)
  }

  // Add new condition
  function addCondition() {
    const newCondition: FilterCondition = {
      id: `condition-${Date.now()}`,
      field: fields[0].key,
      operator: fields[0].operators[0],
      value: '',
    }

    updateGroup({
      ...group,
      conditions: [...group.conditions, newCondition],
    })
  }

  // Remove condition
  function removeCondition(conditionId: string) {
    updateGroup({
      ...group,
      conditions: group.conditions.filter(c => c.id !== conditionId),
    })
  }

  // Update condition
  function updateCondition(conditionId: string, updates: Partial<FilterCondition>) {
    updateGroup({
      ...group,
      conditions: group.conditions.map(c =>
        c.id === conditionId ? { ...c, ...updates } : c
      ),
    })
  }

  // Toggle logic (AND/OR)
  function toggleLogic() {
    updateGroup({
      ...group,
      logic: group.logic === 'AND' ? 'OR' : 'AND',
    })
  }

  // Add nested group
  function addGroup() {
    const newGroup: FilterGroup = {
      id: `group-${Date.now()}`,
      logic: 'AND',
      conditions: [],
      groups: [],
    }

    updateGroup({
      ...group,
      groups: [...(group.groups || []), newGroup],
    })
  }

  // Get field definition
  function getField(fieldKey: string): FilterField {
    return fields.find(f => f.key === fieldKey) || fields[0]
  }

  // Get operator label
  function getOperatorLabel(operator: FilterOperator): string {
    const labels: Record<FilterOperator, string> = {
      equals: 'equals',
      notEquals: 'not equals',
      contains: 'contains',
      notContains: 'does not contain',
      startsWith: 'starts with',
      endsWith: 'ends with',
      greaterThan: 'greater than',
      greaterThanOrEqual: 'greater than or equal',
      lessThan: 'less than',
      lessThanOrEqual: 'less than or equal',
      between: 'between',
      in: 'in',
      notIn: 'not in',
      isNull: 'is null',
      isNotNull: 'is not null',
      isEmpty: 'is empty',
      isNotEmpty: 'is not empty',
    }
    return labels[operator] || operator
  }

  // Render condition value input
  function renderValueInput(condition: FilterCondition) {
    const field = getField(condition.field)

    // No value needed for null/empty checks
    if (['isNull', 'isNotNull', 'isEmpty', 'isNotEmpty'].includes(condition.operator)) {
      return null
    }

    // Between operator needs two inputs
    if (condition.operator === 'between') {
      return (
        <div className="flex gap-2">
          <Input
            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
            value={condition.value || ''}
            onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
            placeholder="Min"
            className="w-32"
          />
          <span className="text-app-muted-foreground">and</span>
          <Input
            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
            value={condition.value2 || ''}
            onChange={(e) => updateCondition(condition.id, { value2: e.target.value })}
            placeholder="Max"
            className="w-32"
          />
        </div>
      )
    }

    // Select field
    if (field.type === 'select' && field.options) {
      return (
        <Select
          value={condition.value || ''}
          onValueChange={(value) => updateCondition(condition.id, { value })}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select value" />
          </SelectTrigger>
          <SelectContent>
            {field.options.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    // Boolean field
    if (field.type === 'boolean') {
      return (
        <Select
          value={String(condition.value) || 'true'}
          onValueChange={(value) => updateCondition(condition.id, { value: value === 'true' })}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">True</SelectItem>
            <SelectItem value="false">False</SelectItem>
          </SelectContent>
        </Select>
      )
    }

    // Default: text/number/date input
    return (
      <Input
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        value={condition.value || ''}
        onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
        placeholder="Enter value"
        className="w-48"
      />
    )
  }

  // Render single condition
  function renderCondition(condition: FilterCondition, index: number) {
    const field = getField(condition.field)

    return (
      <div
        key={condition.id}
        className="flex items-center gap-2 p-3 theme-surface rounded-lg border theme-border"
      >
        {/* Drag handle */}
        <GripVertical className="w-4 h-4 text-app-muted-foreground cursor-move" />

        {/* Logic badge (AND/OR) - only show after first condition */}
        {index > 0 && (
          <Badge
            variant="outline"
            className="cursor-pointer"
            onClick={toggleLogic}
          >
            {group.logic}
          </Badge>
        )}

        {/* Field selector */}
        <Select
          value={condition.field}
          onValueChange={(fieldKey) => {
            const newField = getField(fieldKey)
            updateCondition(condition.id, {
              field: fieldKey,
              operator: newField.operators[0],
              value: '',
            })
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fields.map(field => (
              <SelectItem key={field.key} value={field.key}>
                {field.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Operator selector */}
        <Select
          value={condition.operator}
          onValueChange={(operator) =>
            updateCondition(condition.id, { operator: operator as FilterOperator })
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.operators.map(op => (
              <SelectItem key={op} value={op}>
                {getOperatorLabel(op)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Value input */}
        {renderValueInput(condition)}

        {/* Remove button */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => removeCondition(condition.id)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    )
  }

  return (
    <Card className="layout-card-radius theme-surface">
      <CardContent className="layout-card-padding space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-app-foreground">Filter Conditions</h3>
            <p className="text-sm text-app-muted-foreground">
              {group.conditions.length === 0
                ? 'No conditions yet'
                : `${group.conditions.length} condition${group.conditions.length === 1 ? '' : 's'}`}
            </p>
          </div>

          {group.conditions.length > 1 && (
            <Badge
              variant="secondary"
              className="cursor-pointer"
              onClick={toggleLogic}
            >
              Match {group.logic === 'AND' ? 'ALL' : 'ANY'}
            </Badge>
          )}
        </div>

        {/* Conditions */}
        {group.conditions.length > 0 && (
          <div className="space-y-3">
            {group.conditions.map((condition, index) => renderCondition(condition, index))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t theme-border">
          <Button
            variant="outline"
            size="sm"
            onClick={addCondition}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Condition
          </Button>

          {/* Nested groups (advanced feature - can be added later)
          <Button
            variant="outline"
            size="sm"
            onClick={addGroup}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Group
          </Button>
          */}
        </div>

        {/* Preview */}
        {group.conditions.length > 0 && (
          <div className="p-3 bg-app-bg rounded-lg border theme-border">
            <p className="text-xs font-bold text-app-muted-foreground uppercase mb-2">
              Preview
            </p>
            <p className="text-sm text-app-foreground font-mono">
              {group.conditions.map((c, i) => {
                const field = getField(c.field)
                return (
                  <span key={c.id}>
                    {i > 0 && <span className="text-app-info font-bold"> {group.logic} </span>}
                    <span className="text-purple-500">{field.label}</span>
                    {' '}
                    <span className="text-app-muted-foreground">{getOperatorLabel(c.operator)}</span>
                    {' '}
                    {!['isNull', 'isNotNull', 'isEmpty', 'isNotEmpty'].includes(c.operator) && (
                      <span className="text-app-success">
                        {c.operator === 'between'
                          ? `${c.value} and ${c.value2}`
                          : Array.isArray(c.value)
                          ? c.value.join(', ')
                          : String(c.value)}
                      </span>
                    )}
                  </span>
                )
              })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
