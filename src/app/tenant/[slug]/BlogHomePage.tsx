import { Building2, ArrowRight, Rss, Clock } from "lucide-react"

export function BlogHomePage({ org }: { org: any }) {
    const dummyPosts = [
        { title: "The Future of Enterprise Architecture", date: "Oct 12, 2023", category: "Technology", readTime: "5 min" },
        { title: "Scaling Your Digital Storefront globally", date: "Sep 28, 2023", category: "Business", readTime: "8 min" },
        { title: "Understanding Next-Gen Supply Chains", date: "Sep 15, 2023", category: "Operations", readTime: "4 min" },
    ]

    return (
        <div className="min-h-screen bg-[#FAFAFA]">
            {/* Minimal Header */}
            <header className="border-b border-gray-200 bg-white">
                <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {org.logo ? (
                            <img src={org.logo} alt={org.name} className="h-8 object-contain" />
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center text-white">
                                <Building2 size={20} />
                            </div>
                        )}
                        <span className="font-black text-xl text-gray-900 tracking-tight">{org.name} Blog</span>
                    </div>
                    <a href="/login" className="text-sm font-bold text-gray-600 hover:text-gray-900">Sign In &rarr;</a>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-5xl mx-auto px-6 py-16">
                <div className="mb-16">
                    <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tighter mb-4">Latest Insights</h1>
                    <p className="text-xl text-gray-500 font-medium">Thoughts, stories and ideas from the team at {org.name}.</p>
                </div>

                <div className="grid gap-10">
                    {dummyPosts.map((post, i) => (
                        <article key={i} className="group cursor-pointer">
                            <div className="flex items-center gap-4 text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                                <span className="text-indigo-600">{post.category}</span>
                                <span>&bull;</span>
                                <span className="flex items-center gap-1"><Clock size={12} /> {post.readTime} read</span>
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 mb-3 group-hover:text-indigo-600 transition-colors">
                                {post.title}
                            </h2>
                            <p className="text-gray-500 font-medium leading-relaxed mb-4 max-w-2xl">
                                Aliquam erat volutpat. Phasellus cursus felis vitae dictum facilisis. Nunc mattis sit amet justo pretium facilisis. Aenean ut sem mattis, egestas elit ac.
                            </p>
                            <div className="text-sm font-bold text-gray-400">
                                {post.date}
                            </div>
                        </article>
                    ))}
                </div>

                <div className="mt-16 pt-16 border-t border-gray-200 text-center">
                    <button className="h-12 px-8 rounded-full border-2 border-gray-200 text-sm font-bold text-gray-600 hover:border-gray-900 hover:text-gray-900 transition-colors flex items-center gap-2 mx-auto">
                        <Rss size={16} /> Subscribe to RSS
                    </button>
                </div>
            </main>
        </div>
    )
}
