'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { CategoryFormModal } from './CategoryFormModal';

export function CreateCategoryButton({ potentialParents = [] }: { potentialParents?: Record<string, any>[] }) {
 const [isOpen, setIsOpen] = useState(false);

 return (
 <>
 <button
 onClick={() => setIsOpen(true)}
 className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-emerald-900/20 hover:-translate-y-0.5 transition-all flex items-center gap-2"
 >
 <Plus size={20} />
 <span>Create Category</span>
 </button>

 <CategoryFormModal
 isOpen={isOpen}
 onClose={() => setIsOpen(false)}
 potentialParents={potentialParents}
 />
 </>
 );
}