'use client'

import { useState, useMemo, useCallback, useTransition } from 'react'
import {
    Settings2, Plus, Layers, CheckCircle2, FolderTree,
    CreditCard, Zap, Search,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteAccountCategory } from '../accounts/actions'
import { getIcon, DEFAULT_COLOR } from './_components/constants'
import { CategoryFormModal, type CategoryFormData } from './_components/CategoryFormModal'
import { TreeMasterPage } from '@/components/templates/TreeMasterPage'

import type { AccountCategoryNode, PanelTab } from './components/types'
import { AccountCategoryRow } from './components/AccountCategoryRow'
import { AccountCategoryDetailPanel } from './components/AccountCategoryDetailPanel'

const INITIAL_FORM: CategoryFormData = {
    name: '', code: '', icon: 'wallet', color: 'var(--app-accent)',
    description: '', coa_parent: '', sort_order: 0,
    default_pos_enabled: false, default_has_account_book: false,
    is_digital: false, digital_gateway: '',
}

/* ═══════════════════════════════════════════════════════════
 *  AccountCategoriesClient — thin TreeMasterPage consumer.
 *  The template owns search, KPI filtering, tree build, and
 *  empty-state UI. This file only supplies data + row + modals.
 * ═══════════════════════════════════════════════════════════ */
