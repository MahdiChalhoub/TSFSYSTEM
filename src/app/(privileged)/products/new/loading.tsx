import { PackagePlus, Loader2 } from 'lucide-react'

export default function NewProductLoading() {
    return (
        <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-200">
            {/* Header skeleton */}
            <div className="flex-shrink-0 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl border border-app-border animate-pulse"
                        style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }} />
                    <div className="page-header-icon bg-app-primary"
                        style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <PackagePlus size={20} className="text-white" />
                    </div>
                    <div>
                        <h1>New Product</h1>
                        <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">
                            Loading form...
                        </p>
                    </div>
                </div>
            </div>

            {/* Loading content */}
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <Loader2 size={32} className="animate-spin text-app-primary" />
                <p className="text-[12px] font-bold text-app-muted-foreground">
                    Preparing product form...
                </p>
            </div>
        </div>
    )
}
