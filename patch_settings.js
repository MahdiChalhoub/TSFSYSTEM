const fs = require('fs');
let content = fs.readFileSync('src/app/(privileged)/finance/settings/form.tsx', 'utf8');

// 1. Remove COMPANY_TYPES, COLOR_MAP, TypeDetailCard
content = content.replace(/\/\/ ────────────────────────────────────────────────────────\n\/\/ Company Type Definitions[\s\S]*?\/\/ ─── Edit Confirmation Modal ───/, '// ─── Edit Confirmation Modal ───');

// 2. Remove watch and useEffect for autoConfig
content = content.replace(/const companyType = watch\('companyType'\)[\s\S]*?}, \[companyType, setValue\]\)/, '');

// 3. Remove Company Type UI block
content = content.replace(/\{\/\* ─── COMPANY TYPE ─── \*\/\}[\s\S]*?\{\/\* Currency & Tax \*\/ \}\n\s*<div className="grid grid-cols-2 gap-4 mt-4">/, `
            {/* --- NEW TAX ENGINE BANNER --- */}
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start gap-4 mb-4">
              <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-indigo-900">Taxes & Company Rules have migrated!</h3>
                <p className="text-xs text-indigo-700 mt-1">
                  The legacy Company Type definitions (MICRO, REAL, MIXED) and generic Tax Rates have been completely replaced by the new <strong>Universal Tax Engine</strong>. Please click <a href="/finance/tax-policy" className="underline font-bold">Tax Policy</a> in the sidebar to configure your organization's taxes.
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-medium text-app-text mb-4">Core Configuration</h2>
              <div className="grid gap-4 mt-4">
`);

// 4. Remove Standard TVA Rate input block
content = content.replace(/<div>\n\s*<label className="block text-sm font-medium text-stone-700 mb-1">Standard TVA Rate<\/label>[\s\S]*?<\/div>/, '');

// 5. Replace dualView condition
content = content.replace(/\{\(\(dualView \|\| companyType === 'MIXED'\)\)[\s\S]*?\{\/\* ─── CUSTOM FLAGS ─── \*\/\}/, `{/* ─── DUAL VIEW / OFFICIAL ACCESS ─── */} {settings.dualView && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-amber-100 rounded-lg text-amber-600">
                            <ShieldAlert size={16} />
                        </div>
                        <h3 className="text-sm font-bold text-amber-900">Dual View Active</h3>
                    </div>
                    <p className="text-xs text-amber-700 mb-4 leading-relaxed">
                        This tenant operates with parallel Official and Internal ledgers.
                    </p>
                </div>
            )}

            {/* --- AUTO-DECLARATION STRATEGY --- */}
            <div className="mt-4 p-5 bg-app-surface rounded-2xl border border-amber-200 shadow-sm space-y-4">`);

// 6. Remove CUSTOM FLAGS and MICRO TAX RULES completely
content = content.replace(/\{\/\* ─── CUSTOM FLAGS ─── \*\/\}[\s\S]*?\{\/\* ─── POSTING RULES ─── \*\/ \}/, `{/* ─── POSTING RULES ─── */}`);

fs.writeFileSync('src/app/(privileged)/finance/settings/form.tsx', content);
console.log("Done");
