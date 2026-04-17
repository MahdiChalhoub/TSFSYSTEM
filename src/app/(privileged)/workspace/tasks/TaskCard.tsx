'use client';

import { Clock, Calendar, Star, User, FolderKanban } from 'lucide-react';
import type { Task } from './types';
import { STATUS_ICONS, STATUS_COLOR, PRIORITY_COLOR } from './types';

interface TaskCardProps {
    task: Task;
    onEdit: (task: Task) => void;
    onQuickComplete: (taskId: number, currentStatus: string, e: React.MouseEvent) => void;
}

export default function TaskCard({ task: t, onEdit, onQuickComplete }: TaskCardProps) {
    const StatusIcon = STATUS_ICONS[t.status] ?? Clock;
    const statusColor = STATUS_COLOR[t.status] ?? 'var(--app-muted-foreground)';
    const priorityColor = PRIORITY_COLOR[t.priority] ?? 'var(--app-muted-foreground)';
    const isCompleted = t.status === 'COMPLETED';

    return (
        <div onClick={() => onEdit(t)}
             className="group rounded-xl border p-4 transition-all duration-200 cursor-pointer"
             style={{
                 background: 'var(--app-surface)',
                 borderColor: 'var(--app-border)',
                 borderLeft: `3px solid ${statusColor}`,
                 opacity: isCompleted ? 0.6 : 1,
             }}>
            {/* Top row: Status icon + Title + Badges */}
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                         style={{ background: `color-mix(in srgb, ${statusColor} 10%, transparent)`, color: statusColor }}>
                        <StatusIcon size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className={`text-[13px] font-bold mb-0.5 ${isCompleted ? 'line-through' : ''}`}
                            style={{ color: isCompleted ? 'var(--app-muted-foreground)' : 'var(--app-foreground)' }}>
                            {t.title}
                        </h3>
                        {t.description && (
                            <p className="text-[11px] font-medium line-clamp-2" style={{ color: 'var(--app-muted-foreground)' }}>
                                {t.description}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                          style={{
                              background: `color-mix(in srgb, ${priorityColor} 10%, transparent)`,
                              color: priorityColor,
                              border: `1px solid color-mix(in srgb, ${priorityColor} 25%, transparent)`,
                          }}>
                        {t.priority?.toLowerCase()}
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                          style={{
                              background: `color-mix(in srgb, ${statusColor} 10%, transparent)`,
                              color: statusColor,
                              border: `1px solid color-mix(in srgb, ${statusColor} 25%, transparent)`,
                          }}>
                        {t.status?.toLowerCase().replace('_', ' ')}
                    </span>
                </div>
            </div>

            {/* Bottom row: Metadata + Toggle */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-[11px] font-medium" style={{ color: 'var(--app-muted-foreground)' }}>
                    {t.category_name && (
                        <span className="flex items-center gap-1">
                            <FolderKanban size={10} /> {t.category_name}
                        </span>
                    )}
                    {t.due_date && (
                        <span className="flex items-center gap-1"
                              style={t.is_overdue ? { color: 'var(--app-error)', fontWeight: 700 } : undefined}>
                            <Calendar size={10} /> Due {new Date(t.due_date).toLocaleDateString()}
                        </span>
                    )}
                    {t.assigned_to_name && (
                        <span className="flex items-center gap-1">
                            <User size={10} /> {t.assigned_to_name}
                        </span>
                    )}
                    {t.points > 0 && (
                        <span className="flex items-center gap-0.5" style={{ color: 'var(--app-warning, #f59e0b)' }}>
                            <Star size={10} /> {t.points}
                        </span>
                    )}
                </div>

                {/* Toggle switch */}
                <button onClick={e => onQuickComplete(t.id, t.status, e)}
                        className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out"
                        style={{
                            background: isCompleted ? 'var(--app-success, #22c55e)' : 'color-mix(in srgb, var(--app-muted-foreground) 25%, transparent)',
                            border: '2px solid transparent',
                        }}
                        title={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}>
                    <span className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out"
                          style={{ transform: isCompleted ? 'translateX(16px)' : 'translateX(0)' }} />
                </button>
            </div>
        </div>
    );
}
