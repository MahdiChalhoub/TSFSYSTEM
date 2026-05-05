'use client';
import React from 'react';

export function ValidationDot({ status }: { status: 'ok' | 'warn' | 'error' | null }) {
    if (!status) return null;
    const colors = { ok: 'bg-app-success', warn: 'bg-app-warning', error: 'bg-app-error' };
    const labels = { ok: 'Valid', warn: 'Warning', error: 'Invalid' };
    return (
        <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${colors[status]}`}
            title={labels[status]}
        />
    );
}
