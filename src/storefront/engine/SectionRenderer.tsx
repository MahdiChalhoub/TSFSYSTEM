'use client'

import React, { useMemo } from 'react'
import type { StorefrontPageLayout, ThemeComponents, Product, Category } from './types'

interface SectionRendererProps {
    layout: StorefrontPageLayout
    themeComponents: ThemeComponents
    sectionsRegistry: Record<string, React.ComponentType<any>>
    products: Product[]
    categories: Category[]
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
    categories
}: SectionRendererProps) {
    if (!layout?.sections) return null

    return (
        <div className="section-engine">
            {layout.sections.map((sectionConfig) => {
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
                    />
                )
            })}
        </div>
    )
}
