'use client'

import { useState, useRef, useMemo } from 'react'
import { GripVertical } from 'lucide-react'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import type { ColumnDef } from './types'

interface DraggableColumnListProps {
  allColumns: ColumnDef[]
  columnOrder: string[]
  visibleColumns: Record<string, boolean>
  onToggle: (key: string) => void
  onReorder: (order: string[]) => void
  onReset: () => void
}

export function DraggableColumnList({
  allColumns, columnOrder, visibleColumns,
  onToggle, onReorder, onReset,
}: DraggableColumnListProps) {
  const dragRef = useRef<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  // Derive ordered column defs
  const orderedCols = useMemo(() => {
    const colMap = new Map(allColumns.map(c => [c.key, c]))
    const seen = new Set<string>()
    const result: ColumnDef[] = []
    
    for (const key of columnOrder) {
      const col = colMap.get(key)
      if (col && !seen.has(key)) { result.push(col); seen.add(key) }
    }
    
    for (const col of allColumns) {
      if (!seen.has(col.key)) result.push(col)
    }
    return result
  }, [allColumns, columnOrder])

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">List Columns</span>
        <button onClick={onReset} className="text-[10px] font-bold text-app-primary hover:underline">Reset</button>
      </div>
      <p className="text-[10px] text-app-muted-foreground mb-3">
        Toggle visibility and <strong>drag</strong> the grip handle to reorder columns.
      </p>
      <div className="space-y-0.5">
        {orderedCols.map(col => {
          const isOn = !!visibleColumns[col.key]
          const isDragTarget = dragOver === col.key
          const isLocked = !!col.alwaysVisible

          return (
            <div
              key={col.key}
              className={`flex items-center gap-1.5 px-2 py-2 rounded-xl transition-all ${isDragTarget ? 'ring-2 ring-app-primary/40 bg-app-primary/5' : 'hover:bg-app-surface/60'}`}
              draggable={!isLocked}
              onDragStart={() => { dragRef.current = col.key }}
              onDragOver={e => { e.preventDefault(); setDragOver(col.key) }}
              onDragLeave={() => { if (dragOver === col.key) setDragOver(null) }}
              onDrop={() => {
                setDragOver(null)
                if (!dragRef.current || dragRef.current === col.key) return
                const newOrder = [...columnOrder]
                const fromIdx = newOrder.indexOf(dragRef.current)
                const toIdx = newOrder.indexOf(col.key)
                if (fromIdx < 0 || toIdx < 0) return
                newOrder.splice(fromIdx, 1)
                newOrder.splice(toIdx, 0, dragRef.current)
                onReorder(newOrder)
                dragRef.current = null
              }}
              onDragEnd={() => { dragRef.current = null; setDragOver(null) }}
            >
              {/* Grip handle */}
              <div className={`flex-shrink-0 ${isLocked ? 'opacity-20 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing text-app-muted-foreground hover:text-app-foreground'}`}>
                <GripVertical size={14} />
              </div>
              {/* Label — clicking toggles visibility */}
              <button type="button" onClick={() => !isLocked && onToggle(col.key)} disabled={isLocked} className="flex-1 text-left min-w-0">
                <span className={`text-[12px] font-bold ${isOn ? 'text-app-foreground' : 'text-app-muted-foreground line-through opacity-60'}`}>
                  {col.label}
                </span>
                {col.sublabel && (
                    <span className="text-[9px] font-bold text-app-muted-foreground ml-1.5 opacity-60">{col.sublabel}</span>
                )}
              </button>
              {/* Toggle */}
              <div className={`flex-shrink-0 ${isLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`} onClick={() => !isLocked && onToggle(col.key)}>
                <ToggleSwitch on={isOn} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
