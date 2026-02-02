'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { getTenantContext } from '@/lib/erp-api'
import { applySmartPostingRules } from './posting-rules'

type TemplateAccount = {
    code: string
    name: string
    type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'
    subType?: string
    syscohadaCode?: string
    syscohadaClass?: string
    isSystemOnly?: boolean
    isHidden?: boolean
    requiresZeroBalance?: boolean
    children?: TemplateAccount[]
}

const LEBANESE_PCN: TemplateAccount[] = [
    {
        code: '1', name: 'Capitaux et Passif Non Courant', type: 'EQUITY', children: [
            { code: '10', name: 'Capital', type: 'EQUITY' },
            { code: '11', name: 'Reserves', type: 'EQUITY' },
            { code: '12', name: 'Resultat reporté', type: 'EQUITY' },
            { code: '13', name: 'Resultat de l\'exercice', type: 'EQUITY' },
        ]
    },
    {
        code: '2', name: 'Actif Non Courant (Immobilisations)', type: 'ASSET', children: [
            { code: '21', name: 'Immobilisations Incorporelles', type: 'ASSET' },
            { code: '22', name: 'Immobilisations Corporelles', type: 'ASSET' },
            { code: '24', name: 'Immobilisations Financières', type: 'ASSET' },
        ]
    },
    {
        code: '3', name: 'Stocks et En-cours', type: 'ASSET', children: [
            { code: '31', name: 'Marchandises', type: 'ASSET' },
            { code: '32', name: 'Matières Premières', type: 'ASSET' },
        ]
    },
    {
        code: '4', name: 'Comptes de Tiers', type: 'LIABILITY', children: [
            { code: '40', name: 'Fournisseurs', type: 'LIABILITY', subType: 'PAYABLE' },
            { code: '41', name: 'Clients (Créances)', type: 'ASSET', subType: 'RECEIVABLE' },
            { code: '42', name: 'Personnel', type: 'LIABILITY' },
            { code: '43', name: 'Organismes Sociaux', type: 'LIABILITY' },
            { code: '44', name: 'Etat et Collectivités Publiques', type: 'LIABILITY' },
        ]
    },
    {
        code: '5', name: 'Comptes Financiers', type: 'ASSET', children: [
            { code: '51', name: 'Banques', type: 'ASSET', subType: 'BANK' },
            { code: '53', name: 'Caisse', type: 'ASSET', subType: 'CASH' },
        ]
    },
    {
        code: '6', name: 'Comptes de Charges', type: 'EXPENSE', children: [
            { code: '60', name: 'Achats', type: 'EXPENSE' },
            { code: '61', name: 'Services Extérieurs', type: 'EXPENSE' },
            { code: '62', name: 'Autres Services Extérieurs', type: 'EXPENSE' },
            { code: '63', name: 'Impôts et Taxes', type: 'EXPENSE' },
            { code: '64', name: 'Charges de Personnel', type: 'EXPENSE' },
            { code: '66', name: 'Charges Financières', type: 'EXPENSE' },
        ]
    },
    {
        code: '7', name: 'Comptes de Produits', type: 'INCOME', children: [
            { code: '70', name: 'Ventes de Marchandises', type: 'INCOME' },
            { code: '71', name: 'Production Vendue', type: 'INCOME' },
            { code: '76', name: 'Produits Financiers', type: 'INCOME' },
            { code: '77', name: 'Produits Exceptionnels', type: 'INCOME' },
        ]
    },
]

const FRENCH_PCG: TemplateAccount[] = [
    { code: '1', name: 'Comptes de capitaux', type: 'EQUITY' },
    { code: '2', name: 'Comptes d\'immobilisations', type: 'ASSET' },
    { code: '3', name: 'Comptes de stocks et d\'en-cours', type: 'ASSET' },
    { code: '4', name: 'Comptes de tiers', type: 'LIABILITY' },
    { code: '5', name: 'Comptes financiers', type: 'ASSET', subType: 'BANK' },
    { code: '6', name: 'Comptes de charges', type: 'EXPENSE' },
    { code: '7', name: 'Comptes de produits', type: 'INCOME' },
]

