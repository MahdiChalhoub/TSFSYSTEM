'use client';

import { Tag, Zap, Clock } from 'lucide-react';

export type PromotionType = 'DISCOUNT' | 'BUNDLE' | 'FLASH' | 'CLEARANCE';

const PROMO_CONFIG: Record<PromotionType, {
    label: string;
    icon: React.ReactNode;
    bg: string;
    color: string;
}> = {
    DISCOUNT: { label: 'PROMO', icon: <Tag size={10} />, bg: 'var(--sm-danger)', color: '#fff' },
    BUNDLE: { label: 'BUNDLE', icon: <Tag size={10} />, bg: 'var(--sm-primary)', color: '#fff' },
    FLASH: { label: 'FLASH', icon: <Zap size={10} />, bg: 'var(--sm-accent)', color: '#fff' },
    CLEARANCE: { label: 'CLEARANCE', icon: <Clock size={10} />, bg: '#7C3AED', color: '#fff' },
};

interface PromotionBadgeProps {
    type: PromotionType;
    value?: number; // e.g. 20 for "20% OFF"
    pulse?: boolean;
    size?: 'sm' | 'md';
}

export function PromotionBadge({ type, value, pulse = true, size = 'md' }: PromotionBadgeProps) {
    const cfg = PROMO_CONFIG[type];

    return (
        <div
            className={`inline-flex items-center gap-1 rounded-full font-bold ${pulse ? 'sm-anim-promo' : ''}`}
            style={{
                background: cfg.bg,
                color: cfg.color,
                padding: size === 'sm' ? '2px 8px' : '3px 10px',
                fontSize: size === 'sm' ? '9px' : '10px',
                letterSpacing: '0.06em',
                fontFamily: 'var(--sm-font)',
            }}
        >
            {cfg.icon}
            {cfg.label}
            {value !== undefined && ` -${value}%`}
        </div>
    );
}
