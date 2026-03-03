import re

with open("/root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/modules/inventory/ProductActivityFeed.tsx", "r") as f:
    text = f.read()

target = """                        {/* Failure Details Section */}
                        {(op.reason || op.failed_by) && (
                            <div className="mt-3 pt-2.5 border-t border-red-100 flex flex-col gap-1">
                                {op.failed_by && (
                                    <span className="text-[10px] text-red-700 font-bold uppercase tracking-wider flex items-center gap-1">
                                        <AlertTriangle size={10} /> Rejected By: <span className="font-semibold text-red-600 capitalize">{op.failed_by}</span>
                                    </span>
                                )}
                                {op.reason && (
                                    <span className="text-[10px] text-red-600 bg-red-100/50 p-1.5 rounded text-left">
                                        <b className="uppercase tracking-wider mr-1">Reason:</b> "{op.reason}"
                                    </span>
                                )}
                            </div>
                        )}"""

replacement = """                        {/* Failure Details Section */}
                        {(op.reason || op.failed_by || op.discrepancies) && (
                            <div className={`mt-3 pt-2.5 border-t flex flex-col gap-1.5 ${op.failure_type === 'SUPPLIER_FAILURE' || op.discrepancies ? 'border-amber-200' : 'border-red-100'}`}>
                                {(op.reason || op.failed_by) && (
                                    <>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${op.failure_type === 'SUPPLIER_FAILURE' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                                                {op.failure_type === 'SUPPLIER_FAILURE' ? '🚫 Supplier Failure' : '⚠️ Internal Rejection'}
                                            </span>
                                            {op.failed_by && (
                                                <span className={`text-[10px] font-bold flex items-center gap-1 ${op.failure_type === 'SUPPLIER_FAILURE' ? 'text-amber-800' : 'text-red-700'}`}>
                                                    By: <span className="font-black capitalize">{op.failed_by}</span>
                                                </span>
                                            )}
                                        </div>
                                        {op.reason && (
                                            <span className={`text-[11px] font-semibold p-2 rounded-md ${op.failure_type === 'SUPPLIER_FAILURE' ? 'bg-amber-50 text-amber-900 border border-amber-100' : 'bg-red-50 text-red-900 border border-red-100'} text-left`}>
                                                "{op.reason}"
                                            </span>
                                        )}
                                    </>
                                )}
                                {op.discrepancies && (
                                    <div className="flex flex-col gap-1 mt-1">
                                        <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 self-start">
                                            ⚠️ Receipt Discrepancies
                                        </span>
                                        <div className="flex gap-2 text-[10px] font-semibold text-amber-900 bg-amber-50 p-1.5 rounded-md border border-amber-100 text-left">
                                            {op.discrepancies.damaged > 0 && <span>{op.discrepancies.damaged} Damaged</span>}
                                            {op.discrepancies.missing > 0 && <span>{op.discrepancies.missing} Missing</span>}
                                            {op.discrepancies.rejected > 0 && <span>{op.discrepancies.rejected} Rejected</span>}
                                        </div>
                                        {op.discrepancies.notes && (
                                            <span className="text-[10px] text-amber-800 italic ml-1 text-left">Note: {op.discrepancies.notes}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}"""

text = text.replace(target, replacement)
with open("/root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/modules/inventory/ProductActivityFeed.tsx", "w") as f:
    f.write(text)

print("Patch applied.")
