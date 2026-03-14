const fs = require('fs');
let content = fs.readFileSync('src/app/(privileged)/finance/tax-policy/page.tsx', 'utf8');

content = content.replace(/\/\* AIRSI \+ Internal Scope \*\/[\s\S]*?<\/SelectContent>\n\s*<\/Select>\n\s*<\/div>\n\s*<\/div>/, `                                {/* AIRSI Treatment */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black uppercase text-violet-600 tracking-widest">AIRSI Withholding</h3>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-app-text-muted uppercase">AIRSI Treatment</label>
                                        <Select value={f('airsi_treatment')} onValueChange={v => set('airsi_treatment', v)}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {AIRSI_OPTIONS.map(o => (
                                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>`);

content = content.replace(/Periodic & Turnover Taxes/g, 'Automated Ledger Accruals');
content = content.replace(/Sales \/ Turnover Tax/g, 'Turnover \/ Revenue Provision');
content = content.replace(/Corporate Profit Tax/g, 'Year-End Corporate Tax');

fs.writeFileSync('src/app/(privileged)/finance/tax-policy/page.tsx', content);
console.log("Done");
