import os

fp = "/root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/(privileged)/finance/tax-policy/page.tsx"
with open(fp, "r") as f:
    content = f.read()

# 1. Imports
content = content.replace(
    "import { getOrgTaxPolicy, saveOrgTaxPolicy, getCounterpartyTaxProfiles, saveCounterpartyTaxProfile } from '@/app/actions/finance/tax-engine'",
    "import { getOrgTaxPolicy, saveOrgTaxPolicy, getCounterpartyTaxProfiles, saveCounterpartyTaxProfile, getCustomTaxRules, saveCustomTaxRule, deleteCustomTaxRule } from '@/app/actions/finance/tax-engine'\nimport { getChartOfAccounts } from '@/app/actions/finance/accounts'"
)

# 2. State
state_target = """ const [form, setForm] = useState<Record<string, any>>({})
 const [profileModalOpen, setProfileModalOpen] = useState(false)
 const [editingProfile, setEditingProfile] = useState<Record<string, any> | null>(null)"""
state_replace = state_target + """
 const [rules, setRules] = useState<any[]>([])
 const [coa, setCoa] = useState<any[]>([])
 const [ruleModalOpen, setRuleModalOpen] = useState(false)
 const [editingRule, setEditingRule] = useState<Record<string, any> | null>(null)"""
content = content.replace(state_target, state_replace)

# 3. Load func
load_target = """ const [pol, profs] = await Promise.all([
 getOrgTaxPolicy(),
 getCounterpartyTaxProfiles(),
 ])"""
load_replace = """ const [pol, profs, rulesList, accountsList] = await Promise.all([
 getOrgTaxPolicy(),
 getCounterpartyTaxProfiles(),
 getCustomTaxRules(),
 getChartOfAccounts(false, 'OFFICIAL'),
 ])"""
content = content.replace(load_target, load_replace)

set_target = """ setProfiles(Array.isArray(profs) ? profs : profs?.results || [])"""
set_replace = set_target + """
 setRules(Array.isArray(rulesList) ? rulesList : rulesList?.results || [])
 setCoa(Array.isArray(accountsList) ? accountsList : accountsList?.results || [])"""
content = content.replace(set_target, set_replace)

# 4. Handlers
handlers_target = """ const f = (key: string) => form[key]"""
handlers_replace = """ const handleSaveRule = async () => {
 if (!editingRule?.name) return toast.error('Name is required')
 setSaving(true)
 try {
 await saveCustomTaxRule(editingRule.id ?? null, editingRule)
 toast.success('Custom rule saved')
 setRuleModalOpen(false)
 const r = await getCustomTaxRules()
 setRules(Array.isArray(r) ? r : r?.results || [])
 } catch {
 toast.error('Failed to save custom rule')
 } finally {
 setSaving(false)
 }
 }

 const handleDeleteRule = async (id: number) => {
 if (!confirm('Are you confirm deletion?')) return
 setSaving(true)
 try {
 await deleteCustomTaxRule(id)
 toast.success('Rule deleted')
 const r = await getCustomTaxRules()
 setRules(Array.isArray(r) ? r : r?.results || [])
 } catch {
 toast.error('Failed to delete')
 } finally {
 setSaving(false)
 }
 }

 const f = (key: string) => form[key]"""
content = content.replace(handlers_target, handlers_replace)

