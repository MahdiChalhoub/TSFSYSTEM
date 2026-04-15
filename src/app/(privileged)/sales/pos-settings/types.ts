'use client'

export type RegisterMethod = {
    id?: number; 
    methodId: number; 
    code: string; 
    name: string;
    icon: string; 
    color: string; 
    accountId: number | null;
    accountName: string | null; 
    isActive: boolean; 
    sortOrder: number;
}

export type Reg = {
    id: number; 
    name: string; 
    siteId: number; 
    siteName: string;
    warehouseId?: number; 
    cashAccountId?: number; 
    cashAccountName?: string;
    accountBookId?: number; 
    accountBookName?: string; 
    allowedAccounts: any[];
    authorizedUsers: any[]; 
    openingMode: string; 
    paymentMethods: any[];
    registerMethods?: RegisterMethod[];
    registerRulesOverride: Record<string, any>; 
    isOpen: boolean;
    isConfigComplete: boolean; 
    missingCashAccount: boolean; 
    missingAccountBook: boolean;
}

export type GlobalPaymentMethod = {
    id: number; 
    name: string; 
    code: string; 
    icon: string; 
    color: string;
    is_system: boolean; 
    is_active: boolean; 
    sort_order: number;
}

export type FA = { id: number; name: string; type: string; currency: string }
export type UD = { id: number; username: string; first_name: string; last_name: string; pos_pin?: boolean; has_override_pin?: boolean; role_name?: string }
export type Site = { id: number; name: string; code: string; registers: Reg[] }
