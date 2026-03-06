'use client'

/**
 * Saved Filters Component
 * =======================
 * Manage saved filter presets with templates.
 * Beats Sage (no saved filters) and Odoo (limited saved filters).
 */

import { useState } from 'react'
import { Save, Star, Trash2, Users, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import type { SavedFilter, FilterGroup, FilterTemplate } from '@/types/filters'

interface SavedFiltersProps {
  savedFilters: SavedFilter[]
  templates: FilterTemplate[]
  currentFilter?: FilterGroup
  onLoadFilter: (filter: SavedFilter | FilterTemplate) => void
  onSaveFilter: (name: string, description: string, isPublic: boolean, isDefault: boolean) => void
  onDeleteFilter: (filterId: string) => void
  onSetDefault: (filterId: string) => void
}

export function SavedFilters({
  savedFilters,
  templates,
  currentFilter,
  onLoadFilter,
  onSaveFilter,
  onDeleteFilter,
  onSetDefault,
}: SavedFiltersProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [filterName, setFilterName] = useState('')
  const [filterDescription, setFilterDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [isDefault, setIsDefault] = useState(false)

  // Handle save filter
  function handleSave() {
    if (!filterName.trim()) return

    onSaveFilter(filterName, filterDescription, isPublic, isDefault)

    // Reset form
    setFilterName('')
    setFilterDescription('')
    setIsPublic(false)
    setIsDefault(false)
    setSaveDialogOpen(false)
  }

  // Get default filter
  const defaultFilter = savedFilters.find(f => f.isDefault)

  return (
    <div className="space-y-4">
      {/* Quick Filter Templates */}
      {templates.length > 0 && (
        <div>
          <label className="text-sm font-bold theme-text-muted uppercase mb-2 block">
            Quick Filters
          </label>
          <div className="space-y-2">
            {templates.map(template => (
              <Button
                key={template.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => onLoadFilter(template)}
              >
                <span className="mr-2">{template.icon}</span>
                <div className="flex-1 text-left">
                  <div className="font-semibold">{template.name}</div>
                  <div className="text-xs theme-text-muted">{template.description}</div>
                </div>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Saved Filters */}
      {savedFilters.length > 0 && (
        <div>
          <label className="text-sm font-bold theme-text-muted uppercase mb-2 block">
            My Saved Filters
          </label>
          <div className="space-y-2">
            {savedFilters.map(filter => (
              <div
                key={filter.id}
                className="flex items-center gap-2 p-2 theme-surface rounded-lg border theme-border hover:bg-[var(--theme-bg)] cursor-pointer"
                onClick={() => onLoadFilter(filter)}
              >
                {/* Default star */}
                {filter.isDefault && (
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                )}

                {/* Filter info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold theme-text truncate">
                      {filter.name}
                    </span>
                    {filter.isPublic && (
                      <Badge variant="secondary" className="text-xs">
                        <Users className="w-3 h-3 mr-1" />
                        Team
                      </Badge>
                    )}
                  </div>
                  {filter.description && (
                    <p className="text-xs theme-text-muted truncate">
                      {filter.description}
                    </p>
                  )}
                  <p className="text-xs theme-text-muted">
                    Used {filter.usageCount} times
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-1">
                  {!filter.isDefault && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSetDefault(filter.id)
                      }}
                      title="Set as default"
                    >
                      <Star className="w-4 h-4" />
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteFilter(filter.id)
                    }}
                    title="Delete filter"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save Current Filter Button */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full"
            disabled={!currentFilter || currentFilter.conditions.length === 0}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Current Filter
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Filter</DialogTitle>
            <DialogDescription>
              Save your current filter for quick access later
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Filter name */}
            <div>
              <label className="text-sm font-bold theme-text mb-2 block">
                Filter Name *
              </label>
              <Input
                placeholder="e.g., High-value customers"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-bold theme-text mb-2 block">
                Description
              </label>
              <Input
                placeholder="Optional description"
                value={filterDescription}
                onChange={(e) => setFilterDescription(e.target.value)}
              />
            </div>

            {/* Options */}
            <div className="space-y-3">
              {/* Public filter */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="public"
                  checked={isPublic}
                  onCheckedChange={(checked) => setIsPublic(checked as boolean)}
                />
                <label htmlFor="public" className="text-sm theme-text cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>Share with team</span>
                  </div>
                  <p className="text-xs theme-text-muted">
                    Other users can see and use this filter
                  </p>
                </label>
              </div>

              {/* Default filter */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="default"
                  checked={isDefault}
                  onCheckedChange={(checked) => setIsDefault(checked as boolean)}
                />
                <label htmlFor="default" className="text-sm theme-text cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4" />
                    <span>Set as my default filter</span>
                  </div>
                  <p className="text-xs theme-text-muted">
                    Apply this filter automatically when you visit this page
                  </p>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!filterName.trim()}>
              <Save className="w-4 h-4 mr-2" />
              Save Filter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show default filter info */}
      {defaultFilter && (
        <div className="p-3 theme-bg rounded-lg border theme-border">
          <div className="flex items-center gap-2 text-sm">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <span className="theme-text">
              <span className="font-semibold">{defaultFilter.name}</span> is your default filter
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
