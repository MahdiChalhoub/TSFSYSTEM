'use client';

import { ChevronDown, ChevronRight, GripVertical, User, FolderKanban, Edit2, X } from 'lucide-react';
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
    onCloseMobile,
}: CategorySidebarProps) {

    const getTaskCountForCategory = (catId: number | null) =>
        catId === null
            ? tasks.filter(t => !t.category).length
            : tasks.filter(t => t.category === catId).length;

    const getTaskCountForUser = (catId: number, userId: number) =>
        tasks.filter(t => t.category === catId && t.assigned_to === userId).length;

    const getUsersForCategory = (catId: number): UserItem[] => {
        const userIds = new Set(
            tasks.filter(t => t.category === catId && t.assigned_to).map(t => t.assigned_to as number)
        );
        return users.filter(u => userIds.has(u.id));
    };

    const countBadge = (count: number) => (
        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
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
                <h3 className="text-[12px] font-black flex items-center gap-2" style={{ color: 'var(--app-foreground)' }}>
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
                    <span className="text-[12px] font-bold" style={{ color: 'var(--app-foreground)' }}>All Tasks</span>
                    {countBadge(tasks.length)}
                </button>

                {/* Uncategorized */}
                {getTaskCountForCategory(null) > 0 && (
                    <button onClick={() => onSelectCategory(null)}
                            className="w-full px-4 py-2.5 flex items-center justify-between transition-colors border-b text-left"
                            style={activeStyle(selectedCategoryId === null && !selectedUserId)}>
                        <span className="text-[12px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>Uncategorized</span>
                        {countBadge(getTaskCountForCategory(null))}
                    </button>
                )}

                {/* Category items */}
                {categories.map(cat => {
                    const catUsers = getUsersForCategory(cat.id);
                    const isExpanded = expandedCategories.has(cat.id);
                    const hasUsers = catUsers.length > 0;
                    const isSelected = selectedCategoryId === cat.id && !selectedUserId;

                    return (
                        <div key={cat.id} className="border-b" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
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
                                        <span className="text-[12px] font-bold truncate" style={{ color: 'var(--app-foreground)' }}>{cat.name}</span>
                                    </div>
                                    {countBadge(getTaskCountForCategory(cat.id))}
                                </button>
                            </div>

                            {/* User sub-items */}
                            {isExpanded && catUsers.length > 0 && (
                                <div style={{ background: 'color-mix(in srgb, var(--app-bg) 50%, transparent)' }}>
                                    {catUsers.map(u => {
                                        const isUserSelected = selectedCategoryId === cat.id && selectedUserId === u.id;
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
                                                    <span className="text-[11px] font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                                                        {getUserName(u)}
                                                    </span>
                                                </div>
                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full ml-2"
                                                      style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                                    {getTaskCountForUser(cat.id, u.id)}
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
                        <p className="text-[11px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>No categories yet.</p>
                        <button onClick={onManageCategories}
                                className="mt-1 text-[11px] font-bold" style={{ color: 'var(--app-primary)' }}>
                            Create one →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
