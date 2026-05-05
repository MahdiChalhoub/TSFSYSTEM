'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    BookOpen, CheckCircle2, ChevronRight, ArrowLeft, ArrowRight,
    FileSpreadsheet, Settings, Shield, AlertTriangle, Loader2,
    Database, Sparkles, ListChecks, GitMerge, RefreshCw, Trash2
} from 'lucide-react'
import { COASetupState, updateCOASetupStatus, completeCOASetup } from '@/app/actions/finance/coa-setup'
import { importChartOfAccountsTemplate } from '@/app/actions/finance/coa-templates'

const STEPS = [
    { id: 'template', label: 'Select Template', icon: BookOpen, description: 'Choose your Chart of Accounts standard' },
    { id: 'import', label: 'Import COA', icon: Database, description: 'Install template accounts into your ledger' },
    { id: 'posting', label: 'Posting Rules', icon: Settings, description: 'Map accounts to financial operations' },
    { id: 'complete', label: 'Finalize', icon: Shield, description: 'Verify & activate your chart of accounts' },
] as const

const TEMPLATES = [
    { key: 'ifrs', name: 'IFRS Standard', description: 'International Financial Reporting Standards — used worldwide', region: '🌍 International', accounts: '~65 accounts' },
    { key: 'syscohada', name: 'SYSCOHADA / OHADA', description: 'Système Comptable OHADA — Central & West Africa', region: '🌍 Africa (OHADA)', accounts: '~90 accounts' },
    { key: 'pcg', name: 'French PCG', description: 'Plan Comptable Général — France standard', region: '🇫🇷 France', accounts: '~85 accounts' },
    { key: 'pcn_liban', name: 'Lebanese PCN', description: 'Plan Comptable National — Lebanon standard', region: '🇱🇧 Lebanon', accounts: '~80 accounts' },
    { key: 'us_gaap', name: 'US GAAP', description: 'Generally Accepted Accounting Principles — United States', region: '🇺🇸 United States', accounts: '~60 accounts' },
]

type ImportMode = 'merge' | 'fresh' | 'migrate'

function stepIndex(status: COASetupState['status']): number {
    switch (status) {
        case 'NOT_STARTED': return 0
        case 'TEMPLATE_SELECTED': return 1
        case 'TEMPLATE_IMPORTED': return 2
        case 'MIGRATION_PENDING': return 2
        case 'POSTING_RULES_PENDING': return 2
        case 'COMPLETED': return 3
        default: return 0
    }
}

