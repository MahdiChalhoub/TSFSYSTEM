'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function EditJobRedirect() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string

    useEffect(() => {
        // Redirect to the new wizard but with the job ID to resume/edit
        router.replace(`/migration_v2/jobs/new?jobId=${id}`)
    }, [id, router])

    return (
        <div className="flex items-center justify-center min-h-screen bg-app-surface">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
    )
}
