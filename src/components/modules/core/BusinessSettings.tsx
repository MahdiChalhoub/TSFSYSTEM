import { Building, Globe, Mail } from 'lucide-react';

export default function BusinessSettings() {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-app-border p-6">
            <h2 className="mb-6 flex items-center gap-2">
                <Building className="text-app-muted-foreground" size={24} />
                Business Profile
            </h2>

            <div className="space-y-6 max-w-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-app-muted-foreground">Business Name</label>
                        <input
                            type="text"
                            className="w-full px-4 py-2 rounded-lg border border-app-border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-app-success transition-all font-medium"
                            defaultValue="Acme Corp"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-app-muted-foreground">Display Slug</label>
                        <div className="flex">
                            <span className="px-4 py-2 bg-gray-50 border border-r-0 border-app-border rounded-l-lg text-app-muted-foreground text-sm flex items-center">@</span>
                            <input
                                type="text"
                                className="w-full px-4 py-2 rounded-r-lg border border-app-border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-app-success transition-all font-mono text-sm"
                                defaultValue="acme"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-app-muted-foreground">Primary Contact Email</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" size={16} />
                        <input
                            type="email"
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-app-border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-app-success transition-all"
                            defaultValue="admin@acme.inc"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-app-muted-foreground">Public Website</label>
                    <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" size={16} />
                        <input
                            type="url"
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-app-border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-app-success transition-all"
                            defaultValue="https://acme.inc"
                        />
                    </div>
                </div>

                <div className="pt-4 border-t border-app-border flex justify-end">
                    <button className="px-6 py-2 bg-gray-900 hover:bg-black text-white rounded-lg font-medium transition-colors shadow-lg shadow-gray-900/10">
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
