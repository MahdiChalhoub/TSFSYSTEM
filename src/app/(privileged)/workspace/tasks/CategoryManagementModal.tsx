'use client';

import { useState, useTransition } from 'react';
import { Plus, X, FolderKanban, Edit2, Trash2 } from 'lucide-react';
import type { Category } from './types';

interface CategoryManagementModalProps {
    categories: Category[];
    onClose: () => void;
    onUpdate: () => void;
}

export default function CategoryManagementModal({
    categories: initialCategories,
    onClose,
    onUpdate,
}: CategoryManagementModalProps) {
    const [cats, setCats] = useState(initialCategories);
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState('var(--app-info)');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('');
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState('');

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!newName.trim()) return;
        setError('');
        const { createTaskCategory } = await import('@/app/actions/workspace');
        startTransition(async () => {
            try {
                const result = await createTaskCategory({ name: newName.trim(), color: newColor });
                if (result?.id) {
                    setCats(prev => [...prev, result]);
                    setNewName('');
                    setNewColor('var(--app-info)');
                    onUpdate();
                }
            } catch { setError('Failed to create category'); }
        });
    }

    async function handleUpdate(id: number) {
        if (!editName.trim()) return;
        setError('');
        const { updateTaskCategory } = await import('@/app/actions/workspace');
        startTransition(async () => {
            try {
                await updateTaskCategory(id, { name: editName.trim(), color: editColor });
                setCats(prev => prev.map(c => c.id === id ? { ...c, name: editName.trim(), color: editColor } : c));
                setEditingId(null);
                onUpdate();
            } catch { setError('Failed to update category'); }
        });
    }

    async function handleDelete(id: number) {
        if (!confirm('Delete this category? Tasks will become uncategorized.')) return;
        const { deleteTaskCategory } = await import('@/app/actions/workspace');
        startTransition(async () => {
            try {
                await deleteTaskCategory(id);
                setCats(prev => prev.filter(c => c.id !== id));
                onUpdate();
            } catch { setError('Failed to delete category'); }
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'color-mix(in srgb, var(--app-bg) 60%, transparent)', backdropFilter: 'blur(8px)' }}
             onClick={onClose}>
            <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border shadow-2xl"
                 style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
                 onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="sticky top-0 z-10 px-5 py-4 flex items-center justify-between border-b"
                     style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                             style={{ background: 'var(--app-primary)', boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <FolderKanban size={16} className="text-white" />
                        </div>
                        <h2 className="text-base font-bold" style={{ color: 'var(--app-foreground)' }}>Manage Categories</h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl transition-colors hover:opacity-70"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {error && (
                        <div className="px-3 py-2 rounded-xl text-tp-md font-bold"
                             style={{ background: 'color-mix(in srgb, var(--app-error) 10%, transparent)', color: 'var(--app-error)', border: '1px solid color-mix(in srgb, var(--app-error) 30%, transparent)' }}>
                            {error}
                        </div>
                    )}

                    {/* Create form */}
                    <form onSubmit={handleCreate}
                          className="p-4 rounded-xl border"
                          style={{ background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))', borderColor: 'color-mix(in srgb, var(--app-primary) 20%, transparent)' }}>
                        <h3 className="text-tp-sm font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--app-foreground)' }}>
                            New Category
                        </h3>
                        <div className="flex gap-2">
                            <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
                                   className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                            <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                                   placeholder="Category name"
                                   className="flex-1 px-3 py-2 text-tp-lg font-bold rounded-xl outline-none transition-all"
                                   style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                            <button type="submit" disabled={isPending}
                                    className="flex items-center gap-1 px-4 py-2 text-tp-sm font-bold text-white rounded-xl transition-all disabled:opacity-50"
                                    style={{ background: 'var(--app-primary)', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                <Plus size={14} /> Create
                            </button>
                        </div>
                    </form>

                    {/* Category list */}
                    <div className="space-y-2">
                        {cats.map(cat => (
                            <div key={cat.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors"
                                 style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
                                {editingId === cat.id ? (
                                    <div className="flex-1 flex items-center gap-2 flex-wrap">
                                        <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)}
                                               className="w-8 h-8 rounded cursor-pointer border-0" />
                                        <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                                               className="flex-1 min-w-[120px] px-2 py-1.5 text-tp-lg font-bold rounded-lg outline-none"
                                               style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                        <button onClick={() => handleUpdate(cat.id)}
                                                className="px-3 py-1.5 text-tp-sm font-bold text-white rounded-lg"
                                                style={{ background: 'var(--app-primary)' }}>Save</button>
                                        <button onClick={() => setEditingId(null)}
                                                className="px-3 py-1.5 text-tp-sm font-bold rounded-lg border"
                                                style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}>Cancel</button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: cat.color || 'var(--app-primary)' }} />
                                        <span className="flex-1 text-tp-lg font-bold" style={{ color: 'var(--app-foreground)' }}>{cat.name}</span>
                                        <button onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditColor(cat.color || 'var(--app-info)'); }}
                                                className="p-1.5 rounded-lg transition-colors hover:opacity-70" style={{ color: 'var(--app-primary)' }}>
                                            <Edit2 size={13} />
                                        </button>
                                        <button onClick={() => handleDelete(cat.id)}
                                                className="p-1.5 rounded-lg transition-colors hover:opacity-70" style={{ color: 'var(--app-error)' }}>
                                            <Trash2 size={13} />
                                        </button>
                                    </>
                                )}
                            </div>
                        ))}
                        {cats.length === 0 && (
                            <div className="text-center py-8">
                                <FolderKanban size={28} className="mx-auto mb-2" style={{ color: 'var(--app-muted-foreground)', opacity: 0.4 }} />
                                <p className="text-tp-md font-bold" style={{ color: 'var(--app-muted-foreground)' }}>No categories yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