# 5. JSX
jsx_target = """ {/* Edit/Create Profile Modal */}"""
jsx_replace = """ {/* Custom Tax Rules */}
 <Card className="mt-6">
 <CardHeader className="py-4 flex flex-row items-center justify-between">
 <CardTitle className="text-sm flex items-center gap-2">
 <Shield size={16} className="text-pink-600" /> Custom Dynamic Taxes
 </CardTitle>
 <div className="flex items-center gap-3">
 <Badge variant="outline" className="text-xs">{rules.length} rules</Badge>
 <Button size="sm" variant="outline" className="text-xs h-8"
 onClick={() => {
 setEditingRule({ rate: '0.0000', transaction_type: 'SALE', math_behavior: 'ADDED_TO_TTC', purchase_cost_treatment: 'CAPITALIZE', is_active: true })
 setRuleModalOpen(true)
 }}>
 <Plus size={14} className="mr-1" /> New Tax Rule
 </Button>
 </div>
 </CardHeader>
 <CardContent className="p-0">
 {rules.length === 0 ? (
 <div className="text-center py-10 text-app-text-faint text-sm">
 <Shield size={32} className="mx-auto mb-2 opacity-30 text-pink-500" />
 No rules found.
 </div>
 ) : (
 <table className="w-full text-sm">
 <thead className="bg-app-bg border-b">
 <tr>
 <th className="text-left px-4 py-2">Rule Name</th>
 <th className="text-center px-4 py-2">Rate</th>
 <th className="text-center px-4 py-2">Applies To</th>
 <th className="text-center px-4 py-2">Math Setup</th>
 <th className="text-right px-4 py-2">Actions</th>
 </tr>
 </thead>
 <tbody>
 {rules.map((r: any) => (
 <tr key={r.id} className="border-b hover:bg-app-bg">
 <td className="px-4 py-2 font-semibold">{r.name}</td>
 <td className="px-4 py-2 text-center">{(parseFloat(r.rate)*100).toFixed(2)}%</td>
 <td className="px-4 py-2 text-center">{r.transaction_type}</td>
 <td className="px-4 py-2 text-center">{r.math_behavior}</td>
 <td className="px-4 py-2 text-right">
 <Button variant="ghost" size="sm" onClick={() => { setEditingRule(r); setRuleModalOpen(true) }}>
 <Pencil size={14} />
 </Button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </CardContent>
 </Card>

 <Dialog open={ruleModalOpen} onOpenChange={setRuleModalOpen}>
 <DialogContent className="sm:max-w-[500px]">
 <DialogHeader><DialogTitle>{editingRule?.id ? 'Edit' : 'Create'} Custom Tax Rule</DialogTitle></DialogHeader>
 <div className="space-y-4 pt-4">
 <div className="space-y-2">
 <label className="text-xs font-semibold uppercase">Rule Name</label>
 <Input value={editingRule?.name || ''} onChange={e => setEditingRule(prev => ({ ...prev!, name: e.target.value }))} />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <label className="text-xs font-semibold uppercase">Tax Rate</label>
 <Input type="number" step="0.0001" value={editingRule?.rate || ''} onChange={e => setEditingRule(prev => ({ ...prev!, rate: e.target.value }))} />
 </div>
 <div className="space-y-2">
 <label className="text-xs font-semibold uppercase">Transaction Type</label>
 <Select value={editingRule?.transaction_type || 'BOTH'} onValueChange={v => setEditingRule(prev => ({ ...prev!, transaction_type: v }))}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent><SelectItem value="PURCHASE">Purchase</SelectItem><SelectItem value="SALE">Sale</SelectItem><SelectItem value="BOTH">Both</SelectItem></SelectContent>
 </Select>
 </div>
 </div>
 <div className="space-y-2">
 <label className="text-xs font-semibold uppercase">Math Behavior</label>
 <Select value={editingRule?.math_behavior || 'ADDED_TO_TTC'} onValueChange={v => setEditingRule(prev => ({ ...prev!, math_behavior: v }))}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent><SelectItem value="ADDED_TO_TTC">Add to TTC</SelectItem><SelectItem value="WITHHELD_FROM_AP">Withheld from AP</SelectItem></SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <label className="text-xs font-semibold uppercase">Liability Account</label>
 <Select value={editingRule?.liability_account_id?.toString() || ''} onValueChange={v => setEditingRule(prev => ({ ...prev!, liability_account_id: parseInt(v) }))}>
 <SelectTrigger><SelectValue placeholder="Select account"/></SelectTrigger>
 <SelectContent>
 {coa.filter(a => a.type === 'LIABILITY' || a.type === 'ASSET').map(a => (
 <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="flex items-center justify-between p-3 border rounded-lg">
 <div><p className="font-semibold">Is Active</p></div>
 <Switch checked={!!editingRule?.is_active} onCheckedChange={v => setEditingRule(prev => ({ ...prev!, is_active: v }))} />
 </div>
 <div className="flex gap-2">
 {editingRule?.id && (
 <Button variant="destructive" onClick={() => handleDeleteRule(editingRule.id)} disabled={saving}>Delete</Button>
 )}
 <Button onClick={handleSaveRule} disabled={saving} className="flex-1">Save</Button>
 </div>
 </div>
 </DialogContent>
 </Dialog>

 {/* Edit/Create Profile Modal */}"""
content = content.replace(jsx_target, jsx_replace)

with open(fp, "w") as f:
    f.write(content)
print("Patched successfully! Number of replacements: ", content.count("setCoa"))
