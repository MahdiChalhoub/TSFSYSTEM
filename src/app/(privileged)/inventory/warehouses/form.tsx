'use client';

import { useActionState, useState } from 'react';
import { createWarehouse, updateWarehouse } from '@/app/actions/inventory/warehouses';
import { Warehouse, X, Building2, Store, Cloud, MapPin, Phone, FileText } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';

export default function WarehouseModal({
    warehouse,
    onClose,
    parentOptions = [],
    defaultParent = null,
}: {
    warehouse?: Record<string, any>,
    onClose: () => void,
    parentOptions?: { id: number; name: string }[],
    defaultParent?: number | null,
}) {
    const { t } = useTranslation();
    const LOCATION_TYPES = [
        { value: 'BRANCH', label: t('inventory.branch'), icon: Building2, desc: 'Top-level location (HQ, branch, office)', color: 'indigo' },
        { value: 'STORE', label: t('inventory.store'), icon: Store, desc: 'Retail point-of-sale location', color: 'emerald' },
        { value: 'WAREHOUSE', label: t('inventory.warehouses'), icon: Warehouse, desc: 'Pure storage / inventory hub', color: 'slate' },
        { value: 'VIRTUAL', label: t('inventory.virtual'), icon: Cloud, desc: 'Transit, consignment, or virtual stock', color: 'violet' },
    ];

    const [state, action, isPending] = useActionState(
        warehouse ? updateWarehouse.bind(null, warehouse.id) : createWarehouse,
        { message: '' }
    );

    const [locationType, setLocationType] = useState(warehouse?.location_type || (defaultParent ? 'STORE' : 'BRANCH'));

    const selectedType = LOCATION_TYPES.find(v => v.value === locationType) || LOCATION_TYPES[2];
    const TypeIcon = selectedType.icon;

    return (
        <div className="fixed inset-0 bg-app-background/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-app-surface rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-app-border flex justify-between items-center bg-app-background">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center bg-${selectedType.color}-100 text-${selectedType.color}-600`}>
                            <TypeIcon size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-app-foreground">
                                {warehouse ? t('inventory.edit_location') : t('inventory.new_location')}
                            </h2>
                            <p className="text-[10px] text-app-muted-foreground font-medium uppercase tracking-wider">{selectedType.label}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-app-surface rounded-xl transition-colors text-app-muted-foreground hover:text-app-foreground">
                        <X size={20} />
                    </button>
                </div>

                <form action={async (fd) => {
                    await action(fd);
                    onClose();
                }} className="p-6 space-y-5">

                    {/* Location Type Picker */}
                    <div>
                        <label className="block text-sm font-bold text-app-muted-foreground mb-2">{t('inventory.location_type')}</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {LOCATION_TYPES.map(lt => {
                                const Icon = lt.icon;
                                const isSelected = locationType === lt.value;
                                return (
                                    <label key={lt.value}
                                        className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 cursor-pointer transition-all text-center
 ${isSelected
                                                ? `border-${lt.color}-500 bg-${lt.color}-50 shadow-md`
                                                : 'border-app-border hover:border-app-border bg-app-surface'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="location_type"
                                            value={lt.value}
                                            checked={isSelected}
                                            onChange={() => setLocationType(lt.value)}
                                            className="sr-only"
                                        />
                                        <Icon size={20} className={isSelected ? `text-${lt.color}-600` : 'text-app-muted-foreground'} />
                                        <span className={`text-xs font-bold ${isSelected ? `text-${lt.color}-700` : 'text-app-muted-foreground'}`}>{lt.label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Core Fields */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-bold text-app-muted-foreground mb-1">{t('inventory.location_name')}</label>
                            <input
                                name="name"
                                defaultValue={warehouse?.name}
                                className="w-full px-4 py-2.5 rounded-xl border border-app-border focus:ring-2 focus:ring-app-primary outline-none transition-all"
                                placeholder={t('inventory.location_name_placeholder')}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-app-muted-foreground mb-1">{t('inventory.location_code')}</label>
                            <input
                                name="code"
                                defaultValue={warehouse?.code}
                                className="w-full px-4 py-2.5 rounded-xl border border-app-border focus:ring-2 focus:ring-app-primary outline-none transition-all font-mono"
                                placeholder={t('inventory.auto_generated')}
                            />
                            <p className="mt-1 text-[10px] text-app-muted-foreground">{t('inventory.auto_increment_hint')}</p>
                        </div>

                        {parentOptions.length > 0 && locationType !== 'BRANCH' && (
                            <div>
                                <label className="block text-sm font-bold text-app-muted-foreground mb-1">
                                    {t('inventory.assign_to_branch')} <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    name="parent"
                                    defaultValue={warehouse?.parent || defaultParent || ''}
                                    required
                                    className="w-full px-4 py-2.5 rounded-xl border border-app-border focus:ring-2 focus:ring-app-primary outline-none transition-all"
                                >
                                    <option value="" disabled>— {t('inventory.select_branch')} —</option>
                                    {parentOptions.map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                                <p className="mt-1 text-[10px] text-app-muted-foreground">
                                    {t('inventory.branch_requirement_hint')}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Address Section */}
                    <div className="p-4 bg-app-background rounded-2xl space-y-3">
                        <div className="flex items-center gap-2 text-sm font-bold text-app-muted-foreground mb-2">
                            <MapPin size={16} />
                            {t('inventory.physical_address')}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <input
                                    name="address"
                                    defaultValue={warehouse?.address}
                                    className="w-full px-4 py-2 rounded-xl border border-app-border focus:ring-2 focus:ring-app-primary outline-none transition-all text-sm"
                                    placeholder={t('inventory.street_address_placeholder')}
                                />
                            </div>
                            <input
                                name="city"
                                defaultValue={warehouse?.city}
                                className="w-full px-4 py-2 rounded-xl border border-app-border focus:ring-2 focus:ring-app-primary outline-none transition-all text-sm"
                                placeholder={t('inventory.city')}
                            />
                            <div className="flex items-center gap-2">
                                <Phone size={14} className="text-app-muted-foreground shrink-0" />
                                <input
                                    name="phone"
                                    defaultValue={warehouse?.phone}
                                    className="w-full px-4 py-2 rounded-xl border border-app-border focus:ring-2 focus:ring-app-primary outline-none transition-all text-sm"
                                    placeholder={t('inventory.phone')}
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <FileText size={14} className="text-app-muted-foreground shrink-0" />
                            <input
                                name="vat_number"
                                defaultValue={warehouse?.vat_number}
                                className="w-full px-4 py-2 rounded-xl border border-app-border focus:ring-2 focus:ring-app-primary outline-none transition-all text-sm"
                                placeholder={t('inventory.vat_tax_id')}
                            />
                        </div>
                    </div>

                    {/* Operational Flags — only for non-BRANCH types */}
                    {locationType !== 'BRANCH' && (
                        <div className="p-4 bg-app-primary-light rounded-2xl space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-bold text-app-success">{t('inventory.commercial_pos')}</h4>
                                    <p className="text-[10px] text-app-success">{t('inventory.can_sell_hint')}</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" name="canSell" defaultChecked={warehouse?.can_sell !== false} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-app-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-app-surface after:border-app-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-app-primary"></div>
                                </label>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <input type="checkbox" name="isActive" defaultChecked={warehouse?.is_active !== false} id="isActive" className="rounded-md border-app-border text-app-primary focus:ring-app-primary" />
                        <label htmlFor="isActive" className="text-sm font-medium text-app-muted-foreground">
                            {locationType === 'BRANCH'
                                ? t('inventory.branch_active_hint')
                                : t('inventory.location_active_hint')}
                        </label>
                    </div>

                    <div className="pt-4 border-t border-app-border flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 rounded-xl font-bold text-app-muted-foreground hover:bg-app-background transition-all text-sm"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-1 bg-app-primary text-app-foreground px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-900/20 hover:bg-app-primary transition-all text-sm disabled:opacity-50"
                        >
                            {isPending ? t('inventory.saving') : (warehouse ? t('inventory.update_location') : t('inventory.create_location'))}
                        </button>
                    </div>

                    {state.message && state.message !== 'success' && (
                        <p className="text-center text-app-error text-xs font-bold">{state.message}</p>
                    )}
                </form>
            </div>
        </div>
    );
}