const USA_GAAP: TemplateAccount[] = [
    {
        code: '1000', name: 'Assets', type: 'ASSET', children: [
            { code: '1100', name: 'Cash and Cash Equivalents', type: 'ASSET', subType: 'CASH' },
            { code: '1200', name: 'Accounts Receivable', type: 'ASSET', subType: 'RECEIVABLE' },
            { code: '1300', name: 'Inventory', type: 'ASSET' },
            { code: '1500', name: 'Fixed Assets', type: 'ASSET' },
        ]
    },
    {
        code: '2000', name: 'Liabilities', type: 'LIABILITY', children: [
            { code: '2100', name: 'Accounts Payable', type: 'LIABILITY', subType: 'PAYABLE' },
            { code: '2200', name: 'Accrued Liabilities', type: 'LIABILITY' },
            { code: '2500', name: 'Long-term Debt', type: 'LIABILITY' },
        ]
    },
    {
        code: '3000', name: 'Equity', type: 'EQUITY', children: [
            { code: '3100', name: 'Owner\'s Capital', type: 'EQUITY' },
            { code: '3200', name: 'Retained Earnings', type: 'EQUITY' },
        ]
    },
    {
        code: '4000', name: 'Revenue', type: 'INCOME', children: [
            { code: '4100', name: 'Sales Revenue', type: 'INCOME' },
            { code: '4500', name: 'Service Revenue', type: 'INCOME' },
        ]
    },
    { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE' },
    {
        code: '6000', name: 'Operating Expenses', type: 'EXPENSE', children: [
            { code: '6100', name: 'Payroll Expenses', type: 'EXPENSE' },
            { code: '6200', name: 'Rent or Lease', type: 'EXPENSE' },
            { code: '6300', name: 'Utilities', type: 'EXPENSE' },
        ]
    },
]

const IFRS_COA: TemplateAccount[] = [
    {
        code: '1000', name: 'ASSETS', type: 'ASSET', children: [
            {
                code: '1100', name: 'Current Assets', type: 'ASSET', children: [
                    {
                        code: '1101', name: 'Cash & Cash Equivalents', type: 'ASSET', children: [
                            { code: '1101.01', name: 'Cash in Hand', type: 'ASSET', subType: 'CASH', syscohadaCode: '57', syscohadaClass: 'Class 5' },
                            { code: '1101.02', name: 'Cash Register (POS)', type: 'ASSET', subType: 'CASH', syscohadaCode: '57', syscohadaClass: 'Class 5' },
                            { code: '1101.03', name: 'Main Bank Account', type: 'ASSET', subType: 'BANK', syscohadaCode: '52', syscohadaClass: 'Class 5' },
                        ]
                    },
                    { code: '1110', name: 'Accounts Receivable', type: 'ASSET', subType: 'RECEIVABLE', syscohadaCode: '41', syscohadaClass: 'Class 4' },
                    { code: '1120', name: 'Inventory', type: 'ASSET', syscohadaCode: '31', syscohadaClass: 'Class 3' },
                    { code: '1130', name: 'Prepaid Expenses', type: 'ASSET', syscohadaCode: '47', syscohadaClass: 'Class 4' },
                    { code: '1140', name: 'Employee Advances', type: 'ASSET', syscohadaCode: '42', syscohadaClass: 'Class 4' },
                    { code: '1150', name: 'Deposits & Guarantees', type: 'ASSET', syscohadaCode: '27', syscohadaClass: 'Class 2' },
                ]
            },
            {
                code: '1200', name: 'Non-Current Assets', type: 'ASSET', children: [
                    { code: '1201', name: 'Land', type: 'ASSET', syscohadaCode: '21', syscohadaClass: 'Class 2' },
                    { code: '1202', name: 'Buildings', type: 'ASSET', syscohadaCode: '23', syscohadaClass: 'Class 2' },
                    { code: '1203', name: 'Furniture & Fixtures', type: 'ASSET', syscohadaCode: '24', syscohadaClass: 'Class 2' },
                    { code: '1204', name: 'Equipment', type: 'ASSET', syscohadaCode: '24', syscohadaClass: 'Class 2' },
                    { code: '1205', name: 'Vehicles', type: 'ASSET', syscohadaCode: '25', syscohadaClass: 'Class 2' },
                    { code: '1206', name: 'Software / Intangible Assets', type: 'ASSET', syscohadaCode: '21', syscohadaClass: 'Class 2' },
                ]
            },
            {
                code: '1210', name: 'Accumulated Depreciation (CONTRA-ASSET)', type: 'ASSET', children: [
                    { code: '1211', name: 'Accumulated Depreciation – Equipment', type: 'ASSET', syscohadaCode: '28', syscohadaClass: 'Class 2' },
                    { code: '1212', name: 'Accumulated Depreciation – Vehicles', type: 'ASSET', syscohadaCode: '28', syscohadaClass: 'Class 2' },
                    { code: '1213', name: 'Accumulated Amortization – Software', type: 'ASSET', syscohadaCode: '28', syscohadaClass: 'Class 2' },
                ]
            }
        ]
    },
    {
        code: '2000', name: 'LIABILITIES', type: 'LIABILITY', children: [
            {
                code: '2100', name: 'Current Liabilities', type: 'LIABILITY', children: [
                    { code: '2101', name: 'Accounts Payable', type: 'LIABILITY', subType: 'PAYABLE', syscohadaCode: '40', syscohadaClass: 'Class 4' },
                    { code: '2102', name: 'Accrued Liabilities (Goods Received Not Invoiced)', type: 'LIABILITY', syscohadaCode: '40', syscohadaClass: 'Class 4' },
                    {
                        code: '2110', name: 'Taxes Payable', type: 'LIABILITY', children: [
                            { code: '2111', name: 'VAT Payable', type: 'LIABILITY', syscohadaCode: '44', syscohadaClass: 'Class 4' },
                            { code: '2112', name: 'Income Tax Payable', type: 'LIABILITY', syscohadaCode: '44', syscohadaClass: 'Class 4' },
                            { code: '2113', name: 'Payroll Tax Payable', type: 'LIABILITY', syscohadaCode: '44', syscohadaClass: 'Class 4' },
                        ]
                    },
                    {
                        code: '2120', name: 'Accrued Expenses', type: 'LIABILITY', children: [
                            { code: '2121', name: 'Salaries Payable', type: 'LIABILITY', syscohadaCode: '42', syscohadaClass: 'Class 4' },
                            { code: '2122', name: 'Rent Payable', type: 'LIABILITY', syscohadaCode: '40', syscohadaClass: 'Class 4' },
                            { code: '2123', name: 'Utilities Payable', type: 'LIABILITY', syscohadaCode: '40', syscohadaClass: 'Class 4' },
                        ]
                    }
                ]
            },
            {
                code: '2200', name: 'Long-Term Liabilities', type: 'LIABILITY', children: [
                    { code: '2201', name: 'Bank Loan', type: 'LIABILITY', syscohadaCode: '16', syscohadaClass: 'Class 1' },
                    { code: '2202', name: 'Lease Liability', type: 'LIABILITY', syscohadaCode: '16', syscohadaClass: 'Class 1' },
                ]
            }
        ]
    },
    {
        code: '3000', name: 'EQUITY', type: 'EQUITY', children: [
            { code: '3001', name: 'Capital', type: 'EQUITY', syscohadaCode: '10', syscohadaClass: 'Class 1' },
            { code: '3002', name: 'Additional Capital', type: 'EQUITY', syscohadaCode: '10', syscohadaClass: 'Class 1' },
            { code: '3003', name: 'Retained Earnings', type: 'EQUITY', syscohadaCode: '11', syscohadaClass: 'Class 1' },
            { code: '3004', name: 'Current Year Profit / Loss', type: 'EQUITY', syscohadaCode: '13', syscohadaClass: 'Class 1' },
        ]
    },
    {
        code: '4000', name: 'REVENUE', type: 'INCOME', children: [
            {
                code: '4100', name: 'Sales Revenue', type: 'INCOME', children: [
                    { code: '4101', name: 'Sales – Cash', type: 'INCOME', syscohadaCode: '70', syscohadaClass: 'Class 7' },
                    { code: '4102', name: 'Sales – Credit', type: 'INCOME', syscohadaCode: '70', syscohadaClass: 'Class 7' },
                    { code: '4103', name: 'Sales – Online', type: 'INCOME', syscohadaCode: '70', syscohadaClass: 'Class 7' },
                ]
            },
            {
                code: '4200', name: 'Other Income', type: 'INCOME', children: [
                    { code: '4201', name: 'Discount Received', type: 'INCOME', syscohadaCode: '77', syscohadaClass: 'Class 7' },
                    { code: '4202', name: 'Interest Income', type: 'INCOME', syscohadaCode: '77', syscohadaClass: 'Class 7' },
                ]
            }
        ]
    },
    {
        code: '5000', name: 'COST OF GOODS SOLD (COGS)', type: 'EXPENSE', children: [
            {
                code: '5100', name: 'Cost of Sales', type: 'EXPENSE', children: [
                    { code: '5101', name: 'Cost of Goods Purchased', type: 'EXPENSE', syscohadaCode: '60', syscohadaClass: 'Class 6' },
                    { code: '5102', name: 'Freight In', type: 'EXPENSE', syscohadaCode: '60', syscohadaClass: 'Class 6' },
                    { code: '5103', name: 'Import Duties', type: 'EXPENSE', syscohadaCode: '60', syscohadaClass: 'Class 6' },
                    { code: '5104', name: 'Inventory Adjustment', type: 'EXPENSE', syscohadaCode: '60', syscohadaClass: 'Class 6' },
                ]
            }
        ]
    },
    {
        code: '6000', name: 'OPERATING EXPENSES', type: 'EXPENSE', children: [
            {
                code: '6100', name: 'Operating Expenses', type: 'EXPENSE', children: [
                    { code: '6101', name: 'Salaries & Wages', type: 'EXPENSE', syscohadaCode: '64', syscohadaClass: 'Class 6' },
                    { code: '6102', name: 'Transport Allowance', type: 'EXPENSE', syscohadaCode: '64', syscohadaClass: 'Class 6' },
                    { code: '6103', name: 'Rent Expense', type: 'EXPENSE', syscohadaCode: '62', syscohadaClass: 'Class 6' },
                    { code: '6104', name: 'Utilities Expense', type: 'EXPENSE', syscohadaCode: '62', syscohadaClass: 'Class 6' },
                    { code: '6105', name: 'Internet & Phone', type: 'EXPENSE', syscohadaCode: '62', syscohadaClass: 'Class 6' },
                    { code: '6106', name: 'Maintenance', type: 'EXPENSE', syscohadaCode: '62', syscohadaClass: 'Class 6' },
                    { code: '6107', name: 'Cleaning', type: 'EXPENSE', syscohadaCode: '62', syscohadaClass: 'Class 6' },
                    { code: '6108', name: 'Security', type: 'EXPENSE', syscohadaCode: '62', syscohadaClass: 'Class 6' },
                ]
            },
            {
                code: '6200', name: 'Administrative Expenses', type: 'EXPENSE', children: [
                    { code: '6201', name: 'Office Supplies', type: 'EXPENSE', syscohadaCode: '60', syscohadaClass: 'Class 6' },
                    { code: '6202', name: 'Software / POS Subscription', type: 'EXPENSE', syscohadaCode: '62', syscohadaClass: 'Class 6' },
                    { code: '6203', name: 'Professional Fees', type: 'EXPENSE', syscohadaCode: '62', syscohadaClass: 'Class 6' },
                ]
            },
            {
                code: '6300', name: 'Financial Expenses', type: 'EXPENSE', children: [
                    { code: '6301', name: 'Bank Charges', type: 'EXPENSE', syscohadaCode: '67', syscohadaClass: 'Class 6' },
                    { code: '6302', name: 'Interest Expense', type: 'EXPENSE', syscohadaCode: '67', syscohadaClass: 'Class 6' },
                    { code: '6303', name: 'Depreciation & Amortization Expense', type: 'EXPENSE', syscohadaCode: '68', syscohadaClass: 'Class 6' },
                ]
            }
        ]
    },
    {
        code: '9000', name: 'SYSTEM & CLEARING ACCOUNTS', type: 'EXPENSE', children: [
            {
                code: '9001', name: 'Stock Adjustment Control', type: 'EXPENSE',
                syscohadaCode: '60', syscohadaClass: 'Class 6',
                isSystemOnly: true, isHidden: true, requiresZeroBalance: true
            },
            {
                code: '9002', name: 'POS Rounding Difference', type: 'INCOME',
                syscohadaCode: '77', syscohadaClass: 'Class 7',
                isSystemOnly: true, isHidden: true
            },
            {
                code: '9003', name: 'Exchange Difference', type: 'INCOME',
                syscohadaCode: '76', syscohadaClass: 'Class 7',
                isSystemOnly: true, isHidden: true
            },
        ]
    }
]

const TEMPLATES = {
    'IFRS_COA': IFRS_COA,
    'LEBANESE_PCN': LEBANESE_PCN,
    'FRENCH_PCG': FRENCH_PCG,
    'USA_GAAP': USA_GAAP
}

export async function importChartOfAccountsTemplate(templateKey: keyof typeof TEMPLATES, options?: { reset?: boolean }) {
    console.log(`[COA_TEMPLATE] Starting import for ${templateKey}, reset=${options?.reset}`)

    try {
        const { erpFetch } = await import('@/lib/erp-api')
        await erpFetch('/api/coa/apply_template/', {
            method: 'POST',
            body: JSON.stringify({
                template_key: templateKey,
                reset: options?.reset || false
            })
        })

        try {
            revalidatePath('/admin/finance/chart-of-accounts')
        } catch (e) {
            // Ignore
        }
        return { success: true }
    } catch (error) {
        console.error(`[COA_TEMPLATE] Import failed:`, error)
        throw error
    }
}

export async function getAllTemplates() {
    return TEMPLATES
}

export async function getTemplatePreview(templateKey: keyof typeof TEMPLATES) {
    return TEMPLATES[templateKey]
}

/**
 * MAPPING TOOL (Advanced)
 * Moves all balances from old accounts to new ones and deactivates old ones.
 */
export async function migrateBalances(data: {
    mappings: { sourceId: number; targetId: number }[]
    description: string
}) {
    console.log(`[COA_MIGRATE] Starting migration: ${data.description}`)
    const tenant = await getTenantContext()
    if (!tenant) throw new Error("No organization context found")

    try {
        return await prisma.$transaction(async (tx) => {
            // 1. Get current balances of all source accounts
            const sourceIds = data.mappings.map(m => m.sourceId)
            const sources = await tx.chartOfAccount.findMany({
                where: { id: { in: sourceIds } }
            })

            const journalLines: any[] = []

            for (const mapping of data.mappings) {
                const source = sources.find(s => s.id === mapping.sourceId)
                if (!source) continue
                const balance = Number(source.balance)

                if (Math.abs(balance) < 0.0001) continue // Skip zero balance accounts

                // Create Reclassification Move
                // To zero out Source: 
                // If Source has Debit (positive), we Credit it and Debit the Target.
                journalLines.push({
                    accountId: mapping.sourceId,
                    debit: balance > 0 ? 0 : Math.abs(balance),
                    credit: balance > 0 ? balance : 0,
                    description: `Migration: Clearing ${source.code}`,
                    organizationId: tenant.id
                })

                journalLines.push({
                    accountId: mapping.targetId,
                    debit: balance > 0 ? balance : 0,
                    credit: balance > 0 ? 0 : Math.abs(balance),
                    description: `Migration: Transfer from ${source.code}`,
                    organizationId: tenant.id
                })
            }

            if (journalLines.length === 0) {
                throw new Error("No non-zero balances found to migrate.")
            }

            // 2. Find Fiscal Year & Period
            const now = new Date()
            const fy = await tx.fiscalYear.findFirst({
                where: { startDate: { lte: now }, endDate: { gte: now } }
            })
            if (!fy) throw new Error("No active Fiscal Year found for migration.")

            const period = await tx.fiscalPeriod.findFirst({
                where: { fiscalYearId: fy.id, startDate: { lte: now }, endDate: { gte: now } }
            })

            // 3. Create the Migration Journal Entry
            const entry = await tx.journalEntry.create({
                data: {
                    transactionDate: now,
                    description: data.description || "COA Layout Migration",
                    reference: "MIGRATION",
                    status: "POSTED",
                    postedAt: now,
                    organizationId: tenant.id,
                    fiscalYearId: fy.id,
                    fiscalPeriodId: period?.id || null,
                    lines: {
                        create: journalLines
                    }
                },
                include: { lines: true }
            })

            // 4. Update Account Balances in DB (Direct precision)
            for (const line of entry.lines) {
                const netChange = Number(line.debit) - Number(line.credit)
                await tx.chartOfAccount.update({
                    where: { id: line.accountId },
                    data: { balance: { increment: netChange } }
                })
            }

            // 5. Deactivate migrated source accounts
            await (tx.chartOfAccount as any).updateMany({
                where: { id: { in: sourceIds } },
                data: { isActive: false }
            })

            // 6. Update Posting Rules to point to new Target IDs
            const setting = await tx.systemSettings.findFirst({
                where: { key: 'finance_posting_rules', organizationId: tenant.id }
            })
            if (setting) {
                let config = JSON.parse(setting.value)
                let changed = false

                // Deep traversal to replace Source IDs with Target IDs
                const updateIds = (obj: any) => {
                    for (const k in obj) {
                        if (typeof obj[k] === 'number') {
                            const match = data.mappings.find(m => m.sourceId === obj[k])
                            if (match) {
                                obj[k] = match.targetId
                                changed = true
                            }
                        } else if (typeof obj[k] === 'object' && obj[k] !== null) {
                            updateIds(obj[k])
                        }
                    }
                }

                updateIds(config)
                if (changed && setting) {
                    await tx.systemSettings.update({
                        where: { id: setting.id },
                        data: { value: JSON.stringify(config) }
                    })
                }
            }

            revalidatePath('/admin/finance/chart-of-accounts')
            revalidatePath('/admin/finance/ledger')
            revalidatePath('/admin/finance/settings/posting-rules')
            return { success: true, entryId: entry.id }
        }, { maxWait: 15000, timeout: 60000 })
    } catch (error) {
        console.error(`[COA_MIGRATE] Migration failed:`, error)
        throw error
    }
}

export async function sweepInactiveBalances(mapping: Record<number, number>) {
    const tenant = await getTenantContext()
    if (!tenant) throw new Error("No organization context found")

    try {
        return await prisma.$transaction(async (tx) => {
            const sourceIds = Object.keys(mapping).map(Number)
            const sources = await tx.chartOfAccount.findMany({
                where: { id: { in: sourceIds } }
            })

            const journalLines: any[] = []
            const now = new Date()

            for (const [sourceIdStr, targetId] of Object.entries(mapping)) {
                const sourceId = Number(sourceIdStr)
                const source = sources.find(s => s.id === sourceId)
                if (!source) continue

                const balance = Number(source.balance)
                if (Math.abs(balance) < 0.01) continue

                // Debit/Credit to zero out source
                journalLines.push({
                    accountId: sourceId,
                    debit: balance > 0 ? 0 : Math.abs(balance),
                    credit: balance > 0 ? balance : 0,
                    description: "Residual Balance Sweep (Cleanup)",
                    organizationId: tenant.id
                })

                // Transfer to target
                journalLines.push({
                    accountId: targetId,
                    debit: balance > 0 ? balance : 0,
                    credit: balance > 0 ? 0 : Math.abs(balance),
                    description: `Residual transfer from ${source.code}`,
                    organizationId: tenant.id
                })
            }

            if (journalLines.length === 0) return { success: true, message: "No balances found to sweep." }

            // Find Period
            const fy = await tx.fiscalYear.findFirst({ where: { status: 'OPEN', organizationId: tenant.id } })
            if (!fy) throw new Error("No open Fiscal Year")

            const entry = await tx.journalEntry.create({
                data: {
                    transactionDate: now,
                    description: "Residual Balance Sweep Cleanup",
                    reference: "CLEANUP",
                    status: "POSTED",
                    postedAt: now,
                    organizationId: tenant.id,
                    fiscalYearId: fy.id,
                    lines: { create: journalLines }
                },
                include: { lines: true }
            })

            // Force cache update
            for (const line of entry.lines) {
                const netChange = Number(line.debit) - Number(line.credit)
                await tx.chartOfAccount.update({
                    where: { id: line.accountId },
                    data: { balance: { increment: netChange } }
                })
            }

            revalidatePath('/admin/finance/reports/balance-sheet')
            return { success: true }
        }, { maxWait: 15000, timeout: 60000 })
    } catch (error) {
        console.error(`[COA_SWEEP] Sweep failed:`, error)
        throw error
    }
}
