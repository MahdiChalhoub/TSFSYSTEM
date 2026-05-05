'use client';

import { useState } from 'react';
import AuditTable from './AuditTable';
import AuditSettings from './AuditSettings';
import { ShieldAlert, Settings } from 'lucide-react';

export default function POSAuditPage() {
 const [tab, setTab] = useState<'EVENTS' | 'SETTINGS'>('EVENTS');

 return (
 <div className="app-page p-6 h-[calc(100vh-4rem)] flex flex-col gap-6 max-w-7xl mx-auto">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="page-header-title tracking-tight flex items-center gap-2">
 <ShieldAlert className="text-app-error" />
 POS Forensics & Audit
 </h1>
 <p className="text-app-muted-foreground mt-1">Monitor high-risk POS transactions and configure alert rules.</p>
 </div>
 </div>

 <div className="flex border-b border-app-border">
 <button
 onClick={() => setTab('EVENTS')}
 className={`pb-3 px-4 font-bold text-sm transition-colors border-b-2 ${tab === 'EVENTS' ? 'border-app-error text-app-error' : 'border-transparent text-app-muted-foreground hover:text-app-muted-foreground'}`}
 >
 Audit Log
 </button>
 <button
 onClick={() => setTab('SETTINGS')}
 className={`pb-3 px-4 font-bold text-sm transition-colors border-b-2 flex items-center gap-1.5 ${tab === 'SETTINGS' ? 'border-app-border text-app-foreground' : 'border-transparent text-app-muted-foreground hover:text-app-muted-foreground'}`}
 >
 <Settings size={14} /> Rule Configuration
 </button>
 </div>

 <div className="flex-1 min-h-0">
 {tab === 'EVENTS' ? <AuditTable /> : <AuditSettings />}
 </div>
 </div>
 );
}
