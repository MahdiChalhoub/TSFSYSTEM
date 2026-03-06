'use client';
import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { TypicalListView, type ColumnDef } from '@/components/common/TypicalListView';
import { TypicalFilter } from '@/components/common/TypicalFilter';
import { useListViewSettings } from '@/hooks/useListViewSettings';
import { useCurrency } from '@/lib/utils/currency';
import { toast } from 'sonner';
import { Search, Plus, User, Briefcase, Building2, CreditCard, ChevronRight, Phone, Mail, Filter, TrendingUp, TrendingDown, Tag, Star, Users, ExternalLink, X, Settings as SettingsIcon } from "lucide-react";
import ContactModal from './form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Advanced filtering imports
import type { FilterGroup, SavedFilter, FilterTemplate } from '@/types/filters';
import { CRM_CONTACT_FILTER_FIELDS } from '@/types/filters';
import { applyFilterGroup } from '@/lib/filters';
import { FilterBuilder } from '@/components/shared/filters/FilterBuilder';
import { SavedFilters } from '@/components/shared/filters/SavedFilters';
import { FilterChips } from '@/components/shared/filters/FilterChips';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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

 // Advanced filtering state
 const [filterGroup, setFilterGroup] = useState<FilterGroup>({
   id: 'root',
   logic: 'AND',
   conditions: [],
 });
 const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
 const [filterDialogOpen, setFilterDialogOpen] = useState(false);

 // Filter templates
 const filterTemplates = useMemo(() => [
   {
     id: 'high-value',
     name: 'High-Value Customers',
     description: 'Customers with lifetime value >= $10,000',
     icon: '💎',
     filterGroup: {
       id: 'template-1',
       logic: 'AND' as const,
       conditions: [
         { id: 'c1', field: 'lifetime_value', operator: 'greaterThanOrEqual' as const, value: 10000 },
       ],
     },
   },
   {
     id: 'vip',
     name: 'VIP Contacts',
     description: 'Contacts marked as VIP tier',
     icon: '⭐',
     filterGroup: {
       id: 'template-2',
       logic: 'AND' as const,
       conditions: [
         { id: 'c1', field: 'customer_tier', operator: 'equals' as const, value: 'VIP' },
       ],
     },
   },
   {
     id: 'overdue',
     name: 'Overdue Balance',
     description: 'Contacts with negative balance',
     icon: '⚠️',
     filterGroup: {
       id: 'template-3',
       logic: 'AND' as const,
       conditions: [
         { id: 'c1', field: 'balance', operator: 'lessThan' as const, value: 0 },
       ],
     },
   },
 ], []);

 // Apply all filters with useMemo for performance
 const filtered = useMemo(() => {
   let result = contacts;

   // Basic search filter
   if (search) {
     const term = search.toLowerCase();
     result = result.filter(c =>
       c.name.toLowerCase().includes(term) ||
       c.email?.toLowerCase().includes(term) ||
       c.phone?.includes(term)
     );
   }

   // Type filter
   if (typeFilter !== 'ALL') {
     result = result.filter(c => c.type === typeFilter);
   }

   // Site filter
   if (siteFilter !== 'ALL') {
     result = result.filter(c => c.homeSiteId?.toString() === siteFilter);
   }

   // Advanced filters
   if (filterGroup.conditions.length > 0 || filterGroup.groups?.length) {
     result = applyFilterGroup(result, filterGroup);
   }

   return result;
 }, [contacts, search, typeFilter, siteFilter, filterGroup]);
 const columns: ColumnDef<Contact>[] = ALL_COLUMNS.map(c => {
 const renderers: Record<string, (r: Contact) => React.ReactNode> = {
 name: r => (
 <div className="flex items-center gap-3">
 <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 ${r.type === 'CUSTOMER' ? 'bg-app-info-bg text-app-info' :
 r.type === 'SUPPLIER' ? 'bg-app-warning-bg text-app-warning' : 'bg-app-primary-light text-app-primary'
 }`}>
 {r.type === 'CUSTOMER' ? <User size={16} /> :
 r.type === 'SUPPLIER' ? <Briefcase size={16} /> : <Users size={16} />}
 </div>
 <div>
 <div className="font-bold text-app-foreground group-hover:text-app-primary transition-colors uppercase tracking-tight">{r.name}</div>
 <div className="text-[10px] font-mono text-app-muted-foreground group-hover:text-app-primary">Account: {r.linkedAccount?.code || 'UNLINKED'}</div>
 </div>
 </div>
 ),
 type: r => (
 <div className="flex gap-1.5 flex-wrap">
 <Badge variant="secondary" className={`text-[10px] font-black uppercase tracking-tighter border-0 ${r.type === 'CUSTOMER' ? 'bg-app-info-bg text-app-info' :
 r.type === 'SUPPLIER' ? 'bg-app-warning-bg text-app-warning' : 'bg-app-primary-light text-app-success'
 }`}>
 {r.type}
 </Badge>
 {r.customer_tier && r.customer_tier !== 'STANDARD' && (
 <Badge variant="outline" className="text-[10px] font-bold border-app-border text-app-muted-foreground bg-app-background">
 {r.customer_tier === 'VIP' && <Star size={10} className="mr-1 fill-yellow-400 text-app-warning" />}
 {r.customer_tier}
 </Badge>
 )}
 </div>
 ),
 contact: r => (
 <div className="flex flex-col gap-0.5">
 <div className="flex items-center gap-1.5 text-xs font-bold text-app-muted-foreground">
 <Mail size={12} className="text-app-muted-foreground" />
 {r.email || 'No Email'}
 </div>
 <div className="flex items-center gap-1.5 text-xs font-medium text-app-muted-foreground">
 <Phone size={12} />
 {r.phone || 'No Phone'}
 </div>
 </div>
 ),
 site: r => r.homeSite ? (
 <Badge variant="outline" className="text-[10px] font-bold border-app-primary/30 text-app-primary bg-app-primary/5/50">
 <Building2 size={10} className="mr-1" /> {r.homeSite.name}
 </Badge>
 ) : <span className="text-app-muted-foreground">—</span>,
 balance: r => {
 const bal = Number(r.balance || 0);
 return (
 <div className={`font-black flex items-center justify-end gap-1.5 ${bal > 0 ? 'text-app-primary' : bal < 0 ? 'text-rose-600' : 'text-app-muted-foreground'
 }`}>
 {bal > 0 ? <TrendingUp size={14} /> : bal < 0 ? <TrendingDown size={14} /> : null}
 {fmt(Math.abs(bal))}
 </div>
 );
 }
 };
 return { ...c, render: renderers[c.key] };
 });

 // Filter handlers
 const handleLoadFilter = useCallback((filter: SavedFilter | FilterTemplate) => {
   setFilterGroup(filter.filterGroup);
   setFilterDialogOpen(false);
 }, []);

 const handleSaveFilter = useCallback((name: string, description: string, isPublic: boolean, isDefault: boolean) => {
   const now = new Date().toISOString();
   const newFilter: SavedFilter = {
     id: `filter-${Date.now().toString()}`,
     name,
     description,
     module: 'crm',
     entity: 'contact',
     filterGroup,
     isPublic,
     isDefault,
     createdBy: 1, // TODO: Get actual user ID
     createdAt: now,
     updatedAt: now,
     usageCount: 0,
   };

   const updated = [...savedFilters, newFilter];
   setSavedFilters(updated);
   localStorage.setItem('crm_contacts_saved_filters', JSON.stringify(updated));
   toast.success(`Filter "${name}" saved successfully`);
 }, [filterGroup, savedFilters]);

 const handleDeleteFilter = useCallback((filterId: string) => {
   const updated = savedFilters.filter(f => f.id !== filterId);
   setSavedFilters(updated);
   localStorage.setItem('crm_contacts_saved_filters', JSON.stringify(updated));
   toast.success('Filter deleted');
 }, [savedFilters]);

 const handleSetDefaultFilter = useCallback((filterId: string) => {
   const updated = savedFilters.map(f => ({
     ...f,
     isDefault: f.id === filterId,
   }));
   setSavedFilters(updated);
   localStorage.setItem('crm_contacts_saved_filters', JSON.stringify(updated));
   toast.success('Default filter updated');
 }, [savedFilters]);

 const handleRemoveCondition = useCallback((conditionId: string) => {
   setFilterGroup({
     ...filterGroup,
     conditions: filterGroup.conditions.filter(c => c.id !== conditionId),
   });
 }, [filterGroup]);

 const handleClearAllFilters = useCallback(() => {
   setFilterGroup({ id: 'root', logic: 'AND', conditions: [] });
   setSearch('');
   setTypeFilter('ALL');
   setSiteFilter('ALL');
   toast.success('All filters cleared');
 }, []);

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
 className="h-9 px-4 bg-app-warning-bg text-app-warning hover:bg-app-warning-bg hover:text-app-warning rounded-xl font-black text-[10px] uppercase tracking-widest border border-app-warning/30"
 >
 <Briefcase size={14} className="mr-2" /> New Supplier
 </Button>
 <Button
 onClick={() => { setModalType('CUSTOMER'); setIsModalOpen(true); }}
 className="h-9 px-4 bg-app-primary text-app-foreground hover:bg-app-primary rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100"
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
 className="p-1.5 text-app-primary hover:text-app-primary hover:bg-app-primary/5 rounded-lg transition-all"
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

 {/* Advanced Filters Button & Dialog */}
 <div className="flex items-center justify-between px-4 -mt-2">
   <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
     <DialogTrigger asChild>
       <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl font-bold text-[10px] uppercase">
         <Filter size={14} className="mr-2" />
         Advanced Filters
         {filterGroup.conditions.length > 0 && (
           <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full">
             {filterGroup.conditions.length}
           </Badge>
         )}
       </Button>
     </DialogTrigger>
     <DialogContent className="max-w-4xl max-h-[90vh]">
       <DialogHeader>
         <DialogTitle className="flex items-center gap-2">
           <Filter className="h-5 w-5" />
           Advanced Filters
         </DialogTitle>
         <DialogDescription>
           Build complex filters with multiple conditions using AND/OR logic
         </DialogDescription>
       </DialogHeader>
       <ScrollArea className="max-h-[70vh] pr-4">
         <div className="space-y-4 pb-4">
           <SavedFilters
             savedFilters={savedFilters}
             templates={filterTemplates}
             onLoadFilter={handleLoadFilter}
             onSaveFilter={handleSaveFilter}
             onDeleteFilter={handleDeleteFilter}
             onSetDefault={handleSetDefaultFilter}
           />
           <Separator />
           <FilterBuilder
             fields={CRM_CONTACT_FILTER_FIELDS}
             filterGroup={filterGroup}
             onChange={setFilterGroup}
           />
         </div>
       </ScrollArea>
     </DialogContent>
   </Dialog>
 </div>

 {/* Active Filter Chips */}
 {(filterGroup.conditions.length > 0 || search || typeFilter !== 'ALL' || siteFilter !== 'ALL') && (
   <div className="px-4 mt-2">
     <FilterChips
       conditions={filterGroup.conditions}
       fields={CRM_CONTACT_FILTER_FIELDS}
       onRemoveCondition={handleRemoveCondition}
       onClearAll={handleClearAllFilters}
     />
   </div>
 )}

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