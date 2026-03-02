'use client'

import { useState } from 'react'
import { updatePortalConfig } from '@/app/actions/client-portal'
import {
 ShoppingBag, BookOpen, CreditCard, Globe, Briefcase, Check
} from 'lucide-react'

const STORE_TYPES = [
 {
 value: 'PRODUCT_STORE',
 label: 'Product Store',
 desc: 'Full e-commerce with product grid, cart, and checkout. Like Shopify.',
 icon: ShoppingBag,
 color: '#10b981',
 gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
 },
 {
 value: 'CATALOGUE',
 label: 'Catalogue',
 desc: 'Browse products without prices. Customers request quotes.',
 icon: BookOpen,
 color: '#3b82f6',
 gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
 },
 {
 value: 'SUBSCRIPTION',
 label: 'Subscription Store',
 desc: 'Recurring plans and pricing tiers. SaaS-style checkout.',
 icon: CreditCard,
 color: '#8b5cf6',
 gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
 },
 {
 value: 'LANDING_PAGE',
 label: 'Landing Page',
 desc: 'Company website with hero section, services, and contact form.',
 icon: Globe,
 color: '#f59e0b',
 gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
 },
 {
 value: 'PORTFOLIO',
 label: 'Portfolio',
 desc: 'Showcase projects, case studies, and creative work.',
 icon: Briefcase,
 color: '#ec4899',
 gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
 },
]

interface StoreTypePickerProps {
 configId: string
 currentType: string
}

export default function StoreTypePicker({ configId, currentType }: StoreTypePickerProps) {
 const [selected, setSelected] = useState(currentType || 'PRODUCT_STORE')
 const [saving, setSaving] = useState(false)
 const [saved, setSaved] = useState(false)

 const handleSelect = async (typeValue: string) => {
 if (typeValue === selected) return
 setSelected(typeValue)
 setSaving(true)
 setSaved(false)

 try {
 await updatePortalConfig(Number(configId), { storefront_type: typeValue })
 setSaved(true)
 setTimeout(() => setSaved(false), 3000)
 } catch (err) {
 console.error('[StoreTypePicker] Failed to save:', err)
 setSelected(currentType)
 } finally {
 setSaving(false)
 }
 }

 return (
 <div style={{
 background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
 borderRadius: 12,
 border: '1px solid rgba(255,255,255,0.06)',
 padding: '1.25rem',
 }}>
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
 <ShoppingBag size={18} color="#10b981" />
 <h3 style={{ fontWeight: 700, fontSize: '1.1rem', color: '#f1f5f9', margin: 0 }}>
 🏪 Store Type
 </h3>
 </div>
 {saved && (
 <span style={{
 display: 'inline-flex', alignItems: 'center', gap: 4,
 padding: '4px 12px', borderRadius: 20,
 background: 'rgba(34,197,94,0.15)', color: '#22c55e',
 fontSize: '0.75rem', fontWeight: 600,
 }}>
 <Check size={12} /> Saved
 </span>
 )}
 </div>

 <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
 Select the type of storefront that matches your business. This changes the layout and behavior of your customer-facing store.
 </p>

 <div style={{
 display: 'grid',
 gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
 gap: '0.75rem',
 }}>
 {STORE_TYPES.map(type => {
 const isSelected = type.value === selected
 const Icon = type.icon

 return (
 <button
 key={type.value}
 onClick={() => handleSelect(type.value)}
 disabled={saving}
 style={{
 display: 'flex', flexDirection: 'column',
 padding: '1.25rem', cursor: saving ? 'wait' : 'pointer',
 borderRadius: 12, overflow: 'hidden', transition: 'all 0.2s',
 border: isSelected ? `2px solid ${type.color}` : '2px solid rgba(255,255,255,0.08)',
 background: isSelected ? `${type.color}12` : '#0f172a',
 opacity: saving && !isSelected ? 0.5 : 1,
 boxShadow: isSelected ? `0 0 20px ${type.color}25` : 'none',
 textAlign: 'left',
 position: 'relative',
 }}
 >
 {isSelected && (
 <div style={{
 position: 'absolute', top: 8, right: 8,
 width: 20, height: 20, borderRadius: '50%',
 background: type.color, display: 'flex',
 alignItems: 'center', justifyContent: 'center',
 }}>
 <Check size={12} color="#fff" />
 </div>
 )}

 <div style={{
 width: 40, height: 40, borderRadius: 10,
 background: type.gradient,
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 marginBottom: '0.75rem',
 }}>
 <Icon size={20} color="#fff" />
 </div>

 <span style={{
 fontWeight: 700, fontSize: '0.9rem',
 color: isSelected ? '#e2e8f0' : '#94a3b8',
 marginBottom: '0.25rem',
 }}>
 {type.label}
 </span>
 <span style={{
 fontSize: '0.72rem', color: '#64748b',
 lineHeight: 1.4,
 display: '-webkit-box', WebkitLineClamp: 3,
 WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
 }}>
 {type.desc}
 </span>
 </button>
 )
 })}
 </div>
 </div>
 )
}
