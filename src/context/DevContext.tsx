'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

type OperationResult = {
    type: 'READ' | 'WRITE' | 'ERROR';
    module: string;
    details: string;
    timestamp: Date;
    data?: any;
    status?: 'SUCCESS' | 'FAILURE' | 'PENDING';
};

type DevContextType = {
    lastOperation: OperationResult | null;
    logOperation: (op: OperationResult) => void;
};

const DevContext = createContext<DevContextType | undefined>(undefined);

export function DevProvider({ children }: { children: ReactNode }) {
    const [lastOperation, setLastOperation] = useState<OperationResult | null>(null);

    const logOperation = (op: OperationResult) => {
        setLastOperation(op);
    };

    return (
        <DevContext.Provider value={{ lastOperation, logOperation }}>
            {children}
        </DevContext.Provider>
    );
}

export const useDev = () => {
    const context = useContext(DevContext);
    if (!context) throw new Error('useDev must be used within DevProvider');
    return context;
};
