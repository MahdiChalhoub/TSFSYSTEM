'use client'

import React, { Suspense, useMemo } from 'react'
import { useParams, usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from "@/components/ui/button"

/**
 * Isolated Error Boundary for Modules
 * Ensures one module crashing doesn't take down the entire Dashboard
 */
class ModuleErrorBoundary extends React.Component<
    { children: React.ReactNode, moduleName: string },
    { hasError: boolean, error: Error | null }
> {
    constructor(props: any) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error(`[Module:${this.props.moduleName}] Crashed:`, error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center p-12 min-h-[400px] border-2 border-dashed border-red-500/20 rounded-[2.5rem] bg-red-500/5 text-center">
                    <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Module Isolation Guard</h2>
                    <p className="text-gray-400 max-w-md mb-6 whitespace-pre-wrap">
                        The <strong>{this.props.moduleName}</strong> module encountered an error.
                        The rest of the system remains stable.
                    </p>
                    <Button
                        variant="outline"
                        onClick={() => window.location.reload()}
                        className="rounded-full gap-2 border-white/10 hover:bg-white/5"
                    >
                        <RefreshCw size={16} />
                        Retry Module Load
                    </Button>
                </div>
            )
        }

        return this.props.children
    }
}

/**
 * Dynamic Module Loader (The "Kernel" Shell)
 * Dynamically resolves components from src/modules/[code]
 */
export default function DynamicModuleLoader() {
    const params = useParams()
    const moduleCode = params.code as string

    // Resolve which component to load based on the path
    // For now, we look for a 'page' or 'dashboard' component in the module
    const ModuleComponent = useMemo(() => {
        return dynamic(() => import(`@/modules/${moduleCode}/page`).catch(() => {
            // Fallback if 'page.tsx' doesn't exist, try 'index.tsx'
            return import(`@/modules/${moduleCode}/index`).catch(() => {
                // Final fallback if the module directory is empty or missing
                return () => (
                    <div className="p-8 text-center text-gray-500">
                        Module {moduleCode} is installed but has no valid entry point.
                    </div>
                )
            })
        }), {
            loading: () => <ModuleSkeleton />,
            ssr: false // Keep it client-side to ensure isolation
        })
    }, [moduleCode])

    return (
        <ModuleErrorBoundary moduleName={moduleCode}>
            <Suspense fallback={<ModuleSkeleton />}>
                <ModuleComponent />
            </Suspense>
        </ModuleErrorBoundary>
    )
}

function ModuleSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="flex items-center gap-4">
                <Skeleton className="w-16 h-16 rounded-[2rem] bg-white/5" />
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48 bg-white/5" />
                    <Skeleton className="h-4 w-32 bg-white/5" />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-48 rounded-[2.5rem] bg-white/5" />
                ))}
            </div>
        </div>
    )
}
