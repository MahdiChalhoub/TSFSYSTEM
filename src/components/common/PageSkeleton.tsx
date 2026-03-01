"use client"

import { Skeleton } from "@/components/ui/skeleton"

interface PageSkeletonProps {
    /** Layout variant */
    variant?: 'dashboard' | 'list' | 'form' | 'detail'
}

export default function PageSkeleton({ variant = 'list' }: PageSkeletonProps) {
    if (variant === 'dashboard') {
        return (
            <div className="page-container">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-2xl" />
                        <div>
                            <Skeleton className="h-8 w-48 rounded-xl" />
                            <Skeleton className="h-3 w-64 rounded-lg mt-2" />
                        </div>
                    </div>
                    <Skeleton className="h-10 w-32 rounded-xl" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Skeleton className="lg:col-span-2 h-80 rounded-2xl" />
                    <Skeleton className="h-80 rounded-2xl" />
                </div>
            </div>
        )
    }

    if (variant === 'form') {
        return (
            <div className="page-container max-w-3xl">
                <Skeleton className="h-10 w-64 rounded-xl" />
                <Skeleton className="h-3 w-96 rounded-lg mt-2" />
                <div className="space-y-4 mt-6">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="space-y-2">
                            <Skeleton className="h-3 w-24 rounded" />
                            <Skeleton className="h-10 w-full rounded-xl" />
                        </div>
                    ))}
                </div>
                <div className="flex gap-3 pt-4">
                    <Skeleton className="h-10 w-24 rounded-xl" />
                    <Skeleton className="h-10 w-32 rounded-xl" />
                </div>
            </div>
        )
    }

    if (variant === 'detail') {
        return (
            <div className="page-container">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <Skeleton className="h-8 w-48 rounded-xl" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
                </div>
                <Skeleton className="h-96 rounded-2xl" />
            </div>
        )
    }

    // Default: list variant
    return (
        <div className="page-container">
            <div className="flex justify-between items-center">
                <div>
                    <Skeleton className="h-8 w-48 rounded-xl" />
                    <Skeleton className="h-3 w-64 rounded-lg mt-2" />
                </div>
                <Skeleton className="h-10 w-36 rounded-xl" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
            <Skeleton className="h-96 rounded-2xl" />
        </div>
    )
}
