'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Redirect /new to the main page where the Create Group modal is available.
 * The main listing page has a "New Group" button that opens a proper modal.
 */
export default function CreateProductGroupsPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/inventory/product-groups')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-[400px]" style={{ color: 'var(--app-muted-foreground)' }}>
      <p className="text-sm">Redirecting...</p>
    </div>
  )
}
