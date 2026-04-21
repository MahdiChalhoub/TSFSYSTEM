'use client';

import Link from 'next/link';
import { Clock, Calendar, Star, User, FolderKanban, ExternalLink, Check } from 'lucide-react';
import type { Task, UserItem } from './types';
import { STATUS_ICONS, STATUS_COLOR, PRIORITY_COLOR, getUserName, resolveTaskSourceLink } from './types';

interface TaskCardProps {
    task: Task;
    users: UserItem[];
    compact?: boolean;
    onEdit: (task: Task) => void;
    onQuickComplete: (taskId: number, currentStatus: string, e: React.MouseEvent) => void;
}

/** Smart relative date formatting */
function formatDueDate(dateStr: string): string {
    const due = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const diffMs = dueDay.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < -1) return `Overdue by ${Math.abs(diffDays)} days`;
    if (diffDays === -1) return 'Overdue by 1 day';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 7) return `In ${diffDays} days`;
    return due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: due.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

export default function TaskCard({ task: t, users, compact = false, onEdit, onQuickComplete }: TaskCardProps) {
    const StatusIcon = STATUS_ICONS[t.status] ?? Clock;
    const statusColor = STATUS_COLOR[t.status] ?? 'var(--app-muted-foreground)';
    const priorityColor = PRIORITY_COLOR[t.priority] ?? 'var(--app-muted-foreground)';
    const isCompleted = t.status === 'COMPLETED';
    const sourceLink = resolveTaskSourceLink(t);

    // Resolve assigned user from users array
    const assignedUser = t.assigned_to ? users.find(u => u.id === t.assigned_to) : null;
    const assignedName = assignedUser ? getUserName(assignedUser) : t.assigned_to_name;

    if (compact) {
        return (
            <div onClick={() => onEdit(t)}
                 className="group flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-150 cursor-pointer hover:bg-app-surface/70"
                 style={{
                     background: 'var(--app-surface)',
                     borderColor: 'var(--app-border)',
                     borderLeft: `3px solid ${statusColor}`,
                     opacity: isCompleted ? 0.55 : 1,
                 }}>
                <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                     style={{ background: `color-mix(in srgb, ${statusColor} 10%, transparent)`, color: statusColor }}>
                    <StatusIcon size={11} />
                </div>
                <span className={`text-[12px] font-bold truncate flex-1 min-w-0 ${isCompleted ? 'line-through' : ''}`}
                      style={{ color: isCompleted ? 'var(--app-muted-foreground)' : 'var(--app-foreground)' }}>
                    {t.title}
                </span>
                {t.category_name && (
                    <span className="hidden md:inline text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)', color: 'var(--app-muted-foreground)' }}>
                        {t.category_name}
                    </span>
                )}
                <span className="hidden lg:inline text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{
                          background: `color-mix(in srgb, ${priorityColor} 10%, transparent)`,
                          color: priorityColor,
                          border: `1px solid color-mix(in srgb, ${priorityColor} 25%, transparent)`,
                      }}>
                    {t.priority?.toLowerCase()}
                </span>
                {t.due_date && (
                    <span className="hidden md:inline text-[10px] font-bold flex-shrink-0"
                          style={t.is_overdue ? { color: 'var(--app-error)' } : { color: 'var(--app-muted-foreground)' }}>
                        {formatDueDate(t.due_date)}
                    </span>
                )}
                {assignedName && (
                    <span className="hidden lg:flex items-center gap-0.5 text-[10px] font-bold truncate flex-shrink-0 max-w-[120px]"
                          style={{ color: 'var(--app-muted-foreground)' }}>
                        <User size={10} /> {assignedName}
                    </span>
                )}
                {sourceLink && (
                    <Link href={sourceLink.href}
                          onClick={e => e.stopPropagation()}
                          title={t.related_object_label ? `${sourceLink.label} — ${t.related_object_label}` : sourceLink.label}
                          className="flex items-center p-1 rounded-lg transition-all flex-shrink-0"
                          style={{
                              background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)',
                              color: 'var(--app-primary)',
                          }}>
                        <ExternalLink size={11} />
                    </Link>
                )}
                <button onClick={e => onQuickComplete(t.id, t.status, e)}
                        title={isCompleted ? 'Reopen' : 'Mark done'}
                        className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200"
                        style={{
                            background: isCompleted ? 'var(--app-success, #22c55e)' : 'color-mix(in srgb, var(--app-muted-foreground) 30%, transparent)',
                        }}>
                    <span className="pointer-events-none inline-flex items-center justify-center h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
                          style={{ transform: isCompleted ? 'translateX(18px)' : 'translateX(2px)', marginTop: '2px' }}>
                        {isCompleted ? <Check size={8} style={{ color: 'var(--app-success, #22c55e)' }} /> : null}
                    </span>
                </button>
            </div>
        );
    }

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
                            <Calendar size={10} /> {formatDueDate(t.due_date)}
                        </span>
                    )}
                    {assignedName && (
                        <span className="flex items-center gap-1">
                            <User size={10} /> {assignedName}
                        </span>
                    )}
                    {t.points > 0 && (
                        <span className="flex items-center gap-0.5" style={{ color: 'var(--app-warning, #f59e0b)' }}>
                            <Star size={10} /> {t.points}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {sourceLink && (
                        <Link href={sourceLink.href}
                              onClick={e => e.stopPropagation()}
                              title={t.related_object_label ? `${sourceLink.label} — ${t.related_object_label}` : sourceLink.label}
                              className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                              style={{
                                  background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)',
                                  color: 'var(--app-primary)',
                                  border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                              }}>
                            <ExternalLink size={10} />
                            <span className="hidden sm:inline">{sourceLink.label.replace(/^Open /, '')}</span>
                        </Link>
                    )}
                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        <span className="text-[10px] font-bold hidden sm:inline"
                              style={{ color: isCompleted ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)' }}>
                            {isCompleted ? 'Done' : 'Open'}
                        </span>
                        <button onClick={e => onQuickComplete(t.id, t.status, e)}
                                title={isCompleted ? 'Reopen this task' : 'Mark this task as done'}
                                className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200"
                                style={{
                                    background: isCompleted ? 'var(--app-success, #22c55e)' : 'color-mix(in srgb, var(--app-muted-foreground) 30%, transparent)',
                                    boxShadow: isCompleted ? '0 2px 6px color-mix(in srgb, var(--app-success, #22c55e) 30%, transparent)' : 'none',
                                }}>
                            <span className="pointer-events-none inline-flex items-center justify-center h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
                                  style={{ transform: isCompleted ? 'translateX(22px)' : 'translateX(2px)', marginTop: '2px' }}>
                                {isCompleted ? <Check size={10} style={{ color: 'var(--app-success, #22c55e)' }} /> : null}
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
