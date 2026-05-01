'use client'

/**
 * Task Reminder Popup
 * =====================
 * Global floating reminder for the current user. Polls
 * /api/tasks/my-reminders/ every minute; when something comes back that
 * hasn't been dismissed yet (tracked via localStorage), a stack of cards
 * appears in the bottom-right so the user sees it regardless of which
 * page they are on.
 *
 * Each card supports:
 *   • "Open"    — deep-links to the related source object (if any)
 *                   or opens /workspace/tasks filtered to this task
 *   • "Snooze"  — dismisses locally for 10 minutes
 *   • "Dismiss" — dismisses permanently on this browser
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Bell, X, Clock, ExternalLink } from 'lucide-react'
import { erpFetch } from '@/lib/erp-api'
import { resolveTaskSourceLink } from '@/app/(privileged)/workspace/tasks/types'
import type { Task } from '@/app/(privileged)/workspace/tasks/types'

type Reminder = Pick<Task,
    'id' | 'title' | 'priority' | 'due_date' | 'related_object_type' | 'related_object_id' | 'related_object_label' | 'category_name' | 'source'
> & { reminder_at?: string | null; remind_until_done?: boolean; remind_interval_min?: number }

const DISMISSED_KEY = 'tsf_dismissed_reminders_v1'
const SNOOZE_KEY = 'tsf_snoozed_reminders_v1'
const POLL_MS = 60_000

function formatInterval(min: number): string {
    if (min < 60) return `${min} min`
    if (min < 1440) return `${Math.round(min / 60)} hr`
    return `${Math.round(min / 1440)} d`
}

function readDismissed(): Record<string, number> {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '{}') } catch { return {} }
}
function writeDismissed(map: Record<string, number>) {
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(map)) } catch {}
}
function readSnoozed(): Record<string, number> {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(localStorage.getItem(SNOOZE_KEY) || '{}') } catch { return {} }
}
function writeSnoozed(map: Record<string, number>) {
    try { localStorage.setItem(SNOOZE_KEY, JSON.stringify(map)) } catch {}
}

export function TaskReminderPopup() {
    const [reminders, setReminders] = useState<Reminder[]>([])
    const [testReminders, setTestReminders] = useState<Reminder[]>([])
    const [dismissed, setDismissed] = useState<Record<string, number>>(() => readDismissed())
    const [snoozed, setSnoozed] = useState<Record<string, number>>(() => readSnoozed())

    const fetchReminders = useCallback(async () => {
        try {
            const res = await erpFetch('tasks/my-reminders/') as { results?: Reminder[] } | Reminder[] | null
            const list: Reminder[] = (Array.isArray(res) ? res : res?.results) ?? []
            setReminders(Array.isArray(list) ? list : [])
        } catch { /* ignore — layout catch-all handles auth */ }
    }, [])

    useEffect(() => {
        fetchReminders()
        const t = setInterval(fetchReminders, POLL_MS)
        // Test hook: any page can dispatch this custom event to inject a
        // synthetic reminder and validate the popup UI without creating DB rows.
        const onTest = (ev: Event) => {
            const detail = (ev as CustomEvent).detail as Partial<Reminder> | undefined
            const id = -Date.now() // negative ids so they never collide with DB rows
            const fake: Reminder = {
                id,
                title: detail?.title || '🧪 Test reminder — this is a simulated reminder',
                priority: detail?.priority ?? 'URGENT',
                due_date: detail?.due_date ?? undefined,
                related_object_type: detail?.related_object_type ?? undefined,
                related_object_id: detail?.related_object_id ?? undefined,
                related_object_label: detail?.related_object_label || 'Triggered from the Test Reminder button',
                category_name: detail?.category_name || 'Test',
                source: detail?.source ?? 'MANUAL',
                reminder_at: new Date().toISOString(),
            }
            setTestReminders(prev => [fake, ...prev])
        }
        window.addEventListener('tsf:test-reminder', onTest as EventListener)
        return () => {
            clearInterval(t)
            window.removeEventListener('tsf:test-reminder', onTest as EventListener)
        }
    }, [fetchReminders])

    const now = Date.now()
    // Reminder fields come straight from the server. Sticky tasks ignore
    // local "permanent dismiss"; only snooze windows hide them.
    const combined = [...testReminders, ...reminders]
    const visible = combined.filter(r => {
        if (!r.remind_until_done) {
            const d = dismissed[String(r.id)]
            if (d) return false
        }
        const s = snoozed[String(r.id)]
        if (s && s > now) return false
        return true
    })

    if (visible.length === 0) return null

    const dismiss = (id: number) => {
        const next = { ...dismissed, [String(id)]: Date.now() }
        setDismissed(next); writeDismissed(next)
    }
    const snooze = (id: number, minutes = 10) => {
        const next = { ...snoozed, [String(id)]: Date.now() + minutes * 60_000 }
        setSnoozed(next); writeSnoozed(next)
    }

    return (
        <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 max-w-[340px] w-[92vw]">
            {visible.slice(0, 4).map(r => {
                const link = resolveTaskSourceLink(r as unknown as Task)
                const pColor = r.priority === 'URGENT' ? 'var(--app-error, #ef4444)'
                    : r.priority === 'HIGH' ? 'var(--app-warning, #f59e0b)'
                    : 'var(--app-primary)'
                return (
                    <div key={r.id}
                         className="rounded-2xl overflow-hidden animate-in slide-in-from-right duration-300"
                         style={{ background: 'var(--app-surface)', border: `1px solid ${pColor}`, boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
                        <div className="flex items-center gap-2 px-3 py-2"
                             style={{ background: `color-mix(in srgb, ${pColor} 8%, transparent)` }}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                 style={{ background: pColor, color: 'white' }}>
                                <Bell size={13} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: pColor }}>
                                    Reminder · {r.priority?.toLowerCase()}
                                </div>
                                {r.category_name && (
                                    <div className="text-[9px] font-bold truncate" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {r.category_name}
                                    </div>
                                )}
                            </div>
                            {r.remind_until_done ? (
                                <button onClick={() => snooze(r.id, r.remind_interval_min || 10)}
                                        title={`Snooze ${r.remind_interval_min || 10} min — reminder keeps returning until the task is done`}
                                        className="p-1 rounded-lg hover:bg-app-border/50 transition-all"
                                        style={{ color: pColor }}>
                                    <Clock size={13} />
                                </button>
                            ) : (
                                <button onClick={() => dismiss(r.id)} title="Dismiss"
                                        className="p-1 rounded-lg hover:bg-app-border/50 transition-all"
                                        style={{ color: 'var(--app-muted-foreground)' }}>
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                        <div className="px-3 py-2.5">
                            <div className="text-[12px] font-bold mb-1 break-words" style={{ color: 'var(--app-foreground)' }}>
                                {r.title}
                            </div>
                            {r.related_object_label && (
                                <div className="text-[10px] font-medium mb-2" style={{ color: 'var(--app-muted-foreground)' }}>
                                    {r.related_object_label}
                                </div>
                            )}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {link && (
                                    <Link href={link.href} onClick={() => snooze(r.id, r.remind_interval_min || 10)}
                                          className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                                          style={{ background: pColor, color: 'white' }}>
                                        <ExternalLink size={10} /> {link.label.replace(/^Open /, '')}
                                    </Link>
                                )}
                                <Link href={`/workspace/tasks?focus=${r.id}`} onClick={() => snooze(r.id, r.remind_interval_min || 10)}
                                      className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                                      style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)', border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                    Open task
                                </Link>
                                <button onClick={() => snooze(r.id, r.remind_interval_min || 10)}
                                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                                        style={{ background: 'transparent', color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                                    <Clock size={10} /> {formatInterval(r.remind_interval_min || 10)}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })}
            {visible.length > 4 && (
                <div className="text-[10px] font-bold text-center px-3 py-1.5 rounded-xl"
                     style={{ background: 'var(--app-surface)', color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                    + {visible.length - 4} more reminders
                </div>
            )}
        </div>
    )
}
