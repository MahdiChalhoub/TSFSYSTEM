'use client';
import React from 'react';

export function DefaultValueHint({ field, currentVal, defaults }: {
    field: string;
    currentVal: any;
    defaults: Record<string, any>;
}) {
    const def = defaults[field];
    if (def === undefined || JSON.stringify(def) === JSON.stringify(currentVal)) return null;
    return <span className="text-[8px] text-app-muted-foreground/50 ml-1">(default: {String(def)})</span>;
}
