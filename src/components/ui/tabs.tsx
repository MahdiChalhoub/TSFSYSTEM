'use client'

import React, { createContext, useContext, useState } from 'react'

// ── Context ──────────────────────────────────────────────────────────────────
interface TabsContextType {
    value: string
    onValueChange: (value: string) => void
}

const TabsContext = createContext<TabsContextType>({ value: '', onValueChange: () => { } })

// ── Tabs Root ────────────────────────────────────────────────────────────────
interface TabsProps {
    defaultValue?: string
    value?: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
    className?: string
}

export function Tabs({ defaultValue = '', value, onValueChange, children, className = '' }: TabsProps) {
    const [internalValue, setInternalValue] = useState(defaultValue)
    const currentValue = value ?? internalValue
    const handleChange = onValueChange ?? setInternalValue

    return (
        <TabsContext.Provider value={{ value: currentValue, onValueChange: handleChange }}>
            <div className={className}>{children}</div>
        </TabsContext.Provider>
    )
}

// ── Tabs List ────────────────────────────────────────────────────────────────
interface TabsListProps {
    children: React.ReactNode
    className?: string
}

export function TabsList({ children, className = '' }: TabsListProps) {
    return (
        <div
            role="tablist"
            className={`inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground ${className}`}
        >
            {children}
        </div>
    )
}

// ── Tabs Trigger ─────────────────────────────────────────────────────────────
interface TabsTriggerProps {
    value: string
    children: React.ReactNode
    className?: string
}

export function TabsTrigger({ value, children, className = '' }: TabsTriggerProps) {
    const { value: currentValue, onValueChange } = useContext(TabsContext)
    const isActive = currentValue === value

    return (
        <button
            role="tab"
            aria-selected={isActive}
            onClick={() => onValueChange(value)}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${isActive
                    ? 'bg-background text-foreground shadow-sm'
                    : 'hover:bg-background/50 hover:text-foreground'
                } ${className}`}
        >
            {children}
        </button>
    )
}

// ── Tabs Content ─────────────────────────────────────────────────────────────
interface TabsContentProps {
    value: string
    children: React.ReactNode
    className?: string
}

export function TabsContent({ value, children, className = '' }: TabsContentProps) {
    const { value: currentValue } = useContext(TabsContext)

    if (currentValue !== value) return null

    return (
        <div
            role="tabpanel"
            className={`mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`}
        >
            {children}
        </div>
    )
}
