import { Building, Globe, Mail } from 'lucide-react';

export default function BusinessSettings() {
 return (
 <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-6">
 <h2 className="text-xl font-semibold text-app-text mb-6 flex items-center gap-2">
 <Building className="text-app-text-faint" size={24} />
 Business Profile
 </h2>

 <div className="space-y-6 max-w-2xl">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="space-y-2">
 <label className="text-sm font-medium text-app-text-muted">Business Name</label>
 <input
 type="text"
 className="w-full px-4 py-2 rounded-lg border border-app-border focus:outline-none focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary transition-all font-medium"
 defaultValue="Acme Corp"
 />
 </div>

 <div className="space-y-2">
 <label className="text-sm font-medium text-app-text-muted">Display Slug</label>
 <div className="flex">
 <span className="px-4 py-2 bg-app-bg border border-r-0 border-app-border rounded-l-lg text-app-text-muted text-sm flex items-center">@</span>
 <input
 type="text"
 className="w-full px-4 py-2 rounded-r-lg border border-app-border focus:outline-none focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary transition-all font-mono text-sm"
 defaultValue="acme"
 />
 </div>
 </div>
 </div>

 <div className="space-y-2">
 <label className="text-sm font-medium text-app-text-muted">Primary Contact Email</label>
 <div className="relative">
 <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-faint" size={16} />
 <input
 type="email"
 className="w-full pl-10 pr-4 py-2 rounded-lg border border-app-border focus:outline-none focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary transition-all"
 defaultValue="admin@acme.inc"
 />
 </div>
 </div>

 <div className="space-y-2">
 <label className="text-sm font-medium text-app-text-muted">Public Website</label>
 <div className="relative">
 <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-faint" size={16} />
 <input
 type="url"
 className="w-full pl-10 pr-4 py-2 rounded-lg border border-app-border focus:outline-none focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary transition-all"
 defaultValue="https://acme.inc"
 />
 </div>
 </div>

 <div className="pt-4 border-t border-app-border flex justify-end">
 <button className="px-6 py-2 bg-app-surface hover:bg-black text-app-text rounded-lg font-medium transition-colors shadow-lg shadow-gray-900/10">
 Save Changes
 </button>
 </div>
 </div>
 </div>
 );
}
