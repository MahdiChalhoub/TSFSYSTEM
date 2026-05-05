import clsx from 'clsx';
import { CheckCircle2 } from 'lucide-react';
import type { LobbyStep } from '../types';
import { STEPS } from '../constants';

export function StepProgress({ current }: { current: LobbyStep }) {
    const currentIdx = STEPS.findIndex(s => s.key === current);
    return (
        <div className="flex items-center justify-center gap-1.5 mb-8">
            {STEPS.map((s, i) => {
                const done = i < currentIdx;
                const active = i === currentIdx;
                return (
                    <div key={s.key} className="flex items-center gap-1.5">
                        {i > 0 && (
                            <div className={clsx('h-px w-5 transition-all duration-500', done ? 'bg-[var(--app-primary)]' : 'bg-[var(--app-surface-hover)]')} />
                        )}
                        <div className={clsx(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black transition-all duration-300',
                            active && 'bg-[var(--app-primary-light)] text-[var(--app-primary)] ring-1 ring-[var(--app-primary-strong)]/50 shadow-lg shadow-[var(--app-primary-glow)]',
                            done && 'bg-[var(--app-success-bg)] text-[var(--app-success)]',
                            !active && !done && 'text-[var(--app-muted-foreground)]',
                        )}>
                            {done ? <CheckCircle2 size={10} /> : <span className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[9px]">{i + 1}</span>}
                            <span className={clsx(!active && !done && 'hidden sm:inline')}>{s.label}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
