import React from 'react';
import { RegistrationQueue } from './RegistrationQueue';
import { getPendingUsers, meAction } from '@/app/actions/auth';
import { ClipboardList } from 'lucide-react';

export default async function RegistrationsPage() {
    const [pendingUsers, me] = await Promise.all([
        getPendingUsers(),
        meAction().catch(() => null),
    ]);

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-xl">
                            <ClipboardList className="text-blue-600" size={28} />
                        </div>
                        Registration Queue
                    </h1>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                        Review and approve new business workspace requests
                    </p>
                </div>
            </div>

            <RegistrationQueue initialUsers={pendingUsers} currentUserOrgId={me?.organization_id ?? null} />
        </div>
    );
}
