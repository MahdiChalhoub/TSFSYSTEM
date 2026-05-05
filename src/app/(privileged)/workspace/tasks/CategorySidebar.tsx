'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, GripVertical, User, FolderKanban, Edit2, X, Crown, Check, Loader2 } from 'lucide-react';
import { erpFetch } from '@/lib/erp-api';
import { toast } from 'sonner';
import type { Task, Category, UserItem, CategorySelection } from './types';
import { getUserName } from './types';

interface CategorySidebarProps {
    tasks: Task[];
    categories: Category[];
    users: UserItem[];
    selectedCategoryId: CategorySelection;
    selectedUserId: number | null;
    expandedCategories: Set<number>;
    onSelectCategory: (catId: CategorySelection) => void;
    onSelectUser: (catId: number, userId: number) => void;
    onToggleExpanded: (catId: number) => void;
    onManageCategories: () => void;
    onLeaderChanged?: (catId: number, leaderId: number | null, leaderName: string | null) => void;
    onCloseMobile?: () => void;
}

export default function CategorySidebar({
    tasks,
    categories,
    users,
    selectedCategoryId,
    selectedUserId,
    expandedCategories,
    onSelectCategory,
    onSelectUser,
    onToggleExpanded,
    onManageCategories,
    onLeaderChanged,
    onCloseMobile,
}: CategorySidebarProps) {
    const [editingLeaderCatId, setEditingLeaderCatId] = useState<number | null>(null);
    const [savingLeaderCatId, setSavingLeaderCatId] = useState<number | null>(null);

    const saveLeader = async (cat: Category, leaderId: number | null) => {
        setSavingLeaderCatId(cat.id);
        try {
            const updated: any = await erpFetch(`task-categories/${cat.id}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leader: leaderId }),
            });
            toast.success(leaderId ? 'Leader updated' : 'Leader cleared');
            if (onLeaderChanged) {
                onLeaderChanged(cat.id, leaderId, updated?.leader_name ?? null);
            }
            setEditingLeaderCatId(null);
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to update leader');
        } finally {
            setSavingLeaderCatId(null);
        }
    };

    const getTaskCountForCategory = (catId: number | null) =>
        catId === null
            ? tasks.filter(t => !t.category).length
            : tasks.filter(t => t.category === catId).length;

    const getTaskCountForUser = (catId: number, userId: number) =>
        tasks.filter(t => t.category === catId && t.assigned_to === userId).length;

    /** Get unique users who have tasks assigned TO them in this category */
    const getUsersForCategory = (catId: number): UserItem[] => {
        const userIds = new Set(
            tasks.filter(t => t.category === catId && t.assigned_to).map(t => t.assigned_to as number)
        );
        return users.filter(u => userIds.has(u.id));
    };

    /** Get the persisted leader for a category (if any), from the category record. */
    const getLeaderForCategory = (cat: Category): UserItem | null => {
        if (!cat.leader) return null;
        return users.find(u => u.id === cat.leader) || null;
    };

    const countBadge = (count: number) => (
        <span className="text-tp-xs font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)', color: 'var(--app-muted-foreground)' }}>
            {count}
        </span>
    );

    const activeStyle = (isActive: boolean) => ({
        borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)',
        background: isActive ? 'color-mix(in srgb, var(--app-primary) 8%, transparent)' : 'transparent',
        borderLeft: isActive ? '3px solid var(--app-primary)' : '3px solid transparent',
    });

    return (
        <div className="rounded-2xl border overflow-hidden"
             style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
            {/* Header */}
            <div className="px-4 py-3 border-b flex items-center justify-between"
                 style={{ background: 'color-mix(in srgb, var(--app-primary) 5%, var(--app-surface))', borderColor: 'color-mix(in srgb, var(--app-primary) 15%, transparent)' }}>
                <h3 className="text-tp-md flex items-center gap-2" style={{ color: 'var(--app-foreground)' }}>
                    <FolderKanban size={15} style={{ color: 'var(--app-primary)' }} />
                    Categories
                </h3>
                <div className="flex items-center gap-1">
                    <button onClick={onManageCategories}
                            className="p-1 rounded-lg transition-colors hover:opacity-70" style={{ color: 'var(--app-primary)' }}>
                        <Edit2 size={12} />
                    </button>
                    {onCloseMobile && (
                        <button onClick={onCloseMobile}
                                className="lg:hidden p-1 rounded-lg transition-colors hover:opacity-70" style={{ color: 'var(--app-muted-foreground)' }}>
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            <div className="max-h-[calc(100vh-14rem)] overflow-y-auto custom-scrollbar">
                {/* All Tasks */}
                <button onClick={() => onSelectCategory('all')}
                        className="w-full px-4 py-2.5 flex items-center justify-between transition-colors border-b text-left"
                        style={activeStyle(selectedCategoryId === 'all' && !selectedUserId)}>
                    <span className="text-tp-md font-bold" style={{ color: 'var(--app-foreground)' }}>All Tasks</span>
                    {countBadge(tasks.length)}
                </button>

                {/* Uncategorized */}
                {getTaskCountForCategory(null) > 0 && (
                    <button onClick={() => onSelectCategory(null)}
                            className="w-full px-4 py-2.5 flex items-center justify-between transition-colors border-b text-left"
                            style={activeStyle(selectedCategoryId === null && !selectedUserId)}>
                        <span className="text-tp-md font-bold" style={{ color: 'var(--app-muted-foreground)' }}>Uncategorized</span>
                        {countBadge(getTaskCountForCategory(null))}
                    </button>
                )}

                {/* Category items */}
                {categories.map(cat => {
                    const catUsers = getUsersForCategory(cat.id);
                    const catLeader = getLeaderForCategory(cat);
                    const isExpanded = expandedCategories.has(cat.id);
                    const hasUsers = catUsers.length > 0;
                    const isSelected = selectedCategoryId === cat.id && !selectedUserId;
                    const isEditingLeader = editingLeaderCatId === cat.id;
                    const isSavingLeader = savingLeaderCatId === cat.id;

                    return (
                        <div key={cat.id} className="border-b" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                            {/* Category row */}
                            <div className="flex items-center" style={activeStyle(isSelected)}>
                                {hasUsers && (
                                    <button onClick={() => onToggleExpanded(cat.id)}
                                            className="px-1.5 py-2.5 transition-colors hover:opacity-70" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                    </button>
                                )}
                                <button onClick={() => onSelectCategory(cat.id)}
                                        className={`flex-1 py-2.5 flex items-center justify-between transition-colors text-left ${hasUsers ? 'pl-0' : 'pl-3'} pr-3`}>
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <GripVertical size={12} className="flex-shrink-0 cursor-grab active:cursor-grabbing"
                                                      style={{ color: 'var(--app-muted-foreground)', opacity: 0.5 }} />
                                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color || 'var(--app-primary)' }} />
                                        <div className="flex-1 min-w-0">
                                            <span className="text-tp-md font-bold truncate block" style={{ color: 'var(--app-foreground)' }}>{cat.name}</span>
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <Crown size={9} className="flex-shrink-0" style={{ color: 'var(--app-warning, #f59e0b)' }} />
                                                <span className="text-tp-xxs font-bold truncate" style={{ color: catLeader ? 'var(--app-muted-foreground)' : 'color-mix(in srgb, var(--app-muted-foreground) 60%, transparent)' }}>
                                                    {catLeader ? getUserName(catLeader) : (cat.leader_name || 'No leader')}
                                                </span>
                                                <span onClick={e => { e.stopPropagation(); setEditingLeaderCatId(isEditingLeader ? null : cat.id); }}
                                                    title="Set leader"
                                                    className="ml-0.5 p-0.5 rounded transition-all hover:opacity-70"
                                                    style={{ color: 'var(--app-primary)', cursor: 'pointer' }}>
                                                    <Edit2 size={9} />
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    {countBadge(getTaskCountForCategory(cat.id))}
                                </button>
                            </div>

                            {/* Leader picker */}
                            {isEditingLeader && (
                                <div className="pl-10 pr-3 py-2 flex items-center gap-1.5"
                                    style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 4%, transparent)' }}
                                    onClick={e => e.stopPropagation()}>
                                    <Crown size={11} style={{ color: 'var(--app-warning, #f59e0b)' }} />
                                    <select
                                        value={cat.leader ?? ''}
                                        disabled={isSavingLeader}
                                        onChange={e => saveLeader(cat, e.target.value ? Number(e.target.value) : null)}
                                        className="flex-1 text-tp-sm font-bold px-2 py-1 rounded-lg outline-none"
                                        style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                        <option value="">— no leader —</option>
                                        {users.map(u => (
                                            <option key={u.id} value={u.id}>{getUserName(u)}</option>
                                        ))}
                                    </select>
                                    {isSavingLeader ? (
                                        <Loader2 size={12} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
                                    ) : (
                                        <button onClick={() => setEditingLeaderCatId(null)}
                                            className="p-1 rounded hover:opacity-70" style={{ color: 'var(--app-muted-foreground)' }}>
                                            <Check size={11} />
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* User sub-items */}
                            {isExpanded && catUsers.length > 0 && (
                                <div style={{ background: 'color-mix(in srgb, var(--app-bg) 50%, transparent)' }}>
                                    {catUsers.map(u => {
                                        const isUserSelected = selectedCategoryId === cat.id && selectedUserId === u.id;
                                        const userTaskCount = getTaskCountForUser(cat.id, u.id);
                                        return (
                                            <button key={u.id}
                                                    onClick={() => onSelectUser(cat.id, u.id)}
                                                    className="w-full pl-10 pr-3 py-2 flex items-center justify-between transition-colors text-left"
                                                    style={{
                                                        background: isUserSelected ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'transparent',
                                                        borderLeft: isUserSelected ? '3px solid var(--app-primary)' : '3px solid transparent',
                                                    }}>
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <User size={12} className="flex-shrink-0" style={{ color: 'var(--app-muted-foreground)' }} />
                                                    <span className="text-tp-sm font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                                                        {getUserName(u)}
                                                    </span>
                                                </div>
                                                <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded-full ml-2"
                                                      style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                                    {userTaskCount}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}

                {categories.length === 0 && (
                    <div className="px-4 py-8 text-center">
                        <div className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center"
                             style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)' }}>
                            <FolderKanban size={18} style={{ color: 'var(--app-primary)' }} />
                        </div>
                        <p className="text-tp-sm font-bold mb-1" style={{ color: 'var(--app-muted-foreground)' }}>No categories yet</p>
                        <p className="text-tp-xs mb-3" style={{ color: 'var(--app-muted-foreground)' }}>
                            Create categories to organize your tasks
                        </p>
                        <button onClick={onManageCategories}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-tp-sm font-bold text-white rounded-xl transition-all"
                                style={{ background: 'var(--app-primary)', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                            <Edit2 size={12} /> Create Categories
                        </button>
                    </div>
                )}
            </div>

            {/* Persistent footer button */}
            <div className="px-3 py-3 border-t" style={{ borderColor: 'var(--app-border)' }}>
                <button onClick={onManageCategories}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-tp-sm font-bold rounded-xl border transition-all hover:brightness-95"
                        style={{
                            background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)',
                            borderColor: 'color-mix(in srgb, var(--app-primary) 20%, transparent)',
                            color: 'var(--app-primary)',
                        }}>
                    <Edit2 size={13} />
                    Manage Categories
                </button>
            </div>
        </div>
    );
}
