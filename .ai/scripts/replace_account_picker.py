#!/usr/bin/env python3
"""Replace the datalist account picker with CascadingAccountPicker in form.tsx"""

filepath = "/root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/(privileged)/finance/ledger/new/form.tsx"

with open(filepath) as f:
    content = f.read()

old_block = """ <td className="p-2 relative">
 <div className="flex items-center gap-2">
 <input
 list="accounts-list"
 placeholder="Type code or name..."
 value={line.searchString}
 onChange={e => updateLine(idx, 'searchString', e.target.value)}
 className={`w-full p-1.5 border rounded text-xs focus:ring-1 focus:ring-black outline-none font-medium transition-all ${line.accountId ? 'border-app-success bg-app-primary-light/10 text-app-foreground' : 'border-app-border text-app-muted-foreground'
 }`}
 />
 {line.accountId && (
 <div className="flex items-center gap-1 shrink-0">
 {!selectableAccounts.find(a => a.id.toString() === line.accountId)?.isActive && (
 <span className="text-[8px] bg-app-surface-2 text-app-muted-foreground px-1 rounded border border-app-border font-bold">INACTIVE</span>
 )}
 <CheckCircle2 size={12} className="text-app-primary" />
 </div>
 )}
 </div>
 <datalist id="accounts-list">
 {selectableAccounts.map(acc => (
 <option key={acc.id} value={`${acc.code} ${acc.name}`}>
 {acc.type} {acc.isActive ? '' : '(INACTIVE)'}
 </option>
 ))}
 </datalist>
 {!line.accountId && line.searchString && (
 <div className="absolute left-2 top-full z-10 text-[9px] text-app-error font-bold bg-app-surface px-1 shadow-sm">
 Account not found. Select from list.
 </div>
 )}
 </td>"""

new_block = """ <td className="p-2">
 <CascadingAccountPicker
 accounts={selectableAccounts}
 value={line.accountId}
 displayValue={line.searchString}
 onChange={(accountId, displayText) => {
 const newLines = [...lines]
 newLines[idx] = { ...newLines[idx], accountId, searchString: displayText }
 setLines(newLines)
 }}
 />
 </td>"""

if old_block in content:
    content = content.replace(old_block, new_block)
    with open(filepath, 'w') as f:
        f.write(content)
    print("✓ Replaced account picker successfully")
else:
    print("✗ Old block not found — checking...")
    # Try to find partial match
    for i, line in enumerate(old_block.split('\n')[:3]):
        if line in content:
            print(f"  Line {i} found: {line[:60]}...")
        else:
            print(f"  Line {i} NOT found: {repr(line[:60])}")
