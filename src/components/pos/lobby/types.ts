export interface RegisterUser { id: number; name: string; username: string; hasPin: boolean; }
export interface RegisterAccount { id: number; name: string; type: string; }
export interface RegisterSession { id: number; cashierId: number; cashierName: string; openedAt: string; openingBalance: number; }
export interface Register {
    id: number; name: string; isOpen: boolean; currentSession: RegisterSession | null;
    cashAccountId: number | null; cashAccountName: string | null;
    warehouseId: number | null; warehouseName: string | null;
    allowedAccounts: RegisterAccount[]; authorizedUsers: RegisterUser[];
    openingMode?: string; cashierCanSeeSoftware?: boolean;
    paymentMethods?: Array<{ key: string; label: string; accountId: number | null }>;
}
export interface Site { id: number; name: string; code: string; address: string; registers: Register[]; }
export interface POSLobbyProps {
    currency: string;
    onEnterPOS: (config: {
        registerId: number; registerName: string; sessionId: number;
        cashierId: number; cashierName: string; warehouseId: number | null;
        cashAccountId: number | null; allowedAccounts: RegisterAccount[];
        siteName: string; paymentMethods: Array<{ key: string; label: string; accountId: number | null }>;
    }) => void;
}
export type LobbyStep = 'site' | 'register' | 'user' | 'pin' | 'opening';
