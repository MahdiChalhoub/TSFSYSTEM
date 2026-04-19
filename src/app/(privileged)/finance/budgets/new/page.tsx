'use client'

import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect } from "react"
import { createBudget, createBudgetLine } from "@/app/actions/finance/budgets"
import { getFiscalYears } from "@/app/actions/finance/fiscal-year"
import { getChartOfAccounts } from "@/app/actions/finance/accounts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { ArrowLeft, Plus, Trash2, Save, Calculator } from "lucide-react"
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type BudgetLine = {
  id: string
  account_id: number
  account_name?: string
  budgeted_amount: string
}

export default function NewBudgetPage() {
  const { fmt } = useCurrency()
  const router = useRouter()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [fiscalYearId, setFiscalYearId] = useState('')
  const [version, setVersion] = useState(1)
  const [status, setStatus] = useState('DRAFT')

  const [fiscalYears, setFiscalYears] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [fyData, accountsData] = await Promise.all([
        getFiscalYears(),
        getChartOfAccounts(false, 'OFFICIAL')
      ])

      const fyArray = Array.isArray(fyData) ? fyData : (fyData as any)?.results || []
      const accountsArray = Array.isArray(accountsData) ? accountsData : (accountsData as any)?.results || []

      setFiscalYears(fyArray)
      setAccounts(accountsArray.filter((a: any) => ['INCOME', 'EXPENSE'].includes(a.type)))

      // Set default fiscal year to current/latest
      if (fyArray.length > 0) {
        setFiscalYearId(fyArray[0].id.toString())
      }
    } catch (error) {
      toast.error("Failed to load data")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  function addBudgetLine() {
    setBudgetLines([
      ...budgetLines,
      {
        id: `temp-${Date.now()}`,
        account_id: 0,
        budgeted_amount: '0'
      }
    ])
  }

  function removeBudgetLine(id: string) {
    setBudgetLines(budgetLines.filter(line => line.id !== id))
  }

  function updateBudgetLine(id: string, field: string, value: any) {
    setBudgetLines(budgetLines.map(line => {
      if (line.id === id) {
        const updated = { ...line, [field]: value }

        // Update account name when account_id changes
        if (field === 'account_id') {
          const account = accounts.find(a => a.id === parseInt(value))
          updated.account_name = account?.name
        }

        return updated
      }
      return line
    }))
  }

  async function handleSave() {
    // Validation
    if (!name.trim()) {
      toast.error('Please enter a budget name')
      return
    }

    if (!fiscalYearId) {
      toast.error('Please select a fiscal year')
      return
    }

    if (budgetLines.length === 0) {
      toast.error('Please add at least one budget line')
      return
    }

    // Check all lines have valid accounts and amounts
    const invalidLines = budgetLines.filter(line =>
      !line.account_id ||
      line.account_id === 0 ||
      !line.budgeted_amount ||
      parseFloat(line.budgeted_amount) <= 0
    )

    if (invalidLines.length > 0) {
      toast.error('All budget lines must have an account and positive amount')
      return
    }

    setSaving(true)

    try {
      // Create budget
      const budgetResult = await createBudget({
        name,
        description,
        fiscal_year: parseInt(fiscalYearId),
        version,
        status
      })

      if (!budgetResult.success) {
        throw new Error('Failed to create budget')
      }

      const budgetId = budgetResult.id

      // Create budget lines
      for (const line of budgetLines) {
        await createBudgetLine({
          budget: budgetId,
          account: line.account_id,
          budgeted_amount: line.budgeted_amount
        })
      }

      toast.success('Budget created successfully!')
      router.push(`/finance/budgets/${budgetId}`)
    } catch (error) {
      toast.error('Failed to create budget')
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  const totalBudget = budgetLines.reduce((sum, line) =>
    sum + Number(line.budgeted_amount || 0), 0
  )

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Link href="/finance/budgets">
            <Button variant="ghost" size="sm" className="mb-3 gap-2">
              <ArrowLeft size={16} />
              Back to Budgets
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-app-primary/10 border border-app-primary/20">
              <Calculator size={32} className="text-app-primary" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Finance</p>
              <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
                New <span className="text-app-primary">Budget</span>
              </h1>
              <p className="text-sm text-app-muted-foreground mt-1">
                Create a new budget for variance tracking
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="h-10 px-4 rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="h-10 px-6 rounded-xl bg-app-primary hover:bg-app-primary/90 gap-2"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Budget'}
          </Button>
        </div>
      </header>

      {/* Budget Details */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Budget Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider">
                Budget Name *
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Annual Budget 2024"
                className="mt-2 rounded-xl"
              />
            </div>

            <div>
              <Label htmlFor="fiscal_year" className="text-xs font-bold uppercase tracking-wider">
                Fiscal Year *
              </Label>
              <Select value={fiscalYearId} onValueChange={setFiscalYearId}>
                <SelectTrigger className="mt-2 rounded-xl">
                  <SelectValue placeholder="Select fiscal year" />
                </SelectTrigger>
                <SelectContent>
                  {fiscalYears.map(fy => (
                    <SelectItem key={fy.id} value={fy.id.toString()}>
                      {fy.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="version" className="text-xs font-bold uppercase tracking-wider">
                Version
              </Label>
              <Input
                id="version"
                type="number"
                value={version}
                onChange={(e) => setVersion(parseInt(e.target.value) || 1)}
                className="mt-2 rounded-xl"
                min="1"
              />
            </div>

            <div>
              <Label htmlFor="status" className="text-xs font-bold uppercase tracking-wider">
                Status
              </Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-2 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="LOCKED">Locked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description" className="text-xs font-bold uppercase tracking-wider">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter budget description..."
              className="mt-2 rounded-xl"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Budget Lines */}
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Budget Lines</CardTitle>
            <Button
              onClick={addBudgetLine}
              variant="outline"
              size="sm"
              className="rounded-xl gap-2"
            >
              <Plus size={16} />
              Add Line
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {budgetLines.length === 0 ? (
            <div className="text-center py-8 text-app-muted-foreground">
              <p className="mb-4">No budget lines added yet</p>
              <Button onClick={addBudgetLine} variant="outline" className="rounded-xl gap-2">
                <Plus size={16} />
                Add First Line
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {budgetLines.map((line, idx) => (
                <div
                  key={line.id}
                  className="flex items-center gap-3 p-4 bg-app-surface rounded-xl border"
                >
                  <div className="w-8 h-8 rounded-lg bg-app-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-app-primary">{idx + 1}</span>
                  </div>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Select
                      value={line.account_id?.toString() || ''}
                      onValueChange={(value) => updateBudgetLine(line.id, 'account_id', parseInt(value))}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map(account => (
                          <SelectItem key={account.id} value={account.id.toString()}>
                            {account.code} - {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      type="number"
                      value={line.budgeted_amount}
                      onChange={(e) => updateBudgetLine(line.id, 'budgeted_amount', e.target.value)}
                      placeholder="Budgeted amount"
                      className="rounded-xl"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeBudgetLine(line.id)}
                    className="h-8 w-8 p-0 text-app-error hover:bg-app-error/10 rounded-xl"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {budgetLines.length > 0 && (
            <div className="mt-6 pt-6 border-t flex items-center justify-between">
              <span className="text-sm font-bold">Total Budget</span>
              <span className="text-2xl font-black text-app-primary">{fmt(totalBudget)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
