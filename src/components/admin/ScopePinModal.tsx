'use client'
import { useState } from 'react'
import { Lock, X, ShieldCheck, ShieldAlert, Eye, Layers } from 'lucide-react'
type ScopeAccess = 'official' | 'internal'
interface ScopePinModalProps {
 /** Which scope password the user is entering */
 targetAccess: ScopeAccess
 onVerified: (access: ScopeAccess) => void
 onCancel: () => void
}
/**
 * ScopePinModal — Access control for dual-view scopes.
 *
 * Two access modes:
 * - "official" password → user sees ONLY Official data. No toggle. Internal is invisible.
 * - "internal" password → user sees BOTH scopes with toggle (Full Access).
 */
export default function ScopePinModal({ targetAccess, onVerified, onCancel }: ScopePinModalProps) {
 const [pin, setPin] = useState('')
 const [error, setError] = useState('')
 const [loading, setLoading] = useState(false)
 const isOfficial = targetAccess === 'official'
 const label = isOfficial ? 'Official (Viewer)' : 'Internal (Full Access)'
 const handleVerify = async () => {
 if (pin.length < 4) {
 setError('PIN must be at least 4 characters')
 return
 }
 setLoading(true)
 setError('')
 try {
 const res = await fetch('http://backend:8000/api/users/verify-scope-pin/', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Token ${document.cookie.match(/auth_token=([^;]+)/)?.[1] || ''}`,
 },
 body: JSON.stringify({ scope: targetAccess, pin }),
 })
 const data = await res.json()
 if (data.verified) {
 onVerified(targetAccess)
 } else {
 setError('Incorrect PIN. Access denied.')
 setPin('')
 }
 } catch {
 setError('Failed to verify PIN. Try again.')
 } finally {
 setLoading(false)
 }
 }
 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === 'Enter') handleVerify()
 if (e.key === 'Escape') onCancel()
 }
 return (
 <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
 onClick={onCancel}
 >
 <div
 className="bg-app-surface rounded-xl shadow-2xl w-[380px] overflow-hidden"
 onClick={e => e.stopPropagation()}
 >
 {/* Header */}
 <div className="px-6 py-4 border-b flex items-center justify-between"
 style={{
 backgroundColor: isOfficial ? '#ecfdf5' : '#f0f9ff',
 borderBottomColor: isOfficial ? '#a7f3d0' : '#bae6fd',
 }}
 >
 <div className="flex items-center gap-2">
 {isOfficial ? (
 <Eye size={16} className="text-emerald-600" />
 ) : (
 <Layers size={16} className="text-sky-600" />
 )}
 <h3 className="text-sm font-bold text-app-text">{label}</h3>
 </div>
 <button onClick={onCancel} className="text-app-text-faint hover:text-app-text-muted p-1">
 <X size={14} />
 </button>
 </div>
 {/* Body */}
 <div className="px-6 py-5 space-y-4">
 <p className="text-sm text-app-text-muted">
 {isOfficial
 ? 'Enter your Viewer Password to access Official (declared) data only.'
 : 'Enter your Full Access Password to access both Official and Internal scopes.'
 }
 </p>
 <input
 type="password"
 value={pin}
 onChange={e => { setPin(e.target.value); setError('') }}
 onKeyDown={handleKeyDown}
 placeholder="Enter password"
 autoFocus
 className="w-full px-4 py-3 text-center text-lg tracking-[0.3em] font-mono
 border-2 border-app-border rounded-lg
 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200
 placeholder:tracking-normal placeholder:text-sm placeholder:font-sans"
 />
 {/* Error */}
 {error && (
 <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">
 <ShieldAlert size={14} />
 {error}
 </div>
 )}
 {/* Info */}
 <div className="text-[11px] text-app-text-faint bg-app-bg px-3 py-2 rounded-lg">
 {isOfficial
 ? '🔒 Official mode: You will only see declared/posted data. Internal data will be hidden.'
 : '🔓 Full Access mode: You can toggle between Official and Internal views.'
 }
 </div>
 {/* Actions */}
 <div className="flex gap-2">
 <button
 onClick={onCancel}
 className="flex-1 px-4 py-2.5 text-sm font-medium text-app-text-muted bg-app-surface-2 rounded-lg hover:bg-stone-200 transition-colors"
 >
 Cancel
 </button>
 <button
 onClick={handleVerify}
 disabled={loading || pin.length < 4}
 className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-app-text rounded-lg transition-colors disabled:opacity-50"
 style={{
 backgroundColor: isOfficial ? '#059669' : '#0284c7',
 }}
 >
 <ShieldCheck size={14} />
 {loading ? 'Verifying...' : 'Unlock'}
 </button>
 </div>
 </div>
 </div>
 </div>
 )
}
