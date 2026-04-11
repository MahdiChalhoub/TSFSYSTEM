'use client';
import React from 'react';

export interface Preset<T = any> {
    key: string;
    label: string;
    icon: string;
    values: Partial<T>;
}

export function PresetSelector<T>({ presets, onApply }: {
    presets: Preset<T>[];
    onApply: (key: string, values: Partial<T>) => void;
}) {
    return (
        <div className="flex items-center gap-1">
            <span className="text-[8px] font-bold text-app-muted-foreground/50 uppercase mr-0.5">Presets:</span>
            {presets.map(preset => (
                <button
                    key={preset.key}
                    type="button"
                    onClick={() => onApply(preset.key, preset.values)}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-app-background border border-app-border/30 text-[8px] font-bold text-app-muted-foreground hover:text-app-foreground hover:border-app-primary/30 transition-all"
                    title={`Apply ${preset.label} preset`}
                >
                    <span>{preset.icon}</span> {preset.label}
                </button>
            ))}
        </div>
    );
}
