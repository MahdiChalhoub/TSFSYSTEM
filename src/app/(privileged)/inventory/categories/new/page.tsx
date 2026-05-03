'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/**
 * Standalone "Create Category" route.
 *
 * Redirects to the categories list with `?new=1`, which CategoriesClient
 * picks up and opens the proper CategoryFormModal (bottom-sheet on
 * mobile, centered card on desktop, lazy-loaded brand/attribute trees,
 * cached code peek). Replaces the previous stub form that posted an
 * empty payload with "No form fields available" — that page never
 * worked, and on mobile it ignored the responsive modal entirely.
 */
export default function CreateCategoriesPage() {
    const router = useRouter()

    useEffect(() => {
        router.replace('/inventory/categories?new=1')
    }, [router])

    // Brief loading state in case the redirect doesn't paint instantly.
    return (
        <div className="min-h-screen flex items-center justify-center theme-bg">
            <div className="flex items-center gap-3 text-app-muted-foreground">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-tp-sm font-bold">Opening Create Category…</span>
            </div>
        </div>
    )
}
