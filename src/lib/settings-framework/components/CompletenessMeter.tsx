'use client';
import React from 'react';

export function CompletenessMeter({ score }: { score: number }) {
    return (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-app-background border border-app-border/30" title={`Config ${score}% complete`}>
            <div className="w-12 h-1 rounded-full bg-app-border/30 overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                        width: `${score}%`,
                        background: score === 100 ? 'var(--app-success)' : score >= 75 ? 'var(--app-primary)' : 'var(--app-warning)',
                    }}
                />
            </div>
            <span className="text-[8px] font-black text-app-muted-foreground">{score}%</span>
        </div>
    );
}
