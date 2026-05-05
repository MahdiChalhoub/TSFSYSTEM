"use client"

import React from 'react'
import { useTranslation } from '@/hooks/use-translation'
import { LOCALES, type Locale } from '@/translations/dictionaries'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Languages, Check } from 'lucide-react'

interface LanguageSwitcherProps {
    className?: string
    showLabel?: boolean
}

export function LanguageSwitcher({ className, showLabel = true }: LanguageSwitcherProps) {
    const { locale, switchLocale } = useTranslation()
    const [isOpen, setIsOpen] = React.useState(false)

    const languages = LOCALES

    const currentLang = languages.find(l => l.id === locale) || languages[0]

    return (
        <div className={cn('relative', className)}>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(!isOpen)}
                className="gap-2 px-3 h-9 rounded-lg border-app-border bg-app-surface hover:bg-app-surface-2 transition-all"
            >
                <Languages className="h-4 w-4 text-app-primary" />
                {showLabel && <span className="text-xs font-bold text-app-foreground">{currentLang.name}</span>}
            </Button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown Menu */}
                    <div className="absolute right-0 mt-2 w-48 rounded-xl border border-app-border bg-app-surface shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-app-border bg-app-surface-2/50">
                            <h3 className="text-xs font-black text-app-muted-foreground uppercase tracking-tighter">
                                Language / Langue
                            </h3>
                        </div>

                        {/* Language List */}
                        <div className="p-1">
                            {languages.map((lang) => (
                                <button
                                    key={lang.id}
                                    dir={lang.dir}
                                    onClick={() => {
                                        switchLocale(lang.id as Locale)
                                        setIsOpen(false)
                                    }}
                                    className={cn(
                                        'w-full px-3 py-2.5 flex items-center justify-between rounded-lg hover:bg-app-surface-2 transition-colors text-left',
                                        locale === lang.id && 'bg-app-primary-light/30'
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg">{lang.flag}</span>
                                        <span className={cn(
                                            "text-sm font-medium",
                                            locale === lang.id ? "text-app-primary font-bold" : "text-app-muted-foreground"
                                        )}>
                                            {lang.name}
                                        </span>
                                    </div>
                                    {locale === lang.id && (
                                        <Check className="h-4 w-4 text-app-primary" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
