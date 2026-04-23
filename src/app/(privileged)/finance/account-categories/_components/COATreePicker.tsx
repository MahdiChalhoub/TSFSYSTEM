'use client'

import { useEffect, useState, useMemo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const TYPE_COLORS: Record<string, string> = {
    ASSET: '#10b981', LIABILITY: '#f59e0b', EQUITY: '#8b5cf6',
    INCOME: '#3b82f6', EXPENSE: '#ef4444',
}

/* ═══════════════════════════════════════════════════════════
 *  COA CASCADING TREE PICKER
 *  Multi-level drill-down select for choosing a COA parent node
 * ═══════════════════════════════════════════════════════════ */
export function COATreePicker({ coaList, selectedId, onSelect }: {
    coaList: any[]; selectedId: string; onSelect: (id: string) => void
}) {
    const [chain, setChain] = useState<string[]>([])

    const childrenMap = useMemo(() => {
        const map = new Map<string, any[]>()
        for (const n of coaList) {
            const pid = (n.parent_id || 'ROOT').toString()
            if (!map.has(pid)) map.set(pid, [])
            map.get(pid)!.push(n)
        }
        for (const [, children] of map) {
            children.sort((a: any, b: any) => a.code.localeCompare(b.code))
        }
        return map
    }, [coaList])

    const byId = useMemo(() => {
        const map = new Map<string, any>()
        for (const n of coaList) map.set(n.id.toString(), n)
        return map
    }, [coaList])

    useEffect(() => {
        if (!selectedId) { setChain([]); return }
        const path: string[] = []
        let current = byId.get(selectedId)
        while (current) {
            path.unshift(current.id.toString())
            current = current.parent_id ? byId.get(current.parent_id.toString()) : null
        }
        setChain(path)
    }, [selectedId, byId])

    const handleSelect = (level: number, value: string) => {
        const newChain = [...chain.slice(0, level), value]
        setChain(newChain)
        onSelect(value)
    }

    const isValidParent = (node: any) => {
        const children = childrenMap.get(node.id.toString()) || []
        const isLeaf = node.allow_posting === true && children.length === 0
        const hasBalance = parseFloat(node.balance || '0') !== 0
        return !isLeaf && !hasBalance
    }

    const levels: { parentId: string; items: any[] }[] = []
    const roots = childrenMap.get('ROOT') || []
    if (roots.length > 0) {
        levels.push({ parentId: 'ROOT', items: roots })
    }
    for (let i = 0; i < chain.length; i++) {
        const children = childrenMap.get(chain[i]) || []
        if (children.length > 0) {
            levels.push({ parentId: chain[i], items: children })
        }
    }

    return (
        <div className="space-y-2">
            {levels.map((level, idx) => {
                const selectedAtLevel = chain[idx] || ''
                const parentNode = level.parentId !== 'ROOT' ? byId.get(level.parentId) : null
                const label = idx === 0
                    ? 'Select Account Type'
                    : `${parentNode?.code} — ${parentNode?.name}`

                return (
                    <div key={`level-${idx}-${level.parentId}`} className="animate-in fade-in slide-in-from-top-1 duration-150">
                        <label className="text-[9px] font-black uppercase tracking-wider text-app-text-faint block mb-1 flex items-center gap-1.5">
                            {idx > 0 && (
                                <span className="flex items-center gap-0.5">
                                    {'→'.repeat(idx)}
                                </span>
                            )}
                            {label}
                        </label>
                        <Select
                            value={selectedAtLevel}
                            onValueChange={(v) => handleSelect(idx, v)}
                        >
                            <SelectTrigger className="h-9 text-xs font-bold">
                                <SelectValue placeholder={idx === 0 ? "Choose a root account..." : "Choose sub-account..."} />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                                {level.items.map((item: any) => {
                                    const children = childrenMap.get(item.id.toString()) || []
                                    const hasChildren = children.length > 0
                                    const valid = isValidParent(item)
                                    const typeColor = TYPE_COLORS[item.type] || '#64748b'

                                    return (
                                        <SelectItem
                                            key={item.id}
                                            value={item.id.toString()}
                                            disabled={!valid}
                                            className="text-xs"
                                        >
                                            <span className="flex items-center gap-2 w-full">
                                                <span className="font-mono text-[10px] opacity-50">{item.code}</span>
                                                <span className="font-medium flex-1">{item.name}</span>
                                                <span className="text-[8px] font-black px-1 py-0.5 rounded"
                                                    style={{ background: `${typeColor}15`, color: typeColor }}>
                                                    {item.type}
                                                </span>
                                                {hasChildren && (
                                                    <span className="text-[8px] text-app-text-faint">▸ {children.length}</span>
                                                )}
                                            </span>
                                        </SelectItem>
                                    )
                                })}
                            </SelectContent>
                        </Select>
                    </div>
                )
            })}
        </div>
    )
}
