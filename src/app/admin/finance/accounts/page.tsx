import { prisma } from "@/lib/db";
import { Plus, Search, Wallet, Building2, CreditCard } from "lucide-react";

export const dynamic = 'force-dynamic';

async function getAccounts() {
    return await prisma.financialAccount.findMany({
        orderBy: { name: 'asc' }
    });
}

export default async function AccountsPage() {
    const accounts = await getAccounts();

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2">Financial Accounts</h1>
                    <p className="text-gray-500">Manage cash drawers, bank accounts, and payment methods.</p>
                </div>
                <button className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-emerald-900/20 hover:-translate-y-0.5 transition-all flex items-center gap-2">
                    <Plus size={20} />
                    <span>Add New Account</span>
                </button>
            </div>

            {/* Content */}
            <div className="card-premium p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {accounts.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-gray-400">
                            <p>No accounts found.</p>
                        </div>
                    ) : (
                        accounts.map((acc) => (
                            <div key={acc.id} className="group border border-gray-100 rounded-2xl p-6 hover:shadow-lg transition-all bg-white relative overflow-hidden">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                        {acc.type === 'CASH' && <Wallet size={24} />}
                                        {acc.type === 'BANK' && <Building2 size={24} />}
                                        {acc.type === 'MOBILE' && <CreditCard size={24} />}
                                    </div>
                                    <div className={`px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wide
                                        ${acc.type === 'CASH' ? 'bg-green-50 text-green-600' :
                                            acc.type === 'BANK' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}
                                    `}>
                                        {acc.type}
                                    </div>
                                </div>

                                <h3 className="text-lg font-bold text-gray-900 mb-1">{acc.name}</h3>
                                <p className="text-sm text-gray-500 mb-4">{acc.currency}</p>

                                <div className="pt-4 border-t border-gray-50">
                                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Balance</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {Number(acc.balance).toLocaleString('en-US', { style: 'currency', currency: acc.currency })}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
