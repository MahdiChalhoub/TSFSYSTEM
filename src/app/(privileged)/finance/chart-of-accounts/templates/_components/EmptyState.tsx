// ── Empty State ──
export function EmptyState({ icon: Icon, text, subtitle }: { icon: any; text: string; subtitle?: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <Icon size={36} className="text-app-muted-foreground mb-3 opacity-40" />
            <p className="text-sm font-bold text-app-muted-foreground">{text}</p>
            {subtitle && <p className="text-tp-sm text-app-muted-foreground mt-1">{subtitle}</p>}
        </div>
    )
}
