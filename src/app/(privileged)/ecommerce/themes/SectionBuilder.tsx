'use client'

import { useState } from 'react'
import {
 Layout,
 Plus,
 Trash2,
 GripVertical,
 Save,
 ChevronUp,
 ChevronDown,
 Sparkles,
 Layers
} from 'lucide-react'
import { updatePortalConfig } from '@/app/actions/client-portal'
import type { StorefrontPageLayout, StorefrontSection } from '@/storefront/engine/types'

interface SectionBuilderProps {
 configId: string
 initialLayout?: StorefrontPageLayout
}

const AVAILABLE_SECTIONS = [
 { type: 'hero', name: 'Hero Banner', description: 'Large promotional banner with CTA' },
 { type: 'featured_collection', name: 'Featured Collection', description: 'Grid of selected products' },
 { type: 'promo_banner', name: 'Promo Stripe', description: 'Wide call-to-action banner' },
 { type: 'category_explorer', name: 'Category Grid', description: 'Browse products by platform categories' },
 { type: 'brand_showcase', name: 'Brand Bar', description: 'Display authorized partner logos' },
]

export default function SectionBuilder({ configId, initialLayout }: SectionBuilderProps) {
 const [sections, setSections] = useState<StorefrontSection[]>(initialLayout?.sections || [])
 const [saving, setSaving] = useState(false)
 const [saved, setSaved] = useState(false)

 const handleSave = async () => {
 setSaving(true)
 setSaved(false)
 try {
 await updatePortalConfig(Number(configId), { layout: { sections } })
 setSaved(true)
 setTimeout(() => setSaved(false), 3000)
 } catch (err) {
 console.error('[SectionBuilder] Failed to save:', err)
 } finally {
 setSaving(false)
 }
 }

 const addSection = (type: string) => {
 const newSection: StorefrontSection = {
 type,
 id: `${type}-${Date.now()}`,
 settings: {}
 }
 setSections([...sections, newSection])
 }

 const removeSection = (id: string) => {
 setSections(sections.filter(s => s.id !== id))
 }

 const moveSection = (index: number, direction: 'up' | 'down') => {
 const newSections = [...sections]
 const targetIndex = direction === 'up' ? index - 1 : index + 1
 if (targetIndex < 0 || targetIndex >= sections.length) return

 const temp = newSections[index]
 newSections[index] = newSections[targetIndex]
 newSections[targetIndex] = temp
 setSections(newSections)
 }

 const cardStyle: React.CSSProperties = {
 background: 'var(--app-surface)',
 borderRadius: 24,
 border: '1px solid var(--app-border)',
 padding: '2rem',
 boxShadow: '0 10px 30px -10px var(--app-border)'
 }

 return (
 <div style={cardStyle} className="mt-8 animate-in slide-in-from-bottom-4 duration-700">
 <div className="flex items-center justify-between mb-8">
 <div>
 <h2 className="text-2xl font-black text-app-foreground tracking-tight flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-app-primary/5 text-app-primary flex items-center justify-center">
 <Layers size={20} />
 </div>
 Page <span className="text-app-primary">Builder</span>
 </h2>
 <p className="text-sm font-medium text-app-muted-foreground mt-1">Customize the sections and layout of your homepage.</p>
 </div>

 <button
 onClick={handleSave}
 disabled={saving}
 className={`h-12 px-6 rounded-xl font-bold text-sm flex items-center gap-2 transition-all 
 ${saved ? 'bg-app-primary text-app-foreground' : 'bg-app-surface text-app-foreground hover:bg-app-surface-2'}`}
 >
 {saving ? <div className="w-4 h-4 border-2 border-app-text/20 border-t-white rounded-full animate-spin" /> : (saved ? <Sparkles size={16} /> : <Save size={16} />)}
 {saved ? 'Changes Applied' : (saving ? 'Saving...' : 'Save Layout')}
 </button>
 </div>

 <div className="space-y-4">
 {sections.length === 0 ? (
 <div className="py-20 flex flex-col items-center justify-center bg-app-surface-2/50 rounded-[2rem] border-2 border-dashed border-app-border">
 <div className="w-16 h-16 bg-app-surface rounded-2xl shadow-sm flex items-center justify-center text-app-muted-foreground mb-4">
 <Layout size={32} />
 </div>
 <p className="text-app-muted-foreground font-bold">Your homepage is empty</p>
 <p className="text-app-muted-foreground text-xs mt-1">Start adding sections below</p>
 </div>
 ) : (
 <div className="space-y-4">
 {sections.map((section, index) => (
 <div key={section.id}
 className="group bg-app-surface border border-app-border rounded-2xl p-4 flex items-center gap-4 hover:border-app-primary/30 hover:shadow-md transition-all animate-in fade-in slide-in-from-top-2"
 >
 <div className="flex flex-col gap-1">
 <button
 onClick={() => moveSection(index, 'up')}
 disabled={index === 0}
 className="w-8 h-8 rounded-lg flex items-center justify-center text-app-muted-foreground hover:text-app-primary hover:bg-app-primary/5 disabled:opacity-0"
 >
 <ChevronUp size={16} />
 </button>
 <button
 onClick={() => moveSection(index, 'down')}
 disabled={index === sections.length - 1}
 className="w-8 h-8 rounded-lg flex items-center justify-center text-app-muted-foreground hover:text-app-primary hover:bg-app-primary/5 disabled:opacity-0"
 >
 <ChevronDown size={16} />
 </button>
 </div>

 <div className="w-12 h-12 rounded-xl bg-app-surface flex items-center justify-center text-app-foreground shrink-0">
 <Layout size={20} />
 </div>

 <div className="flex-1">
 <h4 className="font-bold text-app-foreground uppercase text-[10px] tracking-widest text-app-primary">
 Section Type
 </h4>
 <p className="font-black text-lg text-app-foreground">
 {section.type.split('_').join(' ').toUpperCase()}
 </p>
 </div>

 <button
 onClick={() => removeSection(section.id)}
 className="w-12 h-12 rounded-xl text-app-muted-foreground hover:text-app-error hover:bg-app-error-bg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
 >
 <Trash2 size={18} />
 </button>
 </div>
 ))}
 </div>
 )}
 </div>

 <div className="mt-12">
 <h3 className="text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.2em] mb-4">Add New Section</h3>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 {AVAILABLE_SECTIONS.map(item => (
 <button
 key={item.type}
 onClick={() => addSection(item.type)}
 className="p-6 bg-app-background border border-transparent rounded-[1.5rem] text-left hover:border-app-primary/30 hover:bg-app-surface hover:shadow-xl transition-all group"
 >
 <div className="w-12 h-12 rounded-xl bg-app-surface shadow-sm flex items-center justify-center text-app-muted-foreground group-hover:text-app-primary group-hover:bg-app-primary/5 mb-4 transition-all">
 <Plus size={24} />
 </div>
 <h4 className="font-black text-app-foreground text-lg uppercase tracking-tight">{item.name}</h4>
 <p className="text-xs text-app-muted-foreground font-medium mt-1 leading-relaxed">{item.description}</p>
 </button>
 ))}
 </div>
 </div>
 </div>
 )
}
