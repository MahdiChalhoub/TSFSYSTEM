'use client';

import { useRef, useEffect, useState } from 'react';
import { Scan, X, Search } from 'lucide-react';

interface ProductScanBarProps {
    value: string;
    onChange: (val: string) => void;
    onScan: (code: string) => void;
    placeholder?: string;
    autoFocus?: boolean;
}

export function ProductScanBar({
    value,
    onChange,
    onScan,
    placeholder = 'Scan barcode or search product...',
    autoFocus = true,
}: ProductScanBarProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [scanning, setScanning] = useState(false);

    // Auto-focus on mount
    useEffect(() => {
        if (autoFocus) inputRef.current?.focus();
    }, [autoFocus]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && value.trim()) {
            setScanning(true);
            onScan(value.trim());
            setTimeout(() => setScanning(false), 400);
        }
    };

    const handleClear = () => {
        onChange('');
        inputRef.current?.focus();
    };

    return (
        <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 ${scanning ? 'sm-anim-scan' : ''}`}
            style={{
                background: 'var(--sm-surface)',
                borderColor: scanning ? 'var(--sm-primary)' : 'var(--sm-border)',
                boxShadow: scanning ? 'var(--sm-shadow-glow)' : 'var(--sm-shadow-sm)',
            }}
        >
            {/* Icon */}
            <div style={{ color: value ? 'var(--sm-primary)' : 'var(--sm-text-subtle)' }}>
                {value ? <Search size={20} /> : <Scan size={20} />}
            </div>

            {/* Input */}
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="flex-1 bg-transparent border-none outline-none text-base font-medium"
                style={{
                    color: 'var(--sm-text)',
                    fontFamily: 'var(--sm-font)',
                    caretColor: 'var(--sm-primary)',
                }}
            />

            {/* Clear */}
            {value && (
                <button
                    onClick={handleClear}
                    aria-label="Clear search"
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                    style={{
                        background: 'var(--sm-surface-2)',
                        color: 'var(--sm-text-muted)',
                    }}
                >
                    <X size={13} />
                </button>
            )}

            {/* Enter hint */}
            {!value && (
                <span
                    className="hidden sm:inline text-xs px-1.5 py-0.5 rounded border font-mono"
                    style={{
                        color: 'var(--sm-text-subtle)',
                        borderColor: 'var(--sm-border)',
                        fontFamily: 'var(--sm-font)',
                    }}
                >
                    Enter
                </span>
            )}
        </div>
    );
}