export function AccountCategoriesClient({
    initialCategories,
    coaList,
    orgGateways,
}: {
    initialCategories: any[]
    coaList: any[]
    orgGateways: any[]
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [editingId, setEditingId] = useState<number | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<AccountCategoryNode | null>(null)
    const [form, setForm] = useState<CategoryFormData>(INITIAL_FORM)

    // Normalize data — add synthetic `parent: null` for TreeMaster
    const data = useMemo(() =>
        initialCategories.map((cat: any) => ({
            ...cat,
            parent: null, // flat list — all root nodes
        })) as AccountCategoryNode[],
        [initialCategories],
    )

    const totalAccounts = useMemo(() =>
        data.reduce((sum, c) => sum + (c.account_count || 0), 0),
        [data],
    )

    // Actions
    const resetForm = useCallback(() => {
        setForm(INITIAL_FORM)
        setShowForm(false)
        setEditingId(null)
    }, [])

    const openAddModal = useCallback(() => {
        setForm(INITIAL_FORM)
        setEditingId(null)
        setShowForm(true)
    }, [])

    const openEditModal = useCallback((cat: AccountCategoryNode) => {
        setForm({
            name: cat.name,
            code: cat.code,
            icon: cat.icon || 'wallet',
            color: cat.color || 'var(--app-accent)',
            description: cat.description || '',
            coa_parent: cat.coa_parent?.toString() || '',
            sort_order: cat.sort_order || 0,
            default_pos_enabled: cat.default_pos_enabled || false,
            default_has_account_book: cat.default_has_account_book || false,
            is_digital: cat.is_digital || false,
            digital_gateway: cat.digital_gateway?.toString() || '',
        })
        setEditingId(cat.id)
        setShowForm(true)
    }, [])

    const requestDelete = useCallback((cat: AccountCategoryNode) => {
        setDeleteTarget(cat)
    }, [])

    const handleSave = async () => {
        if (!form.name || !form.code) {
            toast.error('Name and code are required')
            return
        }
        setSaving(true)
        try {
            const { createAccountCategory, updateAccountCategory } = await import('../accounts/actions')
            const payload: any = {
                name: form.name,
                code: form.code.toUpperCase(),
                icon: form.icon,
                color: form.color,
                description: form.description,
                sort_order: form.sort_order,
                default_pos_enabled: form.default_pos_enabled,
                default_has_account_book: form.default_has_account_book,
                is_digital: form.is_digital,
                digital_gateway: form.is_digital && form.digital_gateway ? parseInt(form.digital_gateway) : null,
            }
            if (form.coa_parent) payload.coa_parent = parseInt(form.coa_parent)
            else payload.coa_parent = null

            if (editingId) {
                await updateAccountCategory(editingId, payload)
                toast.success('Category updated')
            } else {
                await createAccountCategory(payload)
                toast.success('Category created')
            }
            resetForm()
            router.refresh()
        } catch (e: any) {
            toast.error(e?.message || 'Failed to save category')
        }
        setSaving(false)
    }

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return
        const source = deleteTarget
        setDeleteTarget(null)
        startTransition(async () => {
            try {
                await deleteAccountCategory(source.id)
                toast.success(`"${source.name}" deleted`)
                router.refresh()
            } catch (e: any) {
                toast.error(e?.message || 'Cannot delete — has linked accounts')
            }
        })
    }

    return (
        <>
            <TreeMasterPage
                config={{
                    title: 'Account Categories',
                    subtitle: (filtered, all) => `${all.length} Categories · Financial Account Types`,
                    icon: <Settings2 size={20} />,
                    iconColor: 'var(--app-primary)',
                    searchPlaceholder: 'Search by name, code, or description... (Ctrl+K)',
                    primaryAction: {
                        label: 'New Category',
                        icon: <Plus size={14} />,
                        onClick: () => openAddModal(),
                    },
                    columnHeaders: [
                        { label: 'Category', width: 'auto', sortKey: 'name' },
                        { label: 'Code', width: '80px', hideOnMobile: true, sortKey: 'code' },
                        { label: 'Accounts', width: '72px', color: 'var(--app-info)', hideOnMobile: true, sortKey: 'account_count' },
                        { label: 'COA', width: '80px', color: 'var(--app-warning)', hideOnMobile: true, sortKey: 'coa_count' },
                        { label: 'Order', width: '72px', hideOnMobile: true, sortKey: 'sort_order' },
                    ],

                    // ── Template owns filtering ──
                    data: data as unknown as Record<string, unknown>[],
                    searchFields: ['name', 'code', 'description'],
                    kpiPredicates: {
                        active: (c) => !!c.is_active,
                        coa: (c) => !!c.coa_parent,
                        digital: (c) => !!c.is_digital,
                    },

                    kpis: [
                        {
                            label: 'Total', icon: <Layers size={11} />, color: 'var(--app-primary)',
                            filterKey: 'all', hint: 'Show all categories (clear filters)',
                            value: (_, all) => all.length,
                        },
                        {
                            label: 'Active', icon: <CheckCircle2 size={11} />, color: 'var(--app-success)',
                            filterKey: 'active', hint: 'Show only active categories',
                            value: (filtered) => filtered.filter((c: any) => c.is_active).length,
                        },
                        {
                            label: 'COA Linked', icon: <FolderTree size={11} />, color: 'var(--app-warning)',
                            filterKey: 'coa', hint: 'Show only categories with COA parent',
                            value: (filtered) => filtered.filter((c: any) => c.coa_parent).length,
                        },
                        {
                            label: 'Accounts', icon: <CreditCard size={11} />, color: 'var(--app-info)',
                            value: (filtered) => filtered.reduce((sum: number, c: any) => sum + (c.account_count || 0), 0),
                        },
                        {
                            label: 'Digital', icon: <Zap size={11} />, color: 'var(--app-accent)',
                            filterKey: 'digital', hint: 'Show only digital categories',
                            value: (filtered) => filtered.filter((c: any) => c.is_digital).length,
                        },
                        {
                            label: 'Showing', icon: <Search size={11} />, color: 'var(--app-muted-foreground)',
                            value: (filtered, all) => filtered.length < all.length ? `${filtered.length}/${all.length}` : all.length,
                        },
                    ],
                    emptyState: {
                        icon: <Settings2 size={36} />,
                        title: (hasSearch) => hasSearch ? 'No matching categories' : 'No categories defined yet',
                        subtitle: (hasSearch) => hasSearch
                            ? 'Try a different search term or clear filters.'
                            : 'Create your first category to organize financial accounts.',
                        actionLabel: 'Create First Category',
                    },
                    dataTools: {
                        title: 'Account Category Data',
                        exportFilename: 'account-categories',
                        exportColumns: [
                            { key: 'name', label: 'Name' },
                            { key: 'code', label: 'Code', format: (c: any) => c.code || '' },
                            { key: 'description', label: 'Description', format: (c: any) => c.description || '' },
                            { key: 'account_count', label: 'Accounts', format: (c: any) => c.account_count || 0 },
                            { key: 'is_active', label: 'Active', format: (c: any) => c.is_active ? 'Yes' : 'No' },
                            { key: 'coa_parent_code', label: 'COA Code', format: (c: any) => c.coa_parent_code || '' },
                            { key: 'coa_parent_name', label: 'COA Name', format: (c: any) => c.coa_parent_name || '' },
                            { key: 'sort_order', label: 'Sort Order', format: (c: any) => c.sort_order || 0 },
                        ],
                    },
                    auditTrail: {
                        endpoint: 'audit-trail',
                        resourceType: 'accountcategory',
                        title: 'Account Category Audit Trail',
                    },
                    footerLeft: (_, all) => (
                        <div className="flex items-center gap-3 flex-wrap">
                            <span>{all.length} categories</span>
                            <span style={{ color: 'var(--app-border)' }}>·</span>
                            <span>{totalAccounts.toLocaleString()} linked accounts</span>
                        </div>
                    ),
                }}
                modals={
                    <>
                        {showForm && (
                            <CategoryFormModal
                                form={form}
                                setForm={setForm}
                                coaList={coaList}
                                editingId={editingId}
                                saving={saving}
                                onSave={handleSave}
                                onClose={resetForm}
                                orgGateways={orgGateways}
                            />
                        )}
                        <ConfirmDialog
                            open={deleteTarget !== null}
                            onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
                            onConfirm={handleConfirmDelete}
                            title={`Delete "${deleteTarget?.name}"?`}
                            description="Only empty categories (no linked accounts) can be deleted. Move accounts to another category first."
                            confirmText="Delete"
                            variant="danger"
                        />
                    </>
                }
                detailPanel={(node, { tab, onClose, onPin }) => (
                    <AccountCategoryDetailPanel
                        node={node as AccountCategoryNode}
                        onEdit={openEditModal}
                        onDelete={requestDelete}
                        onClose={onClose}
                        onPin={onPin ? (n) => onPin(n) : undefined}
                        orgGateways={orgGateways}
                    />
                )}
            >
                {(renderProps) => {
                    const { tree, searchQuery, isSelected, openNode, isCompact } = renderProps
                    return tree.map((node: AccountCategoryNode) => (
                        <div key={node.id}
                            className={`rounded-xl transition-all duration-300 ${isSelected(node) ? 'ring-2 ring-app-primary/40 bg-app-primary/[0.03] shadow-sm' : ''}`}>
                            <AccountCategoryRow
                                node={node}
                                onEdit={openEditModal}
                                onDelete={requestDelete}
                                onSelect={(n) => openNode(n, 'overview')}
                                searchQuery={searchQuery}
                                compact={isCompact}
                            />
                        </div>
                    ))
                }}
            </TreeMasterPage>
        </>
    )
}
