'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { UnitFormModal } from './UnitFormModal';

export function CreateUnitButton({ potentialParents = [] }: { potentialParents?: Record<string, any>[] }) {
 const [isOpen, setIsOpen] = useState(false);

 return (
 <>
 <button
 onClick={() => setIsOpen(true)}
 className="bg-app-primary text-app-text px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-app-primary/20 hover:-translate-y-0.5 transition-all flex items-center gap-2"
 >
 <Plus size={20} />
 <span>Create Base Unit</span>
 </button>

 <UnitFormModal isOpen={isOpen} onClose={() => setIsOpen(false)} potentialParents={potentialParents} />
 </>
 );
}