'use client'

import { useState } from 'react'
import { updatePortalConfig } from '@/app/actions/client-portal'
import {
 ShieldCheck, AlertTriangle, FastForward, Check, PackageSearch
} from 'lucide-react'

const STOCK_MODES = [
 {
 value: 'STRICT',
 label: 'Strict Guard',
 desc: 'Maximum safety. Prevents orders if items are not physically in stock. ZERO overselling.',
 icon: ShieldCheck,
 color: '#10b981',
 gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
 },
 {
 value: 'ALLOW_OVERSALE',
 label: 'Over-sale Mode',
 desc: 'Accept orders even if stock is low. Inventory goes negative, tracking what you owe.',
 icon: AlertTriangle,
 color: '#f59e0b',
 gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
 },
 {
 value: 'DISABLED',
 label: 'Flex-Order (No Check)',
 desc: 'Ignore stock levels at checkout. Perfect for back-ordering or stock not yet entered.',
 icon: FastForward,
 color: '#3b82f6',
 gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
 },
]

interface StockModePickerProps {
 configId: string
 currentMode: string
}

export default function StockModePicker({ configId, currentMode }: StockModePickerProps) {
 const [selected, setSelected] = useState(currentMode || 'STRICT')
 const [saving, setSaving] = useState(false)
 const [saved, setSaved] = useState(false)

 const handleSelect = async (modeValue: string) => {
 if (modeValue === selected) return
 setSelected(modeValue)
 setSaving(true)
 setSaved(false)

 try {
 await updatePortalConfig(Number(configId), { inventory_check_mode: modeValue })
 setSaved(true)
 setTimeout(() => setSaved(false), 3000)
 } catch (err) {
 console.error('[StockModePicker] Failed to save:', err)
 setSelected(currentMode)
 } finally {
 setSaving(false)
 }
 }

 return (
 <div style={{
 background: 'linear-gradient(135deg, #0f172a 0%, #020617 100%)',
 borderRadius: 24,
 border: '1px solid rgba(255,255,255,0.06)',
 padding: '2rem',
 position: 'relative',
 overflow: 'hidden'
 }}>
 {/* Background Glow */}
 <div style={{
 position: 'absolute', top: -100, right: -100,
 width: 300, height: 300, borderRadius: '50%',
 background: 'radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 70%)',
 pointerEvents: 'none'
 }} />

 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
 <div style={{
 width: 40, height: 40, borderRadius: 12,
 background: 'rgba(59, 130, 246, 0.1)',
 display: 'flex', alignItems: 'center', justifyContent: 'center'
 }}>
 <PackageSearch size={22} color="#3b82f6" />
 </div>
 <div>
 <h3 style={{ fontWeight: 800, fontSize: '1.25rem', color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>
 Inventory Guard
 </h3>
 <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0, fontWeight: 500 }}>
 Configure how checkout interacts with your warehouse physical stock.
 </p>
 </div>
 </div>
 {saved && (
 <span style={{
 display: 'inline-flex', alignItems: 'center', gap: 6,
 padding: '6px 16px', borderRadius: 20,
 background: 'rgba(34,197,94,0.1)', color: '#4ade80',
 fontSize: '0.75rem', fontWeight: 700,
 border: '1px solid rgba(34,197,94,0.15)',
 animation: 'in 0.3s ease-out'
 }}>
 <Check size={14} /> UPDATED
 </span>
 )}
 </div>

 <div style={{
 display: 'grid',
 gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
 gap: '1rem',
 }}>
 {STOCK_MODES.map(mode => {
 const isSelected = mode.value === selected
 const Icon = mode.icon

 return (
 <button
 key={mode.value}
 onClick={() => handleSelect(mode.value)}
 disabled={saving}
 style={{
 display: 'flex', gap: '1rem',
 padding: '1.5rem', cursor: saving ? 'wait' : 'pointer',
 borderRadius: 20, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
 border: isSelected ? `1px solid ${mode.color}` : '1px solid rgba(255,255,255,0.05)',
 background: isSelected ? `${mode.color}08` : 'rgba(255,255,255,0.02)',
 opacity: saving && !isSelected ? 0.5 : 1,
 boxShadow: isSelected ? `0 10px 40px -10px ${mode.color}20` : 'none',
 textAlign: 'left',
 position: 'relative',
 }}
 >
 {isSelected && (
 <div style={{
 position: 'absolute', top: 12, right: 12,
 width: 20, height: 20, borderRadius: '50%',
 background: mode.color, display: 'flex',
 alignItems: 'center', justifyContent: 'center',
 boxShadow: `0 0 10px ${mode.color}60`
 }}>
 <Check size={12} color="#fff" strokeWidth={3} />
 </div>
 )}

 <div style={{
 width: 48, height: 48, borderRadius: 14,
 background: mode.gradient,
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 flexShrink: 0,
 boxShadow: isSelected ? `0 8px 20px -5px ${mode.color}60` : 'none'
 }}>
 <Icon size={24} color="#fff" />
 </div>

 <div>
 <div style={{
 fontWeight: 700, fontSize: '1rem',
 color: isSelected ? '#f8fafc' : '#94a3b8',
 marginBottom: '0.25rem',
 }}>
 {mode.label}
 </div>
 <div style={{
 fontSize: '0.8rem', color: isSelected ? '#94a3b8' : '#64748b',
 lineHeight: 1.5,
 fontWeight: 400
 }}>
 {mode.desc}
 </div>
 </div>
 </button>
 )
 })}
 </div>
 </div>
 )
}
