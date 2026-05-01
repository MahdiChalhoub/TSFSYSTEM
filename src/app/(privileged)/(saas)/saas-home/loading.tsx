export default function DashboardLoading() {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div className="space-y-3">
                    <div className="h-3 w-36 bg-app-surface-2 rounded animate-pulse" />
                    <div className="h-12 w-72 bg-app-surface-2 rounded-xl animate-pulse" />
                    <div className="h-4 w-56 bg-app-surface-2 rounded animate-pulse" />
                </div>
                <div className="flex gap-3">
                    <div className="h-12 w-28 bg-app-surface-2 rounded-2xl animate-pulse" />
                    <div className="h-12 w-24 bg-app-surface-2 rounded-2xl animate-pulse" />
                    <div className="h-12 w-32 bg-app-success-bg rounded-2xl animate-pulse" />
                </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-app-surface border border-app-border rounded-[2rem] shadow-sm p-8 space-y-4 animate-pulse" style={{ animationDelay: `${i * 0.08}s` }}>
                        <div className="h-12 w-12 bg-app-surface-2 rounded-2xl" />
                        <div className="space-y-2">
                            <div className="h-3 w-28 bg-app-surface-2 rounded" />
                            <div className="h-8 w-16 bg-app-surface-2 rounded" />
                        </div>
                        <div className="h-3 w-16 bg-app-surface rounded" />
                    </div>
                ))}
            </div>

            {/* Content area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-app-surface border border-app-border rounded-[2.5rem] shadow-sm p-8 space-y-4 animate-pulse">
                    <div className="h-6 w-48 bg-app-surface-2 rounded" />
                    <div className="h-3 w-36 bg-app-surface-2 rounded" />
                    <div className="space-y-3 mt-6">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-16 bg-app-surface rounded-2xl" />
                        ))}
                    </div>
                </div>
                <div className="bg-app-surface border border-app-border rounded-[2.5rem] shadow-sm p-8 space-y-4 animate-pulse">
                    <div className="h-6 w-32 bg-app-surface-2 rounded" />
                    <div className="space-y-3 mt-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-14 bg-app-surface rounded-2xl" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
