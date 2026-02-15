export default function Loading() {
    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* Sidebar skeleton */}
            <div className="w-64 bg-white border-r border-gray-100 p-4 space-y-4 shrink-0">
                <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
                <div className="space-y-2 mt-6">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="h-8 bg-gray-50 rounded-lg animate-pulse" style={{ animationDelay: `${i * 0.05}s` }} />
                    ))}
                </div>
            </div>

            {/* Content area skeleton */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Top header skeleton */}
                <div className="h-14 bg-white border-b border-gray-100 px-6 flex items-center gap-4">
                    <div className="h-8 w-48 bg-gray-100 rounded-xl animate-pulse" />
                    <div className="flex-1" />
                    <div className="h-8 w-8 bg-gray-100 rounded-full animate-pulse" />
                </div>

                {/* Tab bar skeleton */}
                <div className="h-10 bg-white border-b border-gray-50 px-6 flex items-center gap-2">
                    <div className="h-6 w-24 bg-gray-100 rounded-lg animate-pulse" />
                    <div className="h-6 w-20 bg-gray-50 rounded-lg animate-pulse" />
                </div>

                {/* Main content skeleton */}
                <main className="flex-1 p-8 space-y-6">
                    {/* Title */}
                    <div className="space-y-2">
                        <div className="h-4 w-32 bg-gray-100 rounded-lg animate-pulse" />
                        <div className="h-10 w-64 bg-gray-200 rounded-xl animate-pulse" />
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-40 bg-white border border-gray-100 rounded-[2rem] shadow-sm animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}>
                                <div className="p-8 space-y-4">
                                    <div className="h-12 w-12 bg-gray-100 rounded-2xl" />
                                    <div className="h-4 w-24 bg-gray-100 rounded" />
                                    <div className="h-8 w-16 bg-gray-200 rounded" />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Content cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 h-72 bg-white border border-gray-100 rounded-[2.5rem] shadow-sm animate-pulse" />
                        <div className="h-72 bg-white border border-gray-100 rounded-[2.5rem] shadow-sm animate-pulse" />
                    </div>
                </main>
            </div>
        </div>
    );
}
