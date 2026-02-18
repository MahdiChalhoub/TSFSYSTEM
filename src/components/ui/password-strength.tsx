'use client';

import { useMemo } from 'react';

interface PasswordStrengthProps {
    password: string;
}

function getStrength(password: string): { score: number; label: string; color: string } {
    if (!password) return { score: 0, label: '', color: '' };

    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-red-500' };
    if (score <= 2) return { score: 2, label: 'Fair', color: 'bg-orange-500' };
    if (score <= 3) return { score: 3, label: 'Good', color: 'bg-amber-400' };
    if (score <= 4) return { score: 4, label: 'Strong', color: 'bg-emerald-400' };
    return { score: 5, label: 'Very Strong', color: 'bg-emerald-500' };
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
    const strength = useMemo(() => getStrength(password), [password]);

    if (!password) return null;

    return (
        <div className="space-y-1.5 mt-2">
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((level) => (
                    <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${level <= strength.score ? strength.color : 'bg-slate-700'
                            }`}
                    />
                ))}
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${strength.score <= 1 ? 'text-red-400' :
                    strength.score <= 2 ? 'text-orange-400' :
                        strength.score <= 3 ? 'text-amber-400' :
                            'text-emerald-400'
                }`}>
                {strength.label}
            </p>
        </div>
    );
}
