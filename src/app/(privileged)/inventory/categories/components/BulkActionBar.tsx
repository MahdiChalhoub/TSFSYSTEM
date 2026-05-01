'use client';

/**
 * BulkActionBar — floating toolbar shown when N>0 categories are selected.
 * Offers high-value bulk ops:
 *   - Move to parent (re-parent N at once)
 *   - Delete (with typed-confirmation guard + safe/blocked split)
 *
 * Note: bulk "Set prefix" was removed — barcode prefixes are unique per
 * category, so applying one prefix to N rows would fail for N-1 of them.
 * Users set prefixes per-row from the edit dialog.
 */

import { X, FolderTree, Trash2 } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';

interface Props {
    count: number;
    onMove: () => void;
    onDelete: () => void;
    onClear: () => void;
}

export function BulkActionBar({ count, onMove, onDelete, onClear }: Props) {
    const { t } = useTranslation();
    if (count === 0) return null;
    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-2 py-1.5 rounded-2xl animate-in slide-in-from-bottom-4 duration-200"
             style={{
                 background: 'var(--app-surface)',
                 border: '1px solid var(--app-border)',
                 boxShadow: '0 12px 36px rgba(0,0,0,0.22)',
             }}>
            <div className="px-3 py-1.5 rounded-xl text-tp-sm font-bold"
                 style={{
                     background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                     color: 'var(--app-primary)',
                 }}>
                {t('inventory.categories_page.bulk_selected').replace('{count}', String(count))}
            </div>
            <button onClick={onMove}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-tp-sm font-bold transition-all hover:-translate-y-0.5"
                    style={{ background: 'var(--app-background)', color: 'var(--app-foreground)', border: '1px solid var(--app-border)' }}>
                <FolderTree size={13} /> {t('inventory.categories_page.bulk_move')}
            </button>
            <button onClick={onDelete}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-tp-sm font-bold transition-all hover:-translate-y-0.5"
                    style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)', color: 'var(--app-error, #ef4444)', border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 25%, transparent)' }}>
                <Trash2 size={13} /> {t('inventory.categories_page.bulk_delete')}
            </button>
            <button onClick={onClear}
                    title={t('inventory.categories_page.bulk_clear_title')}
                    className="w-8 h-8 flex items-center justify-center rounded-xl transition-all"
                    style={{ color: 'var(--app-muted-foreground)' }}>
                <X size={14} />
            </button>
        </div>
    );
}
