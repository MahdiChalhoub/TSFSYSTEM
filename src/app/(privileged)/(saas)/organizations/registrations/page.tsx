import React from 'react';
import { RegistrationQueue } from './RegistrationQueue';
import { getPendingUsers } from '@/app/actions/auth';
import { ClipboardList } from 'lucide-react';

export default async function RegistrationsPage() {
    const pendingUsers = await getPendingUsers();

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-app-surface p-6 rounded-[2rem] border border-app-border shadow-sm">
                <div>
                    <h1 className="text-3xl font-black text-app-foreground uppercase tracking-tighter flex items-center gap-3">
                        <div className="p-2 bg-app-info-bg rounded-xl">
                            <ClipboardList className="text-app-info" size={28} />
                        </div>
                        Registration Queue
                    </h1>
                    <p className="text-[10px] text-app-muted-foreground font-bold uppercase tracking-widest mt-1">
                        Review and approve new business workspace requests
                    </p>
                </div>
            </div>

            <RegistrationQueue initialUsers={pendingUsers} />
        </div>
    );
}
