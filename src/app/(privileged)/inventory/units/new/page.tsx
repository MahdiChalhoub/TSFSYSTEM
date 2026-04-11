'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { Button } from '@/components/ui/button'
import { ArrowLeft,  } from 'lucide-react'

export default function CreateUnitsPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const formData = new FormData(e.currentTarget)
      const data = Object.fromEntries(formData.entries())

      await erpFetch('inventory/units/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      setSuccess(true)
      setTimeout(() => router.push('/inventory/units'), 500)
    } catch (err: any) {
      setError(err.message || 'Failed to create item')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen layout-container-padding theme-bg">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="h-9 px-3"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        <div>
          <h1 className="text-3xl md:text-4xl font-black theme-text">
            Create Units
          </h1>
          <p className="theme-text-muted mt-1">
            Add a new units to the system
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl">
        <div className="bg-app-surface rounded-[32px] shadow-lg border border-app-border p-6 md:p-8">
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50 text-red-800 border border-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-2xl bg-green-50 text-green-800 border border-green-200">
              Item created successfully! Redirecting...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <p>No form fields available</p>
            </div>

            {/* Actions */}
            <div className="flex gap-4 justify-end pt-4 border-t border-app-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={submitting}
                className="h-11 px-6 rounded-xl font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="h-11 px-6 rounded-xl font-bold bg-app-primary hover:bg-app-primary text-app-foreground shadow-lg"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-app-foreground border-t-transparent mr-2" />
                    Creating...
                  </>
                ) : (
                  <>Create Units</>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
