'use client'
import { useEffect, useState, useCallback } from 'react'
import {
 Star, Search, Filter, Trash2, Eye, EyeOff,
 MessageSquare, CheckCircle2, AlertCircle, Loader2, ArrowUpRight
} from 'lucide-react'
import { TypicalListView, ColumnDef } from '@/components/common/TypicalListView'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
export default function ReviewManagementPage() {
 const [reviews, setReviews] = useState<any[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const settings = useListViewSettings('ecom_reviews', {
 columns: ['product', 'customer', 'rating', 'title', 'status', 'date', 'actions'],
 pageSize: 25, sortKey: 'created_at', sortDir: 'desc'
 })
 const loadReviews = useCallback(async () => {
 setLoading(true)
 try {
 const res = await fetch('/api/client_portal/reviews/')
 if (res.ok) {
 const data = await res.json()
 setReviews(Array.isArray(data) ? data : data.results || [])
 }
 } catch (err) {
 console.error(err)
 } finally {
 setLoading(false)
 }
 }, [])
 useEffect(() => { loadReviews() }, [loadReviews])
 const toggleVisibility = async (review: any) => {
 try {
 const res = await fetch(`/api/client_portal/reviews/${review.id}/`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ is_visible: !review.is_visible })
 })
 if (res.ok) loadReviews()
 } catch (err) { console.error(err) }
 }
 const deleteReview = async (id: string) => {
 if (!confirm('Are you sure you want to delete this review?')) return
 try {
 const res = await fetch(`/api/client_portal/reviews/${id}/`, { method: 'DELETE' })
 if (res.ok) loadReviews()
 } catch (err) { console.error(err) }
 }
 const columns: ColumnDef<any>[] = [
 {
 key: 'product',
 label: 'Product',
 render: (r) => (
 <div className="app-page flex flex-col">
 <span className="font-bold text-app-foreground line-clamp-1">{r.product_name || `Product #${r.product}`}</span>
 <span className="text-[10px] text-app-muted-foreground font-mono">ID: {r.product}</span>
 </div>
 )
 },
 {
 key: 'customer',
 label: 'Customer',
 render: (r) => (
 <div className="flex items-center gap-2">
 <div className="w-7 h-7 rounded-full bg-app-primary/5 flex items-center justify-center text-app-primary font-black text-[10px]">
 {r.name?.substring(0, 2).toUpperCase()}
 </div>
 <div className="flex flex-col">
 <span className="font-medium text-app-muted-foreground">{r.name}</span>
 {r.is_verified_purchase && (
 <span className="flex items-center gap-1 text-[9px] text-app-primary font-bold uppercase tracking-widest">
 <CheckCircle2 size={10} /> Verified
 </span>
 )}
 </div>
 </div>
 )
 },
 {
 key: 'rating',
 label: 'Rating',
 render: (r) => (
 <div className="flex items-center gap-0.5 text-app-warning">
 {[1, 2, 3, 4, 5].map(s => (
 <Star key={s} size={12} fill={s <= r.rating ? 'currentColor' : 'none'} className={s > r.rating ? 'text-app-foreground' : ''} />
 ))}
 </div>
 )
 },
 {
 key: 'title',
 label: 'Content',
 render: (r) => (
 <div className="max-w-md">
 <p className="font-bold text-app-foreground text-xs truncate">{r.title}</p>
 <p className="text-app-muted-foreground text-[11px] line-clamp-1 italic">"{r.content}"</p>
 </div>
 )
 },
 {
 key: 'status',
 label: 'Status',
 render: (r) => (
 <Badge variant={r.is_visible ? 'default' : 'secondary'} className={`h-5 text-[9px] font-black uppercase px-2 ${r.is_visible ? 'bg-app-primary hover:bg-app-primary border-none' : ''}`}>
 {r.is_visible ? 'Published' : 'Hidden'}
 </Badge>
 )
 },
 {
 key: 'date',
 label: 'Date',
 render: (r) => <span className="text-app-muted-foreground text-[11px]">{new Date(r.created_at).toLocaleDateString()}</span>
 },
 {
 key: 'actions',
 label: '',
 align: 'right',
 render: (r) => (
 <div className="flex items-center justify-end gap-1">
 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => toggleVisibility(r)}>
 {r.is_visible ? <EyeOff size={14} className="text-app-muted-foreground" /> : <Eye size={14} className="text-app-primary" />}
 </Button>
 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => deleteReview(r.id)}>
 <Trash2 size={14} />
 </Button>
 </div>
 )
 }
 ]
 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto">
 <header className="flex justify-between items-end">
 <div className="space-y-2">
 <Badge className="bg-app-primary-light text-app-primary border-none font-black text-[10px] uppercase tracking-widest px-3 py-1">
 Social Proof Engine
 </Badge>
 <h1 className="page-header-title tracking-tighter text-app-foreground flex items-center gap-4">
 <div className="w-16 h-16 rounded-[1.8rem] bg-app-primary flex items-center justify-center shadow-2xl shadow-indigo-200 text-app-foreground">
 <MessageSquare size={32} />
 </div>
 Customer <span className="text-app-primary">Reviews</span>
 </h1>
 </div>
 </header>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden">
 <CardContent className="p-4">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-app-muted-foreground" />
 <Input
 placeholder="Search reviews by content, title, or customer name..."
 value={search}
 onChange={e => setSearch(e.target.value)}
 className="pl-9 h-11 rounded-2xl bg-app-background border-0 focus-visible:ring-app-primary"
 />
 </div>
 </CardContent>
 </Card>
 <TypicalListView
 title="Review Moderation Queue"
 data={reviews.filter(r =>
 (r.title?.toLowerCase().includes(search.toLowerCase()) ||
 r.name?.toLowerCase().includes(search.toLowerCase()) ||
 r.content?.toLowerCase().includes(search.toLowerCase()))
 )}
 loading={loading}
 columns={columns}
 getRowId={(r) => r.id}
 pageSize={settings.pageSize}
 onPageSizeChange={settings.setPageSize}
 visibleColumns={settings.visibleColumns}
 onToggleColumn={settings.toggleColumn}
 className="rounded-[2.5rem] border-0 shadow-sm overflow-hidden bg-app-surface"
 />
 </div>
 )
}
