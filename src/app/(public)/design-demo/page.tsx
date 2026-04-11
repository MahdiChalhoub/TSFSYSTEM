/**
 * PUBLIC Design Variants Demo Page
 * =================================
 * NO LOGIN REQUIRED!
 * Navigate to: http://localhost:3000/design-demo
 */
"use client"

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card-with-variants"
import { Heart, Star, Sparkles } from "lucide-react"

export default function PublicDesignDemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4 mb-12">
          <div className="flex items-center justify-center gap-3">
            <Sparkles className="h-10 w-10 text-yellow-400 animate-pulse" />
            <h1 className="text-5xl font-bold text-white">
              Design Variants Showcase
            </h1>
            <Sparkles className="h-10 w-10 text-yellow-400 animate-pulse" />
          </div>
          <p className="text-white/70 text-xl">
            3 Beautiful Styles - Choose Your Favorite!
          </p>
          <p className="text-white/50 text-sm">
            ✅ No login required | ✅ No data loss | ✅ Switch anytime
          </p>
        </div>

        {/* Variant Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* DEFAULT VARIANT */}
          <div className="space-y-4">
            <div className="text-center bg-black/30 rounded-lg p-4 backdrop-blur-sm">
              <h2 className="text-2xl font-bold text-white mb-2">
                1. Default
              </h2>
              <p className="text-sm text-white/60 mb-2">
                Your current style (unchanged)
              </p>
              <code className="text-xs bg-black/50 text-green-400 px-3 py-1 rounded-full">
                variant="default"
              </code>
              <p className="text-xs text-white/50 mt-2">
                Clean • Professional • Minimal
              </p>
            </div>
            
            <Card variant="default">
              <CardHeader variant="default">
                <CardTitle variant="default" className="text-lg">
                  Invoice #12345
                </CardTitle>
                <CardDescription variant="default">
                  Due: March 15, 2026
                </CardDescription>
              </CardHeader>
              <CardContent variant="default">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">$1,250.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax (10%)</span>
                    <span className="font-medium">$125.00</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-lg">$1,375.00</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-300 px-4 py-2 rounded-full text-sm">
                ✅ Currently Using
              </div>
            </div>
          </div>

          {/* MODERN VARIANT */}
          <div className="space-y-4">
            <div className="text-center bg-purple-500/20 rounded-lg p-4 backdrop-blur-sm border-2 border-purple-400">
              <div className="flex items-center justify-center gap-2 mb-2">
                <h2 className="text-2xl font-bold text-white">
                  2. Modern
                </h2>
                <Star className="h-6 w-6 text-yellow-400 animate-bounce" />
              </div>
              <p className="text-sm text-white/60 mb-2">
                Purple theme you liked!
              </p>
              <code className="text-xs bg-black/50 text-purple-300 px-3 py-1 rounded-full">
                variant="modern"
              </code>
              <p className="text-xs text-white/50 mt-2">
                Purple Accent • Soft Shadows • Modern
              </p>
            </div>
            
            <Card variant="modern" isActive>
              <CardHeader variant="modern">
                <CardTitle variant="modern" className="text-lg">
                  Invoice #12345
                </CardTitle>
                <CardDescription variant="modern">
                  Due: March 15, 2026
                </CardDescription>
              </CardHeader>
              <CardContent variant="modern">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">$1,250.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax (10%)</span>
                    <span className="font-medium">$125.00</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#9b87f5]/30">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-lg text-[#9b87f5]">$1,375.00</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-purple-500/30 text-purple-200 px-4 py-2 rounded-full text-sm border border-purple-400">
                ⭐ RECOMMENDED
              </div>
            </div>
          </div>

          {/* GLASS VARIANT */}
          <div className="space-y-4">
            <div className="text-center bg-pink-500/20 rounded-lg p-4 backdrop-blur-sm border border-pink-400/50">
              <div className="flex items-center justify-center gap-2 mb-2">
                <h2 className="text-2xl font-bold text-white">
                  3. Glass
                </h2>
                <Heart className="h-6 w-6 text-pink-400 animate-pulse" />
              </div>
              <p className="text-sm text-white/60 mb-2">
                Premium frosted glass effect
              </p>
              <code className="text-xs bg-black/50 text-pink-300 px-3 py-1 rounded-full">
                variant="glass"
              </code>
              <p className="text-xs text-white/50 mt-2">
                Blur • Translucent • Premium
              </p>
            </div>
            
            <Card variant="glass">
              <CardHeader variant="glass">
                <CardTitle variant="glass" className="text-lg">
                  Invoice #12345
                </CardTitle>
                <CardDescription variant="glass">
                  Due: March 15, 2026
                </CardDescription>
              </CardHeader>
              <CardContent variant="glass">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm text-white/90">
                    <span className="text-white/60">Subtotal</span>
                    <span className="font-medium">$1,250.00</span>
                  </div>
                  <div className="flex justify-between text-sm text-white/90">
                    <span className="text-white/60">Tax (10%)</span>
                    <span className="font-medium">$125.00</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-white/20 text-white">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-lg">$1,375.00</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-pink-500/30 text-pink-200 px-4 py-2 rounded-full text-sm border border-pink-400">
                💎 PREMIUM
              </div>
            </div>
          </div>

        </div>

        {/* How It Works Section */}
        <div className="mt-16 space-y-6">
          <h2 className="text-3xl font-bold text-white text-center">
            How It Works (Super Simple!)
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <Card variant="glass">
              <CardHeader variant="glass">
                <div className="text-4xl mb-2">1️⃣</div>
                <CardTitle variant="glass" className="text-lg">
                  Change One Line
                </CardTitle>
              </CardHeader>
              <CardContent variant="glass">
                <pre className="text-xs text-white/80 bg-black/40 p-3 rounded overflow-x-auto">
{`<Card variant="modern">
  Your content
</Card>`}
                </pre>
                <p className="text-xs text-white/60 mt-3">
                  Just add <code className="bg-white/20 px-1 rounded">variant="modern"</code> prop!
                </p>
              </CardContent>
            </Card>

            <Card variant="glass">
              <CardHeader variant="glass">
                <div className="text-4xl mb-2">2️⃣</div>
                <CardTitle variant="glass" className="text-lg">
                  No Data Loss
                </CardTitle>
              </CardHeader>
              <CardContent variant="glass">
                <div className="space-y-2 text-white/80 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 text-lg">✓</span>
                    <span>All existing pages work</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 text-lg">✓</span>
                    <span>All data stays safe</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 text-lg">✓</span>
                    <span>Switch back anytime</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card variant="glass">
              <CardHeader variant="glass">
                <div className="text-4xl mb-2">3️⃣</div>
                <CardTitle variant="glass" className="text-lg">
                  Mix & Match
                </CardTitle>
              </CardHeader>
              <CardContent variant="glass">
                <div className="space-y-2 text-white/80 text-sm">
                  <div>Finance → <span className="text-purple-300">modern</span></div>
                  <div>Dashboard → <span className="text-pink-300">glass</span></div>
                  <div>POS → <span className="text-green-300">default</span></div>
                  <p className="text-xs text-white/50 mt-2 pt-2 border-t border-white/20">
                    Each page can have its own style!
                  </p>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>

        {/* Stats Demo */}
        <div className="mt-12">
          <h3 className="text-2xl font-bold text-white text-center mb-6">
            See Them in Action
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <Card variant="default">
              <CardContent variant="default" className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Revenue</p>
                  <p className="text-3xl font-bold">$45,231</p>
                  <p className="text-xs text-green-600 mt-1">+12.5% vs last month</p>
                </div>
              </CardContent>
            </Card>

            <Card variant="modern" isActive>
              <CardContent variant="modern" className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Users</p>
                  <p className="text-3xl font-bold text-[#9b87f5]">2,543</p>
                  <p className="text-xs text-green-600 mt-1">+8.3% vs last week</p>
                </div>
              </CardContent>
            </Card>

            <Card variant="glass">
              <CardContent variant="glass" className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-white/60 mb-1">Growth</p>
                  <p className="text-3xl font-bold text-white">+18%</p>
                  <p className="text-xs text-emerald-300 mt-1">Year over year</p>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>

        {/* CTA Section */}
        <Card variant="modern" className="mt-12">
          <CardHeader variant="modern">
            <CardTitle variant="modern" className="text-2xl text-center">
              🎨 Ready to Transform Your UI?
            </CardTitle>
            <CardDescription variant="modern" className="text-center text-base">
              Pick your favorite and start using it page-by-page!
            </CardDescription>
          </CardHeader>
          <CardContent variant="modern">
            <div className="text-center space-y-4">
              <p className="text-sm">
                Read the full guide: <code className="bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded">HOW_TO_USE_DESIGN_VARIANTS.md</code>
              </p>
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                <div className="bg-[#9b87f5]/20 px-4 py-2 rounded-full border border-[#9b87f5]">
                  ⚡ 2 lines of code per page
                </div>
                <div className="bg-[#9b87f5]/20 px-4 py-2 rounded-full border border-[#9b87f5]">
                  🔄 Switch back anytime
                </div>
                <div className="bg-[#9b87f5]/20 px-4 py-2 rounded-full border border-[#9b87f5]">
                  ✅ Zero risk
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
