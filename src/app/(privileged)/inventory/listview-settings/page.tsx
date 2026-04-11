'use client'

import { useState, useCallback } from 'react'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
 Settings, Eye, EyeOff, ArrowUp, ArrowDown, RotateCcw,
 ChevronDown, ChevronUp, Save, Trash2, List, SlidersHorizontal,
} from 'lucide-react'
import { toast } from 'sonner'

/* ═══════════════════════════════════════════════════════
 ListView Settings — Customize every list view in Inventory
 ═══════════════════════════════════════════════════════ */

type ListViewConfig = {
 key: string
 title: string
 description: string
 allColumns: { key: string; label: string; alwaysVisible?: boolean }[]
 defaultPageSize: number
 defaultSortKey: string
 defaultSortDir: 'asc' | 'desc'
}

const LISTVIEW_CONFIGS: ListViewConfig[] = [
 {
 key: 'inventory_transfers',
 title: 'Stock Transfer',
 description: 'Transfer orders between warehouses',
 allColumns: [
 { key: 'date', label: 'Date', alwaysVisible: true },
 { key: 'reference', label: 'Reference', alwaysVisible: true },
 { key: 'qty', label: 'QTY Transferred' },
 { key: 'from', label: 'From Location' },
 { key: 'to', label: 'To Location' },
 { key: 'reason', label: 'Reason' },
 { key: 'driver', label: 'Driver' },
 ],
 defaultPageSize: 25,
 defaultSortKey: 'date',
 defaultSortDir: 'desc',
 },
 {
 key: 'inventory_adjustments',
 title: 'Stock Adjustment',
 description: 'Adjustment orders for inventory corrections',
 allColumns: [
 { key: 'date', label: 'Date', alwaysVisible: true },
 { key: 'supplier', label: 'Supplier' },
 { key: 'reference', label: 'Reference', alwaysVisible: true },
 { key: 'qty', label: 'QTY Adj.' },
 { key: 'amt', label: 'Amt Adj' },
 { key: 'wh', label: 'Location' },
 { key: 'reason', label: 'Reason' },
 ],
 defaultPageSize: 25,
 defaultSortKey: 'date',
 defaultSortDir: 'desc',
 },
 {
 key: 'inventory_products',
 title: 'Product Inventory',
 description: 'All products with pricing & stock levels',
 allColumns: [
 { key: 'name', label: 'Product', alwaysVisible: true },
 { key: 'barcode', label: 'Barcode/SKU' },
 { key: 'category', label: 'Category' },
 { key: 'qty', label: 'Total Qty' },
 { key: 'cost', label: 'Cost' },
 { key: 'price', label: 'Selling Price' },
 { key: 'margin', label: 'Margin %' },
 { key: 'health', label: 'Health' },
 { key: 'status', label: 'Status' },
 ],
 defaultPageSize: 25,
 defaultSortKey: 'name',
 defaultSortDir: 'asc',
 },
]

