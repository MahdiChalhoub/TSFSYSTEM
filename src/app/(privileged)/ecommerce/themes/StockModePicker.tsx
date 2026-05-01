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
 color: 'var(--app-success)',
 gradient: 'linear-gradient(135deg, var(--app-primary) 0%, #059669 100%)',
 },
 {
 value: 'ALLOW_OVERSALE',
 label: 'Over-sale Mode',
 desc: 'Accept orders even if stock is low. Inventory goes negative, tracking what you owe.',
 icon: AlertTriangle,
 color: 'var(--app-warning)',
 gradient: 'linear-gradient(135deg, var(--app-warning) 0%, #d97706 100%)',
 },
 {
 value: 'DISABLED',
 label: 'Flex-Order (No Check)',
 desc: 'Ignore stock levels at checkout. Perfect for back-ordering or stock not yet entered.',
 icon: FastForward,
 color: 'var(--app-info)',
 gradient: 'linear-gradient(135deg, var(--app-info) 0%, #2563eb 100%)',
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
 background: 'linear-gradient(135deg, var(--app-bg) 0%, var(--app-bg) 100%)',
 borderRadius: 24,
 border: '1px solid var(--app-surface)',
 padding: '2rem',
 position: 'relative',
 overflow: 'hidden'
 }}>
 {/* Background Glow */}
 <div style={{
 position: 'absolute', top: -100, right: -100,
 width: 300, height: 300, borderRadius: '50%',
 background: 'radial-gradient(circle, color-mix(in srgb, var(--app-primary) 8%, transparent) 0%, transparent 70%)',
 pointerEvents: 'none'
 }} />

 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
 <div style={{
 width: 40, height: 40, borderRadius: 12,
 background: 'var(--app-info)',
 display: 'flex', alignItems: 'center', justifyContent: 'center'
 }}>
 <PackageSearch size={22} color="var(--app-info)" />
 </div>
 <div>
 <h3 style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--app-foreground)', margin: 0, letterSpacing: '-0.02em' }}>
 Inventory Guard
 </h3>
 <p style={{ color: 'var(--app-muted-foreground)', fontSize: '0.85rem', margin: 0, fontWeight: 500 }}>
 Configure how checkout interacts with your warehouse physical stock.
 </p>
 </div>
 </div>
 {saved && (
 <span style={{
 display: 'inline-flex', alignItems: 'center', gap: 6,
 padding: '6px 16px', borderRadius: 20,
 background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)',
 fontSize: '0.75rem', fontWeight: 700,
 border: '1px solid color-mix(in srgb, var(--app-success) 15%, transparent)',
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
 border: isSelected ? `1px solid ${mode.color}` : '1px solid var(--app-surface)',
 background: isSelected ? `${mode.color}08` : 'var(--app-surface)',
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
 color: isSelected ? 'var(--app-foreground)' : 'var(--app-muted-foreground)',
 marginBottom: '0.25rem',
 }}>
 {mode.label}
 </div>
 <div style={{
 fontSize: '0.8rem', color: isSelected ? 'var(--app-muted-foreground)' : 'var(--app-muted-foreground)',
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
