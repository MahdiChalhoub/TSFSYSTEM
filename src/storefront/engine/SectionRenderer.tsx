'use client'

import React, { useMemo } from 'react'
import type { ThemeComponents, Product, Category } from './types'

// Local type definitions for section engine types not yet in the types file
interface SectionConfig {
    id: string
    type: string
    settings?: Record<string, any>
}

interface StorefrontPageLayout {
    sections: SectionConfig[]
}

interface Brand {
    id: string
    name: string
    logo?: string
    [key: string]: any
}

interface SectionRendererProps {
    layout: StorefrontPageLayout
    themeComponents: ThemeComponents
    sectionsRegistry: Record<string, React.ComponentType<any>>
    products: Product[]
    categories: Category[]
    brands: Brand[]
}

/**
 * SectionRenderer — The heart of the Section Engine.
 * Dynamically renders components based on the provided layout.
 */
export function SectionRenderer({
    layout,
    themeComponents,
    sectionsRegistry,
    products,
    categories,
    brands
}: SectionRendererProps) {
    if (!layout?.sections) return null

    return (
        <div className="section-engine">
            {layout.sections.map((sectionConfig: SectionConfig) => {
                const Component = sectionsRegistry[sectionConfig.type]

                if (!Component) {
                    console.warn(`[SectionRenderer] Unknown section type: ${sectionConfig.type}`)
                    return null
                }

                return (
                    <Component
                        key={sectionConfig.id}
                        id={sectionConfig.id}
                        settings={sectionConfig.settings}
                        products={products}
                        categories={categories}
                        brands={brands}
                    />
                )
            })}
        </div>
    )
}
