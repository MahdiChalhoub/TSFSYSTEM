'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ArrowRight, Command } from 'lucide-react'

interface SearchItem {
 title: string
 path: string
 section: string
}

// Flatten sidebar menu items into searchable list
function flattenMenuItems(items: Record<string, any>[], section = ''): SearchItem[] {
 const results: SearchItem[] = []
 for (const item of items) {
 const currentSection = section || item.title
 if (item.path) {
 results.push({ title: item.title, path: item.path, section: currentSection })
 }
 if (item.children) {
 results.push(...flattenMenuItems(item.children, currentSection))
 }
 }
 return results
}

// Import menu items from Sidebar — these are re-exported for search
import { MENU_ITEMS } from './Sidebar'

export function CommandPalette() {
 const [open, setOpen] = useState(false)
 const [query, setQuery] = useState('')
 const [selectedIndex, setSelectedIndex] = useState(0)
 const inputRef = useRef<HTMLInputElement>(null)
 const router = useRouter()

 const allItems = flattenMenuItems(MENU_ITEMS)

 const filtered = query.trim()
 ? allItems.filter(item =>
 item.title.toLowerCase().includes(query.toLowerCase()) ||
 item.section.toLowerCase().includes(query.toLowerCase()) ||
 item.path.toLowerCase().includes(query.toLowerCase())
 )
 : allItems.slice(0, 8) // Show top 8 when no query

 // Keyboard shortcut: Ctrl+K or Cmd+K
 useEffect(() => {
 const handler = (e: KeyboardEvent) => {
 if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
 e.preventDefault()
 setOpen(prev => !prev)
 }
 if (e.key === 'Escape') setOpen(false)
 }
 document.addEventListener('keydown', handler)
 return () => document.removeEventListener('keydown', handler)
 }, [])

 // Focus input when opened
 useEffect(() => {
 if (open) {
 setQuery('')
 setSelectedIndex(0)
 setTimeout(() => inputRef.current?.focus(), 50)
 }
 }, [open])

 // Arrow key navigation
 const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
 if (e.key === 'ArrowDown') {
 e.preventDefault()
 setSelectedIndex(i => Math.min(i + 1, filtered.length - 1))
 } else if (e.key === 'ArrowUp') {
 e.preventDefault()
 setSelectedIndex(i => Math.max(i - 1, 0))
 } else if (e.key === 'Enter' && filtered[selectedIndex]) {
 e.preventDefault()
 navigate(filtered[selectedIndex].path)
 }
 }, [filtered, selectedIndex])

 const navigate = (path: string) => {
 setOpen(false)
 router.push(path)
 }

 if (!open) return null

 return (
 <>
 {/* Backdrop */}
 <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-150" onClick={() => setOpen(false)} />

 {/* Palette */}
 <div className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50 animate-in fade-in slide-in-from-top-4 duration-200">
 <div className="bg-app-surface rounded-2xl shadow-2xl border border-app-border overflow-hidden">
 {/* Search Input */}
 <div className="flex items-center gap-3 px-5 py-4 border-b border-app-border">
 <Search size={20} className="text-app-text-faint shrink-0" />
 <input
 ref={inputRef}
 type="text"
 value={query}
 onChange={e => { setQuery(e.target.value); setSelectedIndex(0) }}
 onKeyDown={handleKeyDown}
 placeholder="Search pages, settings, reports..."
 className="flex-1 text-sm outline-none bg-transparent placeholder:text-app-text-faint"
 />
 <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-bold text-app-text-faint bg-app-surface-2 rounded-lg border border-app-border">
 ESC
 </kbd>
 </div>

 {/* Results */}
 <div className="max-h-[340px] overflow-y-auto p-2">
 {filtered.length === 0 ? (
 <div className="py-8 text-center text-sm text-app-text-faint">
 No pages found for &quot;{query}&quot;
 </div>
 ) : (
 filtered.map((item, i) => (
 <button
 key={item.path}
 onClick={() => navigate(item.path)}
 onMouseEnter={() => setSelectedIndex(i)}
 className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${i === selectedIndex
 ? 'bg-app-primary-light text-app-success'
 : 'text-app-text-muted hover:bg-app-bg'
 }`}
 >
 <div className="flex-1 min-w-0">
 <div className="text-sm font-semibold truncate">{item.title}</div>
 <div className="text-[10px] font-bold text-app-text-faint uppercase tracking-wider truncate">
 {item.section} → {item.path}
 </div>
 </div>
 {i === selectedIndex && <ArrowRight size={14} className="text-app-primary shrink-0" />}
 </button>
 ))
 )}
 </div>

 {/* Footer */}
 <div className="flex items-center gap-4 px-5 py-3 bg-app-bg border-t border-app-border text-[10px] font-bold text-app-text-faint uppercase tracking-wider">
 <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-app-surface rounded border text-[9px]">↑↓</kbd> Navigate</span>
 <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-app-surface rounded border text-[9px]">↵</kbd> Open</span>
 <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-app-surface rounded border text-[9px]">Esc</kbd> Close</span>
 </div>
 </div>
 </div>
 </>
 )
}

// Trigger component for embedding in TopHeader
export function CommandPaletteTrigger() {
 const handleClick = () => {
 // Dispatch Ctrl+K to open the palette
 document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
 }

 return (
 <button onClick={handleClick} className="lg:hidden p-2.5 hover:bg-app-surface-2 rounded-xl text-app-text-faint">
 <Search size={22} />
 </button>
 )
}
