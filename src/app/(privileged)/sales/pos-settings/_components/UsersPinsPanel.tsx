'use client'

import { useState, useEffect } from 'react'
import { Key, Shield, Lock, X, ArrowLeft, Search } from 'lucide-react'
import { erpFetch } from '@/lib/erp-api'
import { PINResetModal } from './PINResetModal'
import { UD } from '../types' // Centralized types

interface UsersPinsPanelProps {
    users: UD[];
    onRefresh: () => void;
    onClose: () => void;
    onReturn?: () => void;
}

export function UsersPinsPanel({ users, onRefresh, onClose, onReturn }: UsersPinsPanelProps) {
    const [filter, setFilter] = useState('')
    const [currentUserId, setCurrentUserId] = useState<number | null>(null)
    const [isAdmin, setIsAdmin] = useState(false)

    // PIN change modal state
    const [pinModal, setPinModal] = useState<{ userId: number; userName: string; mode: 'self' | 'admin' } | null>(null)

    // Load current user identity on mount
    useEffect(() => {
        erpFetch('auth/me/').then((me: any) => {
            if (me?.id) setCurrentUserId(me.id)
            if (me?.is_staff || me?.is_superuser) setIsAdmin(true)
        }).catch(() => { })
    }, [])

    const filtered = users.filter(u => {
        const q = filter.toLowerCase()
        return !q || u.username?.toLowerCase().includes(q) || u.first_name?.toLowerCase().includes(q) || u.last_name?.toLowerCase().includes(q)
    })

    const withPin = users.filter(u => u.pos_pin).length
    const withoutPin = users.length - withPin

    return (
        <>
            <div className="fixed inset-y-0 right-0 w-full sm:w-[440px] bg-app-bg border-l border-app-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
                    <div className="flex items-center gap-2">
                        <button onClick={onReturn || onClose} className="w-8 h-8 rounded-lg flex items-center justify-center border border-app-border hover:bg-app-surface text-app-text-muted hover:text-app-text transition-all shrink-0" title="Return">
                            <ArrowLeft size={14} />
                        </button>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--app-info) 12%, transparent)', color: 'var(--app-info)' }}>
                            <Key size={14} />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-app-text">Users & PINs</h2>
                            <p className="text-[9px] text-app-text-faint">{withPin} with PIN · {withoutPin} without</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-text-muted"><X size={14} /></button>
                </div>

                {/* Stats strip */}
                <div className="flex gap-2 px-5 py-2.5 border-b border-app-border/30">
                    <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-primary) 15%, transparent)' }}>
                        <Lock size={10} style={{ color: 'var(--app-primary)' }} />
                        <span className="text-[10px] font-black" style={{ color: 'var(--app-primary)' }}>{withPin} PIN Set</span>
                    </div>
                    <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                        style={{ background: 'color-mix(in srgb, var(--app-error) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-error) 15%, transparent)' }}>
                        <Key size={10} style={{ color: 'var(--app-error)' }} />
                        <span className="text-[10px] font-black" style={{ color: 'var(--app-error)' }}>{withoutPin} No PIN</span>
                    </div>
                </div>

                {/* Search */}
                <div className="px-5 py-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-faint" />
                        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search users…"
                            className="w-full text-[12px] pl-9 pr-3 py-2 bg-app-surface/50 border border-app-border/50 rounded-xl text-app-text placeholder:text-app-text-faint outline-none focus:border-app-primary/40 transition-all" />
                    </div>
                </div>

                {/* User list */}
                <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2 custom-scrollbar">
                    {filtered.map(u => {
                        const name = `${u.first_name} ${u.last_name}`.trim() || u.username
                        const isSelf = u.id === currentUserId
                        const canReset = isAdmin && !isSelf

                        return (
                            <div key={u.id} className="p-3 rounded-xl border transition-all"
                                style={{
                                    background: isSelf
                                        ? 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))'
                                        : 'color-mix(in srgb, var(--app-surface) 30%, transparent)',
                                    borderColor: isSelf
                                        ? 'color-mix(in srgb, var(--app-primary) 20%, transparent)'
                                        : 'color-mix(in srgb, var(--app-border) 50%, transparent)',
                                }}>
                                <div className="flex items-center gap-2">
                                    {/* Avatar */}
                                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[12px] font-black shrink-0"
                                        style={{
                                            background: isSelf
                                                ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)'
                                                : 'color-mix(in srgb, var(--app-info) 10%, transparent)',
                                            color: isSelf ? 'var(--app-primary)' : 'var(--app-info)',
                                        }}>
                                        {(u.first_name?.[0] || u.username?.[0] || '?').toUpperCase()}
                                    </div>

                                    {/* Name + role */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <p className="text-[11px] font-bold text-app-text truncate">{name}</p>
                                            {isSelf && (
                                                <span className="text-[7px] font-black px-1 py-0.5 rounded"
                                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                                    YOU
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[9px] text-app-text-faint">{u.role_name || 'Staff'}</p>
                                    </div>

                                    {/* PIN status */}
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black ${u.pos_pin ? 'text-emerald-400' : 'text-red-400'}`}
                                        style={{ background: u.pos_pin ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'color-mix(in srgb, var(--app-error) 10%, transparent)' }}>
                                        {u.pos_pin ? '● PIN SET' : '○ NO PIN'}
                                    </span>

                                    {/* Actions */}
                                    <div className="flex items-center gap-0.5 shrink-0">
                                        {/* Self: Change own PIN */}
                                        {isSelf && (
                                            <button
                                                onClick={() => setPinModal({ userId: u.id, userName: name, mode: 'self' })}
                                                className="flex items-center gap-1 text-[9px] font-bold px-2 py-1.5 rounded-lg transition-all hover:brightness-110"
                                                style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}
                                                title="Change your PIN">
                                                <Key size={10} /> Change
                                            </button>
                                        )}
                                        {/* Admin: Reset other's PIN */}
                                        {canReset && (
                                            <button
                                                onClick={() => setPinModal({ userId: u.id, userName: name, mode: 'admin' })}
                                                className="flex items-center gap-1 text-[9px] font-bold px-2 py-1.5 rounded-lg transition-all"
                                                style={{ background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)' }}
                                                title={`Reset ${name}'s PIN`}>
                                                <Shield size={10} /> Reset
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* PIN Change Modal */}
            {pinModal && (
                <PINResetModal
                    userId={pinModal.userId}
                    userName={pinModal.userName}
                    mode={pinModal.mode}
                    onClose={() => setPinModal(null)}
                    onSuccess={onRefresh}
                />
            )}
        </>
    )
}
