import { pageWrap, card } from '../_lib/constants'

export function LoadingSkeleton() {
    return (
        <div className={pageWrap}>
            <div className="mb-3">
                <div className="h-5 w-[300px] rounded-lg bg-app-border/30 animate-pulse mb-2" />
                <div className="h-3 w-[450px] rounded bg-app-border/20 animate-pulse" />
            </div>
            <div className={card}>
                <div className="px-3 py-2 border-b border-app-border/20">
                    <div className="h-3 w-[100px] rounded bg-app-border/30 animate-pulse" />
                </div>
                {[1,2,3,4].map(i => (
                    <div key={i} className="px-3 py-3 flex items-center gap-4 border-b border-app-border/10 last:border-0">
                        <div className="h-3 w-[120px] rounded bg-app-border/20 animate-pulse" />
                        <div className="h-3 w-[160px] rounded bg-app-border/20 animate-pulse" />
                        <div className="h-3 w-[40px] rounded bg-app-border/20 animate-pulse" />
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
                {[1,2,3,4].map(i => (
                    <div key={i} className={card}>
                        <div className="px-3 py-3">
                            <div className="h-4 w-[140px] rounded bg-app-border/30 animate-pulse mb-3" />
                            <div className="space-y-3">
                                <div className="h-8 rounded-lg bg-app-border/15 animate-pulse" />
                                <div className="h-8 rounded-lg bg-app-border/15 animate-pulse" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
