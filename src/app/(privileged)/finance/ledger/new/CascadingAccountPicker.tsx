'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, Check, X, FolderTree, FileText, ChevronDown, ChevronRight } from 'lucide-react'

type Account = {
  id: number
  code: string
  name: string
  type: string
  parent?: number | null
  parentId?: number | null
  parent_id?: number | null
  allow_posting?: boolean
  is_active?: boolean
  isActive?: boolean
  path?: string
}

interface Props {
  accounts: Account[]
  value: string
  displayValue: string
  onChange: (accountId: string, displayText: string) => void
}

function getParentId(acc: Account): number | null {
  const v = acc.parentId ?? acc.parent_id ?? acc.parent
  return v != null ? Number(v) : null
}

/**
 * Build a hierarchy tree from a flat list of accounts.
 * Strategy:
 *   1. If parent FK relationships exist → use them.
 *   2. Otherwise, infer hierarchy from account CODE structure:
 *      Code "1" is parent of "10", "11", etc.
 *      Code "10" is parent of "100", "101", etc.
 *      This matches Lebanese PCN, French PCG, SYSCOHADA patterns.
 */
function buildChildrenMap(accounts: Account[]): Record<string, Account[]> {
  // First: check if FK parents exist
  const hasParentFK = accounts.some(a => getParentId(a) != null)

  if (hasParentFK) {
    const map: Record<string, Account[]> = { root: [] }
    for (const acc of accounts) {
      const pid = getParentId(acc)
      const key = pid != null ? String(pid) : 'root'
      if (!map[key]) map[key] = []
      map[key].push(acc)
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.code.localeCompare(b.code))
    return map
  }

  // Fallback: build hierarchy from CODE structure
  // Sort by code length then code value
  const sorted = [...accounts].sort((a, b) => a.code.length - b.code.length || a.code.localeCompare(b.code))
  const codeToId = new Map<string, number>()
  for (const acc of sorted) codeToId.set(acc.code, acc.id)

  const map: Record<string, Account[]> = { root: [] }

  for (const acc of sorted) {
    // Find parent by progressively shortening the code
    let parentFound = false
    for (let len = acc.code.length - 1; len >= 1; len--) {
      const potentialParentCode = acc.code.substring(0, len)
      const parentId = codeToId.get(potentialParentCode)
      if (parentId !== undefined) {
        const key = String(parentId)
        if (!map[key]) map[key] = []
        map[key].push(acc)
        parentFound = true
        break
      }
    }
    if (!parentFound) {
      map.root.push(acc)
    }
  }

  for (const k of Object.keys(map)) map[k].sort((a, b) => a.code.localeCompare(b.code))
  return map
}