export function COASetupWizard({ initialState, existingAccountCount = 0 }: { initialState: COASetupState; existingAccountCount?: number }) {
    const [state, setState] = useState(initialState)
    const [currentStep, setCurrentStep] = useState(stepIndex(initialState.status))
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(initialState.selectedTemplate)
    const [importMode, setImportMode] = useState<ImportMode>(existingAccountCount > 0 ? 'merge' : 'fresh')
    const [isPending, startTransition] = useTransition()
    const [importError, setImportError] = useState<string | null>(null)
    const router = useRouter()

    const hasExistingAccounts = existingAccountCount > 0

    const handleSelectTemplate = (key: string) => {
        setSelectedTemplate(key)
        toast.success(`Selected: ${TEMPLATES.find(t => t.key === key)?.name}`)
    }

    const handleImportTemplate = () => {
        if (!selectedTemplate) {
            toast.error('Please select a template first')
            return
        }
        setImportError(null)
        startTransition(async () => {
            try {
                await updateCOASetupStatus({ status: 'TEMPLATE_SELECTED', selectedTemplate })

                if (importMode === 'migrate') {
                    await updateCOASetupStatus({ status: 'MIGRATION_PENDING', migrationNeeded: true })
                    router.push('/finance/chart-of-accounts/migrate?from=setup&template=' + selectedTemplate)
                    return
                }

                const result = await importChartOfAccountsTemplate(selectedTemplate, { reset: importMode === 'fresh' })
                // The action throws on failure; the early-return path for
                // {success:false} stays as a defensive guard for future shape
                // changes.
                const r = result as { success?: boolean; message?: string } | null
                if (r && r.success === false) {
                    setImportError(r.message || 'Import failed')
                    toast.error('Import failed: ' + (r.message || 'Unknown error'))
                    return
                }

                // Note: applySmartPostingRules is already called inside importChartOfAccountsTemplate
                // so we do NOT call it again here.

                await updateCOASetupStatus({
                    status: 'TEMPLATE_IMPORTED',
                    importedAt: new Date().toISOString(),
                })
                setState(prev => ({
                    ...prev,
                    status: 'TEMPLATE_IMPORTED',
                    selectedTemplate,
                    importedAt: new Date().toISOString(),
                }))
                toast.success('Template imported & posting rules auto-mapped!')
                setCurrentStep(2)
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Unknown error'
                setImportError(msg)
                toast.error('Import failed: ' + msg)
            }
        })
    }

    const handleConfigurePostingRules = () => {
        startTransition(async () => {
            await updateCOASetupStatus({ status: 'POSTING_RULES_PENDING' })
            router.push('/finance/settings/posting-rules?from=setup')
        })
    }

    const handleComplete = () => {
        startTransition(async () => {
            await completeCOASetup()
            setState(prev => ({ ...prev, status: 'COMPLETED', completedAt: new Date().toISOString() }))
            toast.success('🎉 COA Setup Complete! Your finance module is now active.')
            setCurrentStep(3)
        })
    }

    const handleReopen = () => {
        startTransition(async () => {
            await updateCOASetupStatus({ status: 'POSTING_RULES_PENDING', completedAt: null })
            setState(prev => ({ ...prev, status: 'POSTING_RULES_PENDING', completedAt: null }))
            setCurrentStep(2)
            toast.info('Setup reopened. Make your changes and finalize again.')
        })
    }

    return (
        <div className="app-page p-6 space-y-8 max-w-5xl mx-auto">
            {/* Header */}
            <header className="text-center space-y-2 fade-in-up">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
                    style={{ background: 'var(--app-primary)15', border: '1px solid var(--app-primary)30' }}>
                    <Sparkles size={30} style={{ color: 'var(--app-primary)' }} />
                </div>
                <h1 style={{ color: 'var(--app-foreground)' }}>
                    Chart of Accounts Setup
                </h1>
                <p className="text-sm" style={{ color: 'var(--app-muted-foreground)' }}>
                    Configure your financial foundation in 4 simple steps
                </p>
            </header>

            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-2 fade-in-up" style={{ animationDelay: '100ms' }}>
                {STEPS.map((step, idx) => {
                    const StepIcon = step.icon
                    const isActive = idx === currentStep
                    const isDone = idx < currentStep || (idx === 3 && state.status === 'COMPLETED')
                    return (
                        <div key={step.id} className="flex items-center gap-2">
                            <button
                                onClick={() => idx <= currentStep && setCurrentStep(idx)}
                                disabled={idx > currentStep}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300"
                                style={{
                                    background: isActive ? 'var(--app-primary)' : isDone ? 'var(--app-success)20' : 'var(--app-card)',
                                    color: isActive ? 'white' : isDone ? 'var(--app-success)' : 'var(--app-muted-foreground)',
                                    border: `1px solid ${isActive ? 'var(--app-primary)' : isDone ? 'var(--app-success)40' : 'var(--app-border)'}`,
                                    opacity: idx > currentStep ? 0.5 : 1,
                                    cursor: idx <= currentStep ? 'pointer' : 'not-allowed',
                                }}
                            >
                                {isDone && !isActive ? <CheckCircle2 size={16} /> : <StepIcon size={16} />}
                                <span className="text-sm font-semibold hidden sm:inline">{step.label}</span>
                            </button>
                            {idx < STEPS.length - 1 && (
                                <ChevronRight size={16} style={{ color: 'var(--app-muted-foreground)', opacity: 0.4 }} />
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Step Content */}
            <div className="rounded-2xl p-8 fade-in-up" style={{
                background: 'var(--app-card)',
                border: '1px solid var(--app-border)',
                animationDelay: '200ms',
            }}>
                {/* ─── Step 0: Select Template ─── */}
                {currentStep === 0 && (
                    <div className="space-y-6">
                        <div>
                            <h2 style={{ color: 'var(--app-foreground)' }}>Choose Your Chart of Accounts Template</h2>
                            <p className="text-sm mt-1" style={{ color: 'var(--app-muted-foreground)' }}>Select the accounting standard that matches your country and regulations.</p>
                        </div>
                        <div className="grid gap-3">
                            {TEMPLATES.map(tmpl => (
                                <button key={tmpl.key} onClick={() => handleSelectTemplate(tmpl.key)}
                                    className="flex items-center gap-4 p-4 rounded-xl text-left transition-all duration-200"
                                    style={{
                                        background: selectedTemplate === tmpl.key ? 'var(--app-primary)10' : 'var(--app-background)',
                                        border: `2px solid ${selectedTemplate === tmpl.key ? 'var(--app-primary)' : 'var(--app-border)'}`,
                                    }}>
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-2xl"
                                        style={{ background: 'var(--app-card)', border: '1px solid var(--app-border)' }}>
                                        {tmpl.region.split(' ')[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold" style={{ color: 'var(--app-foreground)' }}>{tmpl.name}</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--app-muted)30', color: 'var(--app-muted-foreground)' }}>{tmpl.accounts}</span>
                                        </div>
                                        <p className="text-sm" style={{ color: 'var(--app-muted-foreground)' }}>{tmpl.description}</p>
                                    </div>
                                    {selectedTemplate === tmpl.key && <CheckCircle2 size={22} style={{ color: 'var(--app-primary)' }} />}
                                </button>
                            ))}
                        </div>
                        <div className="flex justify-end">
                            <button disabled={!selectedTemplate} onClick={() => setCurrentStep(1)}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all"
                                style={{
                                    background: selectedTemplate ? 'var(--app-primary)' : 'var(--app-muted)',
                                    color: selectedTemplate ? 'white' : 'var(--app-muted-foreground)',
                                    opacity: selectedTemplate ? 1 : 0.5,
                                    cursor: selectedTemplate ? 'pointer' : 'not-allowed',
                                }}>
                                Continue <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── Step 1: Import ─── */}
                {currentStep === 1 && (
                    <div className="space-y-6">
                        <div>
                            <h2 style={{ color: 'var(--app-foreground)' }}>
                                Import: {TEMPLATES.find(t => t.key === selectedTemplate)?.name}
                            </h2>
                            <p className="text-sm mt-1" style={{ color: 'var(--app-muted-foreground)' }}>
                                {hasExistingAccounts
                                    ? `You have ${existingAccountCount} existing accounts. Choose how to proceed.`
                                    : 'This will install the template accounts into your ledger and auto-map posting rules.'}
                            </p>
                        </div>

                        {hasExistingAccounts ? (
                            <div className="grid gap-3">
                                {/* Merge Option */}
                                <button onClick={() => setImportMode('merge')}
                                    className="flex items-start gap-4 p-4 rounded-xl text-left transition-all"
                                    style={{ background: importMode === 'merge' ? 'var(--app-success)08' : 'var(--app-background)', border: `2px solid ${importMode === 'merge' ? 'var(--app-success)' : 'var(--app-border)'}` }}>
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--app-success)15' }}>
                                        <GitMerge size={20} style={{ color: 'var(--app-success)' }} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold" style={{ color: 'var(--app-foreground)' }}>Merge (Recommended)</span>
                                            {importMode === 'merge' && <CheckCircle2 size={16} style={{ color: 'var(--app-success)' }} />}
                                        </div>
                                        <p className="text-sm mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>
                                            Keep your {existingAccountCount} existing accounts. Add only the missing template accounts. No data loss — your balances and journal entries are preserved.
                                        </p>
                                    </div>
                                </button>
                                {/* Migrate Option */}
                                <button onClick={() => setImportMode('migrate')}
                                    className="flex items-start gap-4 p-4 rounded-xl text-left transition-all"
                                    style={{ background: importMode === 'migrate' ? 'var(--app-info)08' : 'var(--app-background)', border: `2px solid ${importMode === 'migrate' ? 'var(--app-info)' : 'var(--app-border)'}` }}>
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--app-info)15' }}>
                                        <RefreshCw size={20} style={{ color: 'var(--app-info)' }} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold" style={{ color: 'var(--app-foreground)' }}>Migrate</span>
                                            {importMode === 'migrate' && <CheckCircle2 size={16} style={{ color: 'var(--app-info)' }} />}
                                        </div>
                                        <p className="text-sm mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>
                                            Open the migration tool to map your old accounts to the new template. Balances will be transferred to the correct new accounts.
                                        </p>
                                    </div>
                                </button>
                                {/* Fresh Start Option */}
                                <button onClick={() => setImportMode('fresh')}
                                    className="flex items-start gap-4 p-4 rounded-xl text-left transition-all"
                                    style={{ background: importMode === 'fresh' ? 'var(--app-destructive)08' : 'var(--app-background)', border: `2px solid ${importMode === 'fresh' ? 'var(--app-destructive)' : 'var(--app-border)'}` }}>
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--app-destructive)15' }}>
                                        <Trash2 size={20} style={{ color: 'var(--app-destructive)' }} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold" style={{ color: 'var(--app-foreground)' }}>Fresh Start</span>
                                            {importMode === 'fresh' && <CheckCircle2 size={16} style={{ color: 'var(--app-destructive)' }} />}
                                        </div>
                                        <p className="text-sm mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>
                                            Delete all existing accounts and replace with the template.
                                            <strong style={{ color: 'var(--app-destructive)' }}> Warning: All existing data will be lost.</strong>
                                        </p>
                                    </div>
                                </button>
                            </div>
                        ) : (
                            <div className="p-5 rounded-xl space-y-3" style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                                <h3 style={{ color: 'var(--app-foreground)' }}>What will happen:</h3>
                                <ul className="space-y-2 text-sm" style={{ color: 'var(--app-muted-foreground)' }}>
                                    <li className="flex items-center gap-2"><CheckCircle2 size={14} style={{ color: 'var(--app-success)' }} /> Template accounts will be imported into your COA</li>
                                    <li className="flex items-center gap-2"><CheckCircle2 size={14} style={{ color: 'var(--app-success)' }} /> Smart posting rules will be auto-detected and mapped</li>
                                    <li className="flex items-center gap-2"><CheckCircle2 size={14} style={{ color: 'var(--app-success)' }} /> System accounts will be created (rounding, suspense, clearing)</li>
                                </ul>
                            </div>
                        )}

                        {importError && (
                            <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: 'var(--app-destructive)10', border: '1px solid var(--app-destructive)30' }}>
                                <AlertTriangle size={18} style={{ color: 'var(--app-destructive)', marginTop: 2, flexShrink: 0 }} />
                                <div className="text-sm" style={{ color: 'var(--app-foreground)' }}><strong>Error:</strong> {importError}</div>
                            </div>
                        )}

                        <div className="flex justify-between">
                            <button onClick={() => setCurrentStep(0)}
                                className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                <ArrowLeft size={16} /> Back
                            </button>
                            <button onClick={handleImportTemplate} disabled={isPending}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all"
                                style={{ background: (hasExistingAccounts && importMode === 'fresh') ? 'var(--app-destructive)' : 'var(--app-primary)', color: 'white', opacity: isPending ? 0.7 : 1 }}>
                                {isPending ? <Loader2 size={16} className="animate-spin" /> :
                                    importMode === 'merge' ? <GitMerge size={16} /> :
                                        importMode === 'migrate' ? <RefreshCw size={16} /> : <Database size={16} />}
                                {isPending ? 'Processing...' :
                                    importMode === 'merge' ? 'Merge & Auto-Map' :
                                        importMode === 'migrate' ? 'Open Migration Tool' :
                                            hasExistingAccounts ? 'Reset & Import' : 'Import & Auto-Map'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── Step 2: Posting Rules ─── */}
                {currentStep === 2 && (
                    <div className="space-y-6">
                        <div>
                            <h2 style={{ color: 'var(--app-foreground)' }}>Review & Configure Posting Rules</h2>
                            <p className="text-sm mt-1" style={{ color: 'var(--app-muted-foreground)' }}>Posting rules have been auto-mapped. Review them and make any adjustments.</p>
                        </div>
                        {state.importedAt && (
                            <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: 'var(--app-success)10', border: '1px solid var(--app-success)30' }}>
                                <CheckCircle2 size={20} style={{ color: 'var(--app-success)', marginTop: 2, flexShrink: 0 }} />
                                <div className="text-sm" style={{ color: 'var(--app-foreground)' }}>
                                    <strong>Template imported successfully</strong> ({TEMPLATES.find(t => t.key === state.selectedTemplate)?.name})
                                    <br /><span style={{ color: 'var(--app-muted-foreground)' }}>Imported at {new Date(state.importedAt).toLocaleString()}</span>
                                </div>
                            </div>
                        )}
                        <div className="p-5 rounded-xl space-y-3" style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                            <h3 style={{ color: 'var(--app-foreground)' }}>Required actions:</h3>
                            <ul className="space-y-2 text-sm" style={{ color: 'var(--app-muted-foreground)' }}>
                                <li className="flex items-center gap-2"><ListChecks size={14} style={{ color: 'var(--app-info)' }} /> Review auto-mapped posting rules</li>
                                <li className="flex items-center gap-2"><ListChecks size={14} style={{ color: 'var(--app-info)' }} /> Fill in any unmapped rules (shown as &quot;Not Mapped&quot;)</li>
                                <li className="flex items-center gap-2"><ListChecks size={14} style={{ color: 'var(--app-info)' }} /> Save your configuration</li>
                            </ul>
                        </div>
                        <div className="flex justify-between">
                            <button onClick={() => setCurrentStep(1)}
                                className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                <ArrowLeft size={16} /> Back
                            </button>
                            <div className="flex gap-3">
                                <button onClick={handleConfigurePostingRules} disabled={isPending}
                                    className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                    <Settings size={16} /> Open Posting Rules
                                </button>
                                <button onClick={() => setCurrentStep(3)}
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all"
                                    style={{ background: 'var(--app-primary)', color: 'white' }}>
                                    Continue <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── Step 3: Finalize ─── */}
                {currentStep === 3 && (
                    <div className="space-y-6">
                        {state.status === 'COMPLETED' ? (
                            <>
                                <div className="text-center space-y-4 py-6">
                                    <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
                                        style={{ background: 'var(--app-success)15', border: '2px solid var(--app-success)40' }}>
                                        <CheckCircle2 size={40} style={{ color: 'var(--app-success)' }} />
                                    </div>
                                    <h2 style={{ color: 'var(--app-foreground)' }}>Setup Complete! 🎉</h2>
                                    <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--app-muted-foreground)' }}>Your Chart of Accounts is fully configured. All finance operations are now enabled.</p>
                                    {state.completedAt && <p className="text-xs" style={{ color: 'var(--app-muted-foreground)' }}>Completed: {new Date(state.completedAt).toLocaleString()}</p>}
                                </div>
                                <div className="flex justify-center gap-3">
                                    <button onClick={() => router.push('/finance/chart-of-accounts')}
                                        className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all"
                                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                        <FileSpreadsheet size={16} /> View COA
                                    </button>
                                    <button onClick={() => router.push('/finance/settings/posting-rules')}
                                        className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all"
                                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                        <Settings size={16} /> Edit Posting Rules
                                    </button>
                                    <button onClick={handleReopen} disabled={isPending}
                                        className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all"
                                        style={{ background: 'var(--app-warning)15', border: '1px solid var(--app-warning)40', color: 'var(--app-warning)' }}>
                                        <AlertTriangle size={16} /> Reopen Setup
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <h2 style={{ color: 'var(--app-foreground)' }}>Finalize Setup</h2>
                                    <p className="text-sm mt-1" style={{ color: 'var(--app-muted-foreground)' }}>Confirm that your COA and posting rules are correctly configured to activate the finance module.</p>
                                </div>
                                <div className="p-5 rounded-xl space-y-3" style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                                    <h3 style={{ color: 'var(--app-foreground)' }}>Setup Summary:</h3>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div className="flex items-center gap-2" style={{ color: state.selectedTemplate ? 'var(--app-success)' : 'var(--app-destructive)' }}>
                                            {state.selectedTemplate ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                                            Template: {state.selectedTemplate ? TEMPLATES.find(t => t.key === state.selectedTemplate)?.name : 'Not selected'}
                                        </div>
                                        <div className="flex items-center gap-2" style={{ color: state.importedAt ? 'var(--app-success)' : 'var(--app-destructive)' }}>
                                            {state.importedAt ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                                            Import: {state.importedAt ? 'Done' : 'Pending'}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: 'var(--app-info)10', border: '1px solid var(--app-info)30' }}>
                                    <Shield size={20} style={{ color: 'var(--app-info)', marginTop: 2, flexShrink: 0 }} />
                                    <div className="text-sm" style={{ color: 'var(--app-foreground)' }}>
                                        <strong>What happens when you finalize:</strong><br />
                                        All finance operations (journal entries, payments, invoices) will become available. You can always come back to modify posting rules later.
                                    </div>
                                </div>
                                <div className="flex justify-between">
                                    <button onClick={() => setCurrentStep(2)}
                                        className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all"
                                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                        <ArrowLeft size={16} /> Back
                                    </button>
                                    <button onClick={handleComplete} disabled={isPending || !state.importedAt}
                                        className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-lg transition-all"
                                        style={{ background: state.importedAt ? 'var(--app-success)' : 'var(--app-muted)', color: 'white', opacity: state.importedAt ? 1 : 0.5 }}>
                                        {isPending ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />}
                                        {isPending ? 'Finalizing...' : 'Activate Finance Module'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
