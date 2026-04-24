'use client';

/**
 * LockableCodeInput
 * =================
 * A code/short-code input that is locked by default when editing an existing
 * record — changing a master-data code can break existing foreign references
 * (products keyed by brand code, task tags, etc.). The user must click the
 * pencil icon and confirm before editing is allowed.
 *
 * On New records the field is open — no lock, no confirm.
 *
 * Usage:
 *   <LockableCodeInput
 *       name="code"
 *       defaultValue={existing?.code}
 *       suggestedValue={sequencePeek}
 *       isEdit={!!existing}
 *       placeholder="e.g. BX"
 *   />
 *
 * The underlying <input> is a plain form field — it posts normally with the
 * surrounding <form>. No server action changes required.
 */

import { useRef, useState } from 'react';
import { Lock, Pencil } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface Props {
    name: string;
    defaultValue?: string;
    suggestedValue?: string;    // pre-filled on New when no existing value
    isEdit: boolean;
    placeholder?: string;
    required?: boolean;
    mono?: boolean;
    className?: string;
    style?: React.CSSProperties;
    warning?: string;           // custom confirm copy; falls back to a default
    maxLength?: number;
    /** "digits" → strip non-numeric on every keystroke. */
    inputFilter?: 'digits';
}

const EDIT_WARNING =
    'Changing this code may break existing references (products, barcodes, reports). ' +
    'Only proceed if you understand the impact. Continue?';

const OVERRIDE_WARNING =
    'This code was auto-assigned by your sequence (/settings/sequences). ' +
    'Overriding it means this record will NOT follow the sequence, but the ' +
    'counter still advances. Only use a custom code if you have a strong reason. Continue?';

export function LockableCodeInput({
    name, defaultValue, suggestedValue, isEdit, placeholder, required,
    mono, className, style, warning, maxLength, inputFilter,
}: Props) {
    // Lock whenever there is an authoritative value in the field:
    //   • edit mode: the existing code is the source of truth
    //   • new mode: if the sequence provided a suggested value, that is the
    //     source of truth — user must explicitly opt out to override.
    // Only open by default when new AND no suggestion is available yet.
    const hasAuthoritativeValue = isEdit || !!(suggestedValue || defaultValue);
    const [unlocked, setUnlocked] = useState(!hasAuthoritativeValue);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const openConfirm = () => setConfirmOpen(true);
    const handleConfirm = () => {
        setConfirmOpen(false);
        setUnlocked(true);
        setTimeout(() => inputRef.current?.focus(), 10);
    };

    const showLock = hasAuthoritativeValue && !unlocked;
    const showEditing = hasAuthoritativeValue && unlocked;
    const tintColor = isEdit ? 'var(--app-warning, #f59e0b)' : 'var(--app-primary)';

    return (
        <div className="relative">
            <input
                ref={inputRef}
                name={name}
                key={suggestedValue || 'no-suggest'}
                defaultValue={defaultValue || suggestedValue || ''}
                placeholder={placeholder}
                required={required}
                readOnly={!unlocked}
                maxLength={maxLength}
                inputMode={inputFilter === 'digits' ? 'numeric' : undefined}
                onChange={inputFilter === 'digits'
                    ? e => { e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, maxLength ?? 999); }
                    : undefined}
                className={`${className ?? ''} ${mono ? 'font-mono font-bold' : ''} pr-10 ${!unlocked ? 'opacity-80 cursor-not-allowed' : ''}`}
                style={style}
            />
            {showLock && (
                <button
                    type="button"
                    onClick={openConfirm}
                    title={isEdit ? 'Unlock to edit — may break existing references' : 'Override sequence — pick a custom code'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-1 rounded-lg transition-all hover:bg-app-border/40"
                    style={{ color: tintColor }}
                    aria-label="Unlock code">
                    <Lock size={12} />
                    <Pencil size={11} />
                </button>
            )}
            {showEditing && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-tp-xxs font-bold uppercase tracking-widest"
                      style={{ color: tintColor }}>
                    {isEdit ? 'editing' : 'custom'}
                </span>
            )}

            {/* Theme-styled confirm dialog instead of the ugly native
             *  window.confirm with "saas.developos.shop says" header. */}
            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                onConfirm={handleConfirm}
                title={isEdit ? 'Unlock this code?' : 'Override the sequence?'}
                description={warning ?? (isEdit ? EDIT_WARNING : OVERRIDE_WARNING)}
                confirmText={isEdit ? 'Unlock and edit' : 'Override'}
                variant={isEdit ? 'warning' : 'info'}
            />
        </div>
    );
}