export function CascadingAccountPicker({ accounts, value, displayValue, onChange }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [selections, setSelections] = useState<(number | null)[]>([null])
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const childrenMap = useMemo(() => buildChildrenMap(accounts), [accounts])
  const hasChildren = (accId: number) => (childrenMap[String(accId)]?.length || 0) > 0
  const getChildCount = (accId: number) => childrenMap[String(accId)]?.length || 0

  // Search
  const searchResults = useMemo(() => {
    if (!searchQuery) return []
    const q = searchQuery.toLowerCase()
    return accounts
      .filter(a => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aLeaf = hasChildren(a.id) ? 1 : 0
        const bLeaf = hasChildren(b.id) ? 1 : 0
        return aLeaf - bLeaf || a.code.localeCompare(b.code)
      })
      .slice(0, 15)
  }, [accounts, searchQuery, childrenMap])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) setShowResults(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectFromSearch = (acc: Account) => {
    onChange(String(acc.id), `${acc.code} ${acc.name}`)
    setSearchQuery('')
    setShowResults(false)
  }

  // ── Modal ──
  const openModal = () => {
    setSelections([null])
    setModalOpen(true)
  }

  const handleCascadeChange = (level: number, accId: number | null) => {
    const next = selections.slice(0, level + 1)
    next[level] = accId
    if (accId && hasChildren(accId)) next.push(null)
    setSelections(next)
  }

  const getDeepestSelection = (): Account | null => {
    const lastId = [...selections].reverse().find(s => s !== null)
    return lastId ? accounts.find(a => a.id === lastId) || null : null
  }

  const confirmModal = () => {
    const acc = getDeepestSelection()
    if (acc) onChange(String(acc.id), `${acc.code} ${acc.name}`)
    setModalOpen(false)
  }

  const selectedAcc = value ? accounts.find(a => String(a.id) === value) : null
  const rootAccounts = childrenMap['root'] || []

  return (
    <>
      {/* ── Inline Input + Browse Button ── */}
      <div className="flex items-center gap-1.5">
        <div ref={searchContainerRef} className="relative flex-1">
          <input
            type="text"
            value={value ? (selectedAcc ? `${selectedAcc.code} ${selectedAcc.name}` : displayValue) : searchQuery}
            onChange={e => {
              if (value) { onChange('', ''); setSearchQuery(e.target.value) }
              else setSearchQuery(e.target.value)
              setShowResults(true)
            }}
            onFocus={() => { if (searchQuery) setShowResults(true) }}
            placeholder="Type code or name..."
            className={`w-full p-1.5 border rounded text-xs focus:ring-1 focus:ring-emerald-500/50 outline-none font-medium transition-all ${
              value ? 'border-app-success/50 bg-app-success/5 text-app-foreground' : 'border-app-border text-app-muted-foreground'
            }`}
          />
          {value && (
            <button type="button" onClick={() => { onChange('', ''); setSearchQuery('') }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-app-muted-foreground hover:text-app-error transition-colors">
              <X size={12} />
            </button>
          )}
          {showResults && searchResults.length > 0 && !value && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl bg-app-surface border border-app-border shadow-2xl overflow-hidden" style={{ maxHeight: '260px', overflowY: 'auto' }}>
              {searchResults.map(acc => {
                const isLeaf = !hasChildren(acc.id)
                return (
                  <button key={acc.id} type="button" onClick={() => selectFromSearch(acc)}
                    className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-app-success/5 transition-colors border-b border-app-border/20 last:border-0">
                    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${isLeaf ? 'bg-app-success/10' : 'bg-app-warning/10'}`}>
                      {isLeaf ? <FileText size={9} className="text-app-success" /> : <FolderTree size={9} className="text-app-warning" />}
                    </div>
                    <span className="font-mono font-bold text-app-success">{acc.code}</span>
                    <span className="truncate text-app-foreground flex-1">{acc.name}</span>
                    {isLeaf && <Check size={10} className="text-app-success shrink-0" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <button type="button" onClick={openModal} title="Browse account tree step by step"
          className="w-8 h-8 rounded-lg border border-app-border flex items-center justify-center text-app-muted-foreground hover:text-app-success hover:border-app-success/30 hover:bg-app-success/5 transition-all shrink-0">
          <FolderTree size={14} />
        </button>
      </div>

      {/* ── Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-lg bg-app-surface rounded-2xl shadow-2xl border border-app-border overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-app-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-app-success/10 flex items-center justify-center">
                  <FolderTree size={18} className="text-app-success" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-app-foreground">Browse Chart of Accounts</h3>
                  <p className="text-tp-xs text-app-muted-foreground">
                    {rootAccounts.length} top-level · Select step by step
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-muted/10 transition-all">
                <X size={16} />
              </button>
            </div>

            {/* Body: Cascading Selects */}
            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Breadcrumb Trail */}
              {selections.filter(s => s != null).length > 0 && (
                <div className="flex items-center gap-1 flex-wrap text-tp-xs px-1">
                  <span className="text-app-muted-foreground font-bold">Path:</span>
                  {selections.filter(s => s != null).map((id, i) => {
                    const acc = accounts.find(a => a.id === id)
                    return acc ? (
                      <span key={id} className="flex items-center gap-1">
                        {i > 0 && <ChevronRight size={8} className="text-app-muted-foreground" />}
                        <span className="font-bold text-app-success">{acc.code}</span>
                      </span>
                    ) : null
                  })}
                </div>
              )}

              {selections.map((selectedId, level) => {
                const parentId = level === 0 ? null : selections[level - 1]
                const key = parentId != null ? String(parentId) : 'root'
                const options = childrenMap[key] || []

                if (options.length === 0) return null

                const parentAcc = parentId != null ? accounts.find(a => a.id === parentId) : null

                return (
                  <div key={`lvl-${level}-${parentId || 'root'}`}
                    className={`animate-in fade-in slide-in-from-top-2 duration-300 ${level > 0 ? 'ml-3 pl-3 border-l-2 border-app-primary/20' : ''}`}>
                    {/* Label */}
                    <label className="block text-tp-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-1.5">
                      {level === 0 ? (
                        <span>Step 1 — Select Account Group</span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <span className="text-app-success">Step {level + 1}</span>
                          <span>— Sub-accounts of</span>
                          <span className="text-app-success font-mono">{parentAcc?.code}</span>
                          <span className="normal-case font-medium truncate">{parentAcc?.name}</span>
                        </span>
                      )}
                    </label>

                    {/* Select */}
                    <div className="relative">
                      <select
                        value={selectedId != null ? String(selectedId) : ''}
                        onChange={e => handleCascadeChange(level, e.target.value ? Number(e.target.value) : null)}
                        className="w-full p-2.5 pr-8 border border-app-border rounded-xl text-sm font-medium bg-app-surface text-app-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-app-success/50 appearance-none cursor-pointer"
                        autoFocus={level > 0}
                      >
                        <option value="">— Choose ({options.length} options) —</option>
                        {options.map(acc => {
                          const isFolder = hasChildren(acc.id)
                          const cc = getChildCount(acc.id)
                          return (
                            <option key={acc.id} value={String(acc.id)}>
                              {acc.code} — {acc.name}{isFolder ? ` ▸ (${cc} sub)` : ' ✓'}
                            </option>
                          )
                        })}
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground pointer-events-none" />
                    </div>

                    {/* Selection hint */}
                    {selectedId != null && (() => {
                      const acc = accounts.find(a => a.id === selectedId)
                      if (!acc) return null
                      const isLeaf = !hasChildren(acc.id)
                      return (
                        <div className={`mt-1.5 flex items-center gap-2 px-3 py-1.5 rounded-lg text-tp-xs font-bold ${
                          isLeaf ? 'bg-app-success/10 text-app-success' : 'bg-app-warning/8 text-app-warning'
                        }`}>
                          {isLeaf ? <Check size={10} /> : <FolderTree size={10} />}
                          <span>{acc.code} — {acc.name}</span>
                          <span className="ml-auto">
                            {isLeaf ? '✓ Ready to use' : '↓ Choose sub-account below'}
                          </span>
                        </div>
                      )
                    })()}
                  </div>
                )
              })}

              {/* Final green card when leaf is reached */}
              {(() => {
                const acc = getDeepestSelection()
                if (!acc || hasChildren(acc.id)) return null
                return (
                  <div className="mt-2 p-4 rounded-xl bg-app-success/10 border border-app-success/20 animate-in fade-in duration-300">
                    <div className="text-tp-xs font-bold text-app-success uppercase tracking-wider mb-2">✓ Account Selected</div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-app-success/15 flex items-center justify-center shrink-0">
                        <FileText size={18} className="text-app-success" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-base font-bold text-app-foreground">{acc.code}</div>
                        <div className="text-sm text-app-foreground truncate">{acc.name}</div>
                        <div className="text-tp-xs text-app-muted-foreground font-mono mt-0.5">{acc.type}</div>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-app-border">
              <button type="button" onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-app-muted-foreground hover:text-app-foreground hover:bg-app-muted/10 transition-all">
                Cancel
              </button>
              <button type="button" onClick={confirmModal} disabled={!getDeepestSelection()}
                className="px-6 py-2 rounded-xl text-xs font-bold bg-app-success text-white hover:bg-app-success disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20">
                <Check size={12} className="inline mr-1.5" />Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