function ListViewSection({ config }: { config: ListViewConfig }) {
 const settings = useListViewSettings(config.key, {
 columns: config.allColumns.map(c => c.key),
 pageSize: config.defaultPageSize,
 sortKey: config.defaultSortKey,
 sortDir: config.defaultSortDir,
 })

 const [expanded, setExpanded] = useState(false)
 const [presetName, setPresetName] = useState('')

 const handleSavePreset = () => {
 if (!presetName.trim()) { toast.error('Enter a preset name'); return }
 const filterValues: Record<string, string | boolean> = {}
 settings.saveFilterPreset(presetName.trim(), filterValues)
 setPresetName('')
 toast.success(`Preset "${presetName}" saved`)
 }

 const visibleCount = settings.visibleColumns.length
 const totalCount = config.allColumns.length

 return (
 <div className="bg-app-surface rounded-xl border border-app-border overflow-hidden transition-all duration-200 hover:shadow-sm">
 {/* Header */}
 <button
 onClick={() => setExpanded(!expanded)}
 className="app-page w-full flex items-center justify-between px-5 py-4 hover:bg-app-surface-2/50 transition-colors"
 >
 <div className="flex items-center gap-3">
 <div className="p-2 rounded-lg bg-app-primary-light">
 <List className="h-5 w-5 text-app-primary" />
 </div>
 <div className="text-left">
 <h3 className="font-semibold text-app-foreground">{config.title}</h3>
 <p className="text-xs text-app-muted-foreground mt-0.5">{config.description}</p>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <span className="text-xs text-app-muted-foreground">{visibleCount}/{totalCount} columns</span>
 <span className="text-xs text-app-muted-foreground">{settings.pageSize}/page</span>
 {expanded ? <ChevronUp className="h-4 w-4 text-app-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-app-muted-foreground" />}
 </div>
 </button>

 {expanded && (
 <div className="border-t border-app-border px-5 py-5 space-y-6 animate-in slide-in-from-top-2 duration-200">
 {/* ─── Column Visibility & Order ─────── */}
 <div>
 <div className="flex items-center gap-2 mb-3">
 <Eye className="h-4 w-4 text-app-muted-foreground" />
 <h4 className="text-sm font-semibold text-app-muted-foreground">Column Visibility & Order</h4>
 </div>
 <div className="space-y-1">
 {settings.columnOrder
 .filter(key => config.allColumns.some(c => c.key === key))
 .map((key, idx) => {
 const col = config.allColumns.find(c => c.key === key)!
 const isVisible = settings.isColumnVisible(key)
 return (
 <div key={key}
 className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isVisible ? 'bg-app-surface border border-app-border' : 'bg-app-surface-2/50 border border-transparent'
 }`}>
 <Checkbox
 checked={isVisible}
 onCheckedChange={() => settings.toggleColumn(key)}
 disabled={col.alwaysVisible}
 />
 <span className={`flex-1 text-sm ${isVisible ? 'text-app-foreground' : 'text-app-muted-foreground line-through'}`}>
 {col.label}
 </span>
 {col.alwaysVisible && (
 <span className="text-[10px] text-app-primary font-medium uppercase tracking-wider">Required</span>
 )}
 <div className="flex items-center gap-0.5">
 <button onClick={() => settings.moveColumn(key, 'up')}
 disabled={idx === 0}
 className="p-1 rounded hover:bg-app-surface-2 disabled:opacity-20 transition-colors">
 <ArrowUp className="h-3 w-3 text-app-muted-foreground" />
 </button>
 <button onClick={() => settings.moveColumn(key, 'down')}
 disabled={idx === settings.columnOrder.length - 1}
 className="p-1 rounded hover:bg-app-surface-2 disabled:opacity-20 transition-colors">
 <ArrowDown className="h-3 w-3 text-app-muted-foreground" />
 </button>
 </div>
 </div>
 )
 })}
 </div>
 </div>

 {/* ─── Display Settings ──────────────── */}
 <div>
 <div className="flex items-center gap-2 mb-3">
 <SlidersHorizontal className="h-4 w-4 text-app-muted-foreground" />
 <h4 className="text-sm font-semibold text-app-muted-foreground">Display Settings</h4>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label className="text-xs text-app-muted-foreground">Rows per page</Label>
 <Select value={String(settings.pageSize)} onValueChange={v => settings.setPageSize(parseInt(v))}>
 <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
 <SelectContent>
 {[10, 25, 50, 100].map(s => <SelectItem key={s} value={String(s)}>{s} rows</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label className="text-xs text-app-muted-foreground">Default Sort</Label>
 <div className="grid grid-cols-2 gap-2 mt-1">
 <Select value={settings.sortKey} onValueChange={v => settings.setSort(v, settings.sortDir)}>
 <SelectTrigger className="text-xs"><SelectValue placeholder="Column" /></SelectTrigger>
 <SelectContent>
 {config.allColumns.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
 </SelectContent>
 </Select>
 <Select value={settings.sortDir} onValueChange={v => settings.setSort(settings.sortKey, v as 'asc' | 'desc')}>
 <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="asc">Ascending</SelectItem>
 <SelectItem value="desc">Descending</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>
 </div>
 </div>

 {/* ─── Filter Presets ────────────────── */}
 <div>
 <div className="flex items-center gap-2 mb-3">
 <Save className="h-4 w-4 text-app-muted-foreground" />
 <h4 className="text-sm font-semibold text-app-muted-foreground">Filter Presets</h4>
 </div>
 {settings.filterPresets.length > 0 ? (
 <div className="space-y-1 mb-3">
 {settings.filterPresets.map(p => (
 <div key={p.name} className="flex items-center justify-between px-3 py-2 bg-app-background rounded-lg">
 <span className="text-sm text-app-muted-foreground">{p.name}</span>
 <button onClick={() => { settings.deleteFilterPreset(p.name); toast.success('Deleted') }}
 className="p-1 rounded hover:bg-app-error-bg text-app-error hover:text-app-error transition-colors">
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </div>
 ))}
 </div>
 ) : (
 <p className="text-xs text-app-muted-foreground mb-3">No presets saved yet. Save filter combinations for quick access.</p>
 )}
 <div className="flex gap-2">
 <Input value={presetName} onChange={e => setPresetName(e.target.value)}
 placeholder="Preset name" className="h-8 text-sm" />
 <Button size="sm" variant="outline" onClick={handleSavePreset} className="h-8 whitespace-nowrap">
 <Save className="h-3.5 w-3.5 mr-1" /> Save
 </Button>
 </div>
 </div>

 {/* ─── Reset ──────────────────────────── */}
 <div className="flex justify-end pt-2 border-t border-app-border">
 <Button variant="outline" size="sm" onClick={() => { settings.reset(); toast.success('Reset to defaults') }}
 className="text-app-error border-app-error hover:bg-app-error-bg hover:text-app-error">
 <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset to Defaults
 </Button>
 </div>
 </div>
 )}
 </div>
 )
}

export default function ListViewSettingsPage() {
 return (
 <div className="p-6 max-w-3xl mx-auto animate-in fade-in duration-500">
 {/* Page header */}
 <div className="flex items-center gap-4 mb-6">
 <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-200">
 <Settings className="h-7 w-7 text-app-foreground" />
 </div>
 <div>
 <h1 className="page-header-title tracking-tighter">ListView <span className="text-app-primary">Settings</span></h1>
 <p className="text-sm text-app-muted-foreground">Customize columns, page size, sorting, and filters for every list view</p>
 </div>
 </div>

 {/* List view sections */}
 <div className="space-y-3">
 {LISTVIEW_CONFIGS.map(config => (
 <ListViewSection key={config.key} config={config} />
 ))}
 </div>

 {/* Info */}
 <div className="mt-6 p-4 bg-app-info-bg border border-app-info rounded-lg">
 <p className="text-xs text-app-info">
 <strong>Note:</strong> Settings are saved automatically per browser. You can also customize columns directly on each page
 using the <strong>Columns</strong> button and page size using the dropdown at the bottom of each table.
 </p>
 </div>
 </div>
 )
}
