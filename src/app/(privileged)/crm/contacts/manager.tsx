'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { TypicalListView, type ColumnDef } from '@/components/common/TypicalListView';
import { TypicalFilter } from '@/components/common/TypicalFilter';
import { useListViewSettings } from '@/hooks/useListViewSettings';
import { useCurrency } from '@/lib/utils/currency';
import { toast } from 'sonner';
import { Search, Plus, User, Briefcase, Building2, CreditCard, ChevronRight, Phone, Mail, Filter, TrendingUp, TrendingDown, Tag, Star, Users, ExternalLink } from "lucide-react";
import ContactModal from './form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
type Contact = Record<string, any>;
const ALL_COLUMNS: ColumnDef<Contact>[] = [
    { key: 'name', label: 'Entity Identity', sortable: true, alwaysVisible: true },
    { key: 'type', label: 'Classification', sortable: true },
    { key: 'contact', label: 'Communication Channels' },
    { key: 'site', label: 'Home Node' },
    { key: 'balance', label: 'Ledger Balance', align: 'right', sortable: true },
];
export default function RelationshipMasterList({
    contacts,
    sites,
    deliveryZones = [],
    taxProfiles = [],
}: {
    contacts: Contact[],
    sites: Record<string, any>[],
    deliveryZones?: Record<string, any>[],
    taxProfiles?: Record<string, any>[],
}) {
    const { fmt } = useCurrency();
    const router = useRouter();
    const settings = useListViewSettings('crm_contacts_v3', {
        columns: ALL_COLUMNS.map(c => c.key),
        pageSize: 20,
        sortKey: 'name',
        sortDir: 'asc',
    });
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [siteFilter, setSiteFilter] = useState('ALL');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER');
    const filtered = contacts.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.email?.toLowerCase().includes(search.toLowerCase());
        const matchesType = typeFilter === 'ALL' || c.type === typeFilter;
        const matchesSite = siteFilter === 'ALL' || c.homeSiteId?.toString() === siteFilter;
        return matchesSearch && matchesType && matchesSite;
    });
    const columns: ColumnDef<Contact>[] = ALL_COLUMNS.map(c => {
        const renderers: Record<string, (r: Contact) => React.ReactNode> = {
            name: r => (
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 ${r.type === 'CUSTOMER' ? 'bg-blue-50 text-blue-600' :
                        r.type === 'SUPPLIER' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                        {r.type === 'CUSTOMER' ? <User size={16} /> :
                            r.type === 'SUPPLIER' ? <Briefcase size={16} /> : <Users size={16} />}
                    </div>
                    <div>
                        <div className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{r.name}</div>
                        <div className="text-[10px] font-mono text-gray-400 group-hover:text-indigo-400">Account: {r.linkedAccount?.code || 'UNLINKED'}</div>
                    </div>
                </div>
            ),
            type: r => (
                <div className="flex gap-1.5 flex-wrap">
                    <Badge variant="secondary" className={`text-[10px] font-black uppercase tracking-tighter border-0 ${r.type === 'CUSTOMER' ? 'bg-blue-100 text-blue-700' :
                        r.type === 'SUPPLIER' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                        {r.type}
                    </Badge>
                    {r.customer_tier && r.customer_tier !== 'STANDARD' && (
                        <Badge variant="outline" className="text-[10px] font-bold border-stone-200 text-stone-600 bg-stone-50">
                            {r.customer_tier === 'VIP' && <Star size={10} className="mr-1 fill-yellow-400 text-yellow-400" />}
                            {r.customer_tier}
                        </Badge>
                    )}
                </div>
            ),
            contact: r => (
                <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
                        <Mail size={12} className="text-gray-400" />
                        {r.email || 'No Email'}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                        <Phone size={12} />
                        {r.phone || 'No Phone'}
                    </div>
                </div>
            ),
            site: r => r.homeSite ? (
                <Badge variant="outline" className="text-[10px] font-bold border-indigo-100 text-indigo-600 bg-indigo-50/50">
                    <Building2 size={10} className="mr-1" /> {r.homeSite.name}
                </Badge>
            ) : <span className="text-gray-300">—</span>,
            balance: r => {
                const bal = Number(r.balance || 0);
                return (
                    <div className={`font-black flex items-center justify-end gap-1.5 ${bal > 0 ? 'text-emerald-600' : bal < 0 ? 'text-rose-600' : 'text-stone-300'
                        }`}>
                        {bal > 0 ? <TrendingUp size={14} /> : bal < 0 ? <TrendingDown size={14} /> : null}
                        {fmt(Math.abs(bal))}
                    </div>
                );
            }
        };
        return { ...c, render: renderers[c.key] };
    });
    return (
        <div className="space-y-4">
            <TypicalListView<Contact>
                title="Relationship Ledger"
                data={filtered}
                getRowId={r => r.id}
                columns={columns}
                visibleColumns={settings.visibleColumns}
                onToggleColumn={settings.toggleColumn}
                className="rounded-[32px] border-0 shadow-sm overflow-hidden"
                pageSize={settings.pageSize}
                onPageSizeChange={settings.setPageSize}
                sortKey={settings.sortKey}
                sortDir={settings.sortDir}
                onSort={k => settings.setSort(k)}
                headerExtra={
                    <div className="flex gap-2">
                        <Button
                            onClick={() => { setModalType('SUPPLIER'); setIsModalOpen(true); }}
                            variant="ghost"
                            className="h-9 px-4 bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 rounded-xl font-black text-[10px] uppercase tracking-widest border border-amber-100"
                        >
                            <Briefcase size={14} className="mr-2" /> New Supplier
                        </Button>
                        <Button
                            onClick={() => { setModalType('CUSTOMER'); setIsModalOpen(true); }}
                            className="h-9 px-4 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100"
                        >
                            <Plus size={14} className="mr-2" /> New Client
                        </Button>
                    </div>
                }
                actions={{
                    onView: (r) => router.push(`/crm/contacts/${r.id}`),
                    onEdit: (r) => router.push(`/crm/contacts/${r.id}`),
                    extra: (r) => (
                        <button
                            type="button"
                            className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            onClick={(e) => { e.stopPropagation(); router.push(`/crm/contacts/${r.id}`); }}
                            title="Open contact profile"
                        >
                            <ExternalLink size={14} />
                        </button>
                    )
                }}
            >
                <TypicalFilter
                    search={{ placeholder: 'Search Identities or Communication Channels...', value: search, onChange: setSearch }}
                    filters={[
                        {
                            key: 'type', label: 'Classification', type: 'select', options: [
                                { value: 'ALL', label: 'All Segments' },
                                { value: 'CUSTOMER', label: 'Customer Base' },
                                { value: 'SUPPLIER', label: 'Supply Chain' },
                                { value: 'LEAD', label: 'Potential Leads' },
                            ]
                        },
                        {
                            key: 'site', label: 'Home Node', type: 'select', options: [
                                { value: 'ALL', label: 'Global (All Nodes)' },
                                ...sites.map(s => ({ value: s.id.toString(), label: s.name }))
                            ]
                        }
                    ]}
                    values={{ type: typeFilter, site: siteFilter }}
                    onChange={(k, v) => k === 'type' ? setTypeFilter(String(v)) : setSiteFilter(String(v))}
                />
            </TypicalListView>
            {isModalOpen && (
                <ContactModal
                    sites={sites}
                    type={modalType}
                    onClose={() => {
                        setIsModalOpen(false);
                        router.refresh();
                    }}
                    deliveryZones={deliveryZones}
                    taxProfiles={taxProfiles}
                />
            )}
        </div>
    );
}