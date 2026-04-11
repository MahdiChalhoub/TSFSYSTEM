import { Building2, ArrowRight, Rss, Clock } from "lucide-react"

export function BlogHomePage({ org }: { org: any }) {
 const dummyPosts = [
 { title: "The Future of Enterprise Architecture", date: "Oct 12, 2023", category: "Technology", readTime: "5 min" },
 { title: "Scaling Your Digital Storefront globally", date: "Sep 28, 2023", category: "Business", readTime: "8 min" },
 { title: "Understanding Next-Gen Supply Chains", date: "Sep 15, 2023", category: "Operations", readTime: "4 min" },
 ]

 return (
 <div className="min-h-screen bg-[#FAFAFA] bg-app-bg">
 {/* Main Content */}
 <main className="max-w-5xl mx-auto px-6 py-16">
 <div className="mb-16">
 <h1 className="text-4xl md:text-5xl font-black text-app-text tracking-tighter mb-4">Latest Insights</h1>
 <p className="text-xl text-app-text-muted font-medium">Thoughts, stories and ideas from the team at {org.name}.</p>
 </div>

 <div className="grid gap-10">
 {dummyPosts.map((post, i) => (
 <article key={i} className="group cursor-pointer">
 <div className="flex items-center gap-4 text-xs font-bold text-app-text-faint uppercase tracking-widest mb-3">
 <span className="text-indigo-600">{post.category}</span>
 <span>&bull;</span>
 <span className="flex items-center gap-1"><Clock size={12} /> {post.readTime} read</span>
 </div>
 <h2 className="text-2xl font-black text-app-text mb-3 group-hover:text-indigo-600 transition-colors">
 {post.title}
 </h2>
 <p className="text-app-text-muted font-medium leading-relaxed mb-4 max-w-2xl">
 Aliquam erat volutpat. Phasellus cursus felis vitae dictum facilisis. Nunc mattis sit amet justo pretium facilisis. Aenean ut sem mattis, egestas elit ac.
 </p>
 <div className="text-sm font-bold text-app-text-faint">
 {post.date}
 </div>
 </article>
 ))}
 </div>

 <div className="mt-16 pt-16 border-t border-app-border text-center">
 <button className="h-12 px-8 rounded-full border-2 border-app-border text-sm font-bold text-app-text-muted hover:border-gray-900 hover:text-app-text transition-colors flex items-center gap-2 mx-auto">
 <Rss size={16} /> Subscribe to RSS
 </button>
 </div>
 </main>
 </div>
 )
}
