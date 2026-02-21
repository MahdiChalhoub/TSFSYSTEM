"use client"

import { useState, useCallback } from "react"

type ToastVariant = "default" | "destructive"

interface Toast {
    id: string
    title?: string
    description?: string
    variant?: ToastVariant
}

interface ToastOptions {
    title?: string
    description?: string
    variant?: ToastVariant
}

export function useToast() {
    const [toasts, setToasts] = useState<Toast[]>([])

    const toast = useCallback((options: ToastOptions) => {
        const id = Math.random().toString(36).slice(2, 9)
        const newToast: Toast = { id, ...options }
        setToasts((prev) => [...prev, newToast])

        // Auto-dismiss after 3 seconds
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id))
        }, 3000)

        // Also log to console for visibility
        if (options.variant === "destructive") {
            console.error(`[Toast] ${options.title}: ${options.description}`)
        } else {
            console.log(`[Toast] ${options.title}: ${options.description}`)
        }

        return newToast
    }, [])

    const dismiss = useCallback((toastId?: string) => {
        setToasts((prev) =>
            toastId ? prev.filter((t) => t.id !== toastId) : []
        )
    }, [])

    return { toast, toasts, dismiss }
}
