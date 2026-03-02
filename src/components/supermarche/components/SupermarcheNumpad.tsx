'use client';

import { Delete } from 'lucide-react';

interface SupermarcheNumpadProps {
    onPress: (key: string) => void;
    onDelete: () => void;
    onClear: () => void;
    onEnter: () => void;
    display?: string;
    showDisplay?: boolean;
}

const KEYS = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['00', '0', '.'],
];

export function SupermarcheNumpad({
    onPress,
    onDelete,
    onClear,
    onEnter,
    display,
    showDisplay = false,
}: SupermarcheNumpadProps) {
    return (
        <div
            className="rounded-xl p-3 flex flex-col gap-2"
            style={{
                background: 'var(--sm-numpad-bg)',
                border: '1px solid var(--sm-border)',
                fontFamily: 'var(--sm-font)',
            }}
        >
            {/* Optional display */}
            {showDisplay && (
                <div
                    className="rounded-lg px-4 py-2.5 text-right text-2xl font-black mb-1"
                    style={{
                        background: 'var(--sm-surface)',
                        color: 'var(--sm-text)',
                        border: '1px solid var(--sm-border)',
                        minHeight: 52,
                        letterSpacing: '-0.02em',
                    }}
                >
                    {display || '0'}
                </div>
            )}

            {/* Number grid */}
            <div className="grid grid-cols-3 gap-2">
                {KEYS.flat().map((key) => (
                    <button
                        key={key}
                        onClick={() => onPress(key)}
                        aria-label={`Numpad ${key}`}
                        className="h-12 rounded-xl text-lg font-bold flex items-center justify-center transition-all duration-100 active:scale-95"
                        style={{
                            background: 'var(--sm-numpad-key)',
                            color: 'var(--sm-text)',
                            border: '1px solid var(--sm-border)',
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = 'var(--sm-numpad-key-hover)';
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = 'var(--sm-numpad-key)';
                        }}
                    >
                        {key}
                    </button>
                ))}

                {/* Delete key */}
                <button
                    onClick={onDelete}
                    aria-label="Delete last digit"
                    className="h-12 rounded-xl flex items-center justify-center transition-all duration-100 active:scale-95"
                    style={{
                        background: 'var(--sm-surface-2)',
                        color: 'var(--sm-text-muted)',
                        border: '1px solid var(--sm-border)',
                    }}
                >
                    <Delete size={18} />
                </button>

                {/* Clear */}
                <button
                    onClick={onClear}
                    aria-label="Clear all"
                    className="h-12 rounded-xl text-sm font-bold transition-all duration-100 active:scale-95"
                    style={{
                        background: 'var(--sm-surface-2)',
                        color: 'var(--sm-danger)',
                        border: '1px solid var(--sm-border)',
                    }}
                >
                    CLR
                </button>

                {/* Enter */}
                <button
                    onClick={onEnter}
                    aria-label="Confirm"
                    className="h-12 rounded-xl text-sm font-bold col-span-1 transition-all duration-100 active:scale-95"
                    style={{
                        background: 'var(--sm-primary)',
                        color: '#fff',
                        boxShadow: 'var(--sm-shadow-glow)',
                    }}
                >
                    OK
                </button>
            </div>
        </div>
    );
}
