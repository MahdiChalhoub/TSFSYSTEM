export default function TenantWelcomePage({ params }: { params: { slug: string } }) {
    const slug = params.slug

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
            <div className="max-w-md w-full space-y-8 text-center">
                <div className="mx-auto w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/20">
                    <span className="text-white text-4xl font-black">B</span>
                </div>
                <div className="space-y-2">
                    <h1 className="text-3xl font-black text-white capitalize">{slug}</h1>
                    <p className="text-slate-400 font-medium tracking-tight">Enterprise Identity Verified</p>
                </div>

                <div className="p-8 bg-slate-900/50 border border-slate-800 rounded-[2.5rem] space-y-6">
                    <div className="space-y-1">
                        <h2 className="text-xl font-bold text-white">Login to your dashboard</h2>
                        <p className="text-sm text-slate-500">Enter your credentials for {slug}.tsf-city.com</p>
                    </div>

                    <div className="space-y-4 pt-4">
                        <input
                            type="email"
                            placeholder="Email address"
                            className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-white outline-none focus:border-emerald-500 transition-colors"
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-white outline-none focus:border-emerald-500 transition-colors"
                        />
                        <button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-4 rounded-xl font-black transition-all shadow-lg shadow-emerald-900/20">
                            Secure Access
                        </button>
                    </div>
                </div>

                <p className="text-xs text-slate-600">
                    Protected by TSF CITY Shield Multi-Tenant Isolation
                </p>
            </div>
        </div>
    )
}
