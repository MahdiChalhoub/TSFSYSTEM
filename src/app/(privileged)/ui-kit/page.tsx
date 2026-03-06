'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ThemeSwitcher } from '@/components/shared/ThemeSwitcher'
import { LayoutSwitcher } from '@/components/shared/LayoutSwitcher'
import { useTheme } from '@/contexts/ThemeContext'
import { useLayout } from '@/contexts/LayoutContext'
import {
  Palette, Layout, Check, Star, Heart, Zap, Bell,
  Settings, Users, Mail, Calendar, Search, Filter,
  Download, Upload, Edit, Trash, Plus, Minus,
  AlertCircle, Info, CheckCircle, XCircle
} from 'lucide-react'

export default function UIKitShowcasePage() {
  const { theme, themeConfig } = useTheme()
  const { layout, layoutConfig } = useLayout()

  return (
    <div className="min-h-screen layout-container-padding space-y-[var(--layout-section-spacing)] pb-20 max-w-[1600px] mx-auto">
      {/* Hero Header */}
      <header className="text-center space-y-4 py-12">
        <div className="inline-flex items-center gap-3 px-6 py-3 layout-card-radius theme-surface border theme-border">
          <Palette className="w-6 h-6 theme-primary" />
          <h1 className="text-5xl font-black tracking-tight theme-text">
            UI Kit <span className="theme-primary">Showcase</span>
          </h1>
          <Layout className="w-6 h-6 theme-primary" />
        </div>
        <p className="text-xl theme-text-muted max-w-3xl mx-auto">
          2000+ UI variants • 10 themes × 6 layouts × 35+ components
        </p>
        <div className="flex items-center justify-center gap-4 pt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold theme-text-muted">Current Theme:</span>
            <Badge className="theme-primary" style={{ background: 'var(--theme-primary)', color: 'var(--theme-bg)' }}>
              {themeConfig.name}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold theme-text-muted">Layout:</span>
            <Badge className="theme-primary" style={{ background: 'var(--theme-primary)', color: 'var(--theme-bg)' }}>
              {layoutConfig.name}
            </Badge>
          </div>
        </div>
      </header>

      {/* Theme & Layout Controls */}
      <Card className="layout-card-radius border-0 shadow-lg theme-surface">
        <CardHeader className="layout-card-padding border-b theme-border">
          <CardTitle className="theme-text flex items-center gap-2">
            <Settings className="w-5 h-5 theme-primary" />
            Customize Appearance
          </CardTitle>
          <CardDescription className="theme-text-muted">
            Switch between themes and layouts to see all 60 combinations in action
          </CardDescription>
        </CardHeader>
        <CardContent className="layout-card-padding">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-bold theme-text mb-3 block">Select Theme</label>
              <ThemeSwitcher showLabel={true} />
            </div>
            <div>
              <label className="text-sm font-bold theme-text mb-3 block">Select Layout</label>
              <LayoutSwitcher showLabel={true} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="buttons" className="space-y-6">
        <TabsList className="layout-card-radius theme-surface border theme-border">
          <TabsTrigger value="buttons">Buttons</TabsTrigger>
          <TabsTrigger value="inputs">Inputs</TabsTrigger>
          <TabsTrigger value="cards">Cards</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="badges">Badges</TabsTrigger>
          <TabsTrigger value="complex">Complex</TabsTrigger>
        </TabsList>

        {/* BUTTONS SECTION */}
        <TabsContent value="buttons" className="space-y-6">
          <Card className="layout-card-radius border-0 shadow-sm theme-surface">
            <CardHeader className="layout-card-padding border-b theme-border">
              <CardTitle className="theme-text">Button Variants</CardTitle>
              <CardDescription className="theme-text-muted">
                All button styles, sizes, and states
              </CardDescription>
            </CardHeader>
            <CardContent className="layout-card-padding space-y-8">
              {/* Default Buttons */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold theme-text-muted uppercase tracking-wider">Default Variant</h3>
                <div className="flex flex-wrap gap-4">
                  <Button size="sm">Small Button</Button>
                  <Button>Default Button</Button>
                  <Button size="lg">Large Button</Button>
                  <Button size="icon"><Star className="w-4 h-4" /></Button>
                </div>
              </div>

              {/* Outline Buttons */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold theme-text-muted uppercase tracking-wider">Outline Variant</h3>
                <div className="flex flex-wrap gap-4">
                  <Button variant="outline" size="sm">Small Outline</Button>
                  <Button variant="outline">Default Outline</Button>
                  <Button variant="outline" size="lg">Large Outline</Button>
                  <Button variant="outline" size="icon"><Heart className="w-4 h-4" /></Button>
                </div>
              </div>

              {/* Ghost Buttons */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold theme-text-muted uppercase tracking-wider">Ghost Variant</h3>
                <div className="flex flex-wrap gap-4">
                  <Button variant="ghost" size="sm">Small Ghost</Button>
                  <Button variant="ghost">Default Ghost</Button>
                  <Button variant="ghost" size="lg">Large Ghost</Button>
                  <Button variant="ghost" size="icon"><Zap className="w-4 h-4" /></Button>
                </div>
              </div>

              {/* Destructive Buttons */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold theme-text-muted uppercase tracking-wider">Destructive Variant</h3>
                <div className="flex flex-wrap gap-4">
                  <Button variant="destructive" size="sm">Delete</Button>
                  <Button variant="destructive">Remove Item</Button>
                  <Button variant="destructive" size="lg">Permanent Delete</Button>
                  <Button variant="destructive" size="icon"><Trash className="w-4 h-4" /></Button>
                </div>
              </div>

              {/* Icon Buttons */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold theme-text-muted uppercase tracking-wider">With Icons</h3>
                <div className="flex flex-wrap gap-4">
                  <Button><Plus className="w-4 h-4 mr-2" /> Add New</Button>
                  <Button variant="outline"><Download className="w-4 h-4 mr-2" /> Download</Button>
                  <Button variant="ghost"><Upload className="w-4 h-4 mr-2" /> Upload</Button>
                  <Button variant="destructive"><Trash className="w-4 h-4 mr-2" /> Delete</Button>
                </div>
              </div>

              {/* Disabled States */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold theme-text-muted uppercase tracking-wider">Disabled States</h3>
                <div className="flex flex-wrap gap-4">
                  <Button disabled>Disabled Default</Button>
                  <Button variant="outline" disabled>Disabled Outline</Button>
                  <Button variant="ghost" disabled>Disabled Ghost</Button>
                  <Button variant="destructive" disabled>Disabled Destructive</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* INPUTS SECTION */}
        <TabsContent value="inputs" className="space-y-6">
          <Card className="layout-card-radius border-0 shadow-sm theme-surface">
            <CardHeader className="layout-card-padding border-b theme-border">
              <CardTitle className="theme-text">Input Components</CardTitle>
              <CardDescription className="theme-text-muted">
                Text inputs, selects, switches, and sliders
              </CardDescription>
            </CardHeader>
            <CardContent className="layout-card-padding space-y-8">
              {/* Text Inputs */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold theme-text-muted uppercase tracking-wider">Text Inputs</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium theme-text mb-2 block">Default Input</label>
                    <Input placeholder="Enter text..." />
                  </div>
                  <div>
                    <label className="text-sm font-medium theme-text mb-2 block">With Icon</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 theme-text-muted" />
                      <Input placeholder="Search..." className="pl-10" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium theme-text mb-2 block">Email Input</label>
                    <Input type="email" placeholder="your@email.com" />
                  </div>
                  <div>
                    <label className="text-sm font-medium theme-text mb-2 block">Password Input</label>
                    <Input type="password" placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="text-sm font-medium theme-text mb-2 block">Disabled Input</label>
                    <Input placeholder="Disabled..." disabled />
                  </div>
                  <div>
                    <label className="text-sm font-medium theme-text mb-2 block">Date Input</label>
                    <Input type="date" />
                  </div>
                </div>
              </div>

              {/* Select Dropdowns */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold theme-text-muted uppercase tracking-wider">Select Dropdowns</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium theme-text mb-2 block">Default Select</label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="option1">Option 1</SelectItem>
                        <SelectItem value="option2">Option 2</SelectItem>
                        <SelectItem value="option3">Option 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium theme-text mb-2 block">Categories</label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="electronics">Electronics</SelectItem>
                        <SelectItem value="clothing">Clothing</SelectItem>
                        <SelectItem value="food">Food & Beverage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Switches */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold theme-text-muted uppercase tracking-wider">Toggle Switches</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 layout-card-radius theme-surface border theme-border">
                    <div>
                      <p className="text-sm font-medium theme-text">Enable notifications</p>
                      <p className="text-xs theme-text-muted">Receive alerts and updates</p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between p-4 layout-card-radius theme-surface border theme-border">
                    <div>
                      <p className="text-sm font-medium theme-text">Dark mode</p>
                      <p className="text-xs theme-text-muted">Toggle theme appearance</p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between p-4 layout-card-radius theme-surface border theme-border">
                    <div>
                      <p className="text-sm font-medium theme-text">Auto-save</p>
                      <p className="text-xs theme-text-muted">Automatically save changes</p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </div>

              {/* Number Input */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold theme-text-muted uppercase tracking-wider">Number Inputs</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium theme-text mb-2 block">Quantity</label>
                    <Input type="number" placeholder="0" min="0" />
                  </div>
                  <div>
                    <label className="text-sm font-medium theme-text mb-2 block">Price</label>
                    <Input type="number" placeholder="0.00" step="0.01" min="0" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CARDS SECTION */}
        <TabsContent value="cards" className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Simple Card */}
            <Card className="layout-card-radius border-0 shadow-sm theme-surface">
              <CardHeader className="layout-card-padding">
                <CardTitle className="theme-text">Simple Card</CardTitle>
                <CardDescription className="theme-text-muted">
                  Basic card with title and description
                </CardDescription>
              </CardHeader>
              <CardContent className="layout-card-padding">
                <p className="text-sm theme-text">
                  This is a simple card component with minimal styling.
                </p>
              </CardContent>
            </Card>

            {/* Icon Card */}
            <Card className="layout-card-radius border-0 shadow-sm theme-surface">
              <CardHeader className="layout-card-padding">
                <div className="w-12 h-12 layout-card-radius flex items-center justify-center mb-4" style={{
                  background: 'var(--theme-primary)',
                  opacity: 0.1
                }}>
                  <Star className="w-6 h-6 theme-primary" />
                </div>
                <CardTitle className="theme-text">Icon Card</CardTitle>
                <CardDescription className="theme-text-muted">
                  Card with decorative icon
                </CardDescription>
              </CardHeader>
              <CardContent className="layout-card-padding">
                <p className="text-sm theme-text">
                  Enhanced with an icon for visual hierarchy.
                </p>
              </CardContent>
            </Card>

            {/* Stat Card */}
            <Card className="layout-card-radius border-0 shadow-sm theme-surface">
              <CardContent className="layout-card-padding">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 layout-card-radius flex items-center justify-center" style={{
                    background: 'var(--theme-primary)',
                    opacity: 0.1
                  }}>
                    <Users className="w-6 h-6 theme-primary" />
                  </div>
                  <div>
                    <p className="text-xs theme-text-muted uppercase tracking-wider font-bold">Total Users</p>
                    <p className="text-3xl font-black theme-text">1,234</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Card */}
            <Card className="layout-card-radius border-0 shadow-sm theme-surface">
              <CardHeader className="layout-card-padding">
                <CardTitle className="theme-text">Action Card</CardTitle>
                <CardDescription className="theme-text-muted">
                  Card with action buttons
                </CardDescription>
              </CardHeader>
              <CardContent className="layout-card-padding space-y-4">
                <p className="text-sm theme-text">
                  Perform actions directly from this card.
                </p>
                <div className="flex gap-2">
                  <Button size="sm">Confirm</Button>
                  <Button size="sm" variant="outline">Cancel</Button>
                </div>
              </CardContent>
            </Card>

            {/* Gradient Card */}
            <Card className="layout-card-radius border-0 shadow-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white">
              <CardContent className="layout-card-padding">
                <Heart className="w-8 h-8 mb-4 opacity-80" />
                <h3 className="text-lg font-bold mb-2">Gradient Card</h3>
                <p className="text-sm opacity-90">
                  Beautiful gradient background styling.
                </p>
              </CardContent>
            </Card>

            {/* Border Card */}
            <Card className="layout-card-radius border-2 theme-border shadow-sm theme-surface">
              <CardContent className="layout-card-padding">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 theme-primary mt-1" />
                  <div>
                    <h3 className="font-bold theme-text mb-1">Border Accent</h3>
                    <p className="text-sm theme-text-muted">
                      Emphasized with visible border.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ALERTS SECTION */}
        <TabsContent value="alerts" className="space-y-6">
          <Card className="layout-card-radius border-0 shadow-sm theme-surface">
            <CardHeader className="layout-card-padding border-b theme-border">
              <CardTitle className="theme-text">Alert Components</CardTitle>
              <CardDescription className="theme-text-muted">
                Different alert variants for various message types
              </CardDescription>
            </CardHeader>
            <CardContent className="layout-card-padding space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Information</AlertTitle>
                <AlertDescription>
                  This is an informational alert message.
                </AlertDescription>
              </Alert>

              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  Something went wrong. Please try again.
                </AlertDescription>
              </Alert>

              <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-900 dark:text-green-100">Success</AlertTitle>
                <AlertDescription className="text-green-800 dark:text-green-200">
                  Operation completed successfully!
                </AlertDescription>
              </Alert>

              <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-900 dark:text-yellow-100">Warning</AlertTitle>
                <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                  Please review before proceeding.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BADGES SECTION */}
        <TabsContent value="badges" className="space-y-6">
          <Card className="layout-card-radius border-0 shadow-sm theme-surface">
            <CardHeader className="layout-card-padding border-b theme-border">
              <CardTitle className="theme-text">Badge Variants</CardTitle>
              <CardDescription className="theme-text-muted">
                Small labels and status indicators
              </CardDescription>
            </CardHeader>
            <CardContent className="layout-card-padding space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-bold theme-text-muted uppercase tracking-wider">Default Badges</h3>
                <div className="flex flex-wrap gap-3">
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="outline">Outline</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold theme-text-muted uppercase tracking-wider">Status Badges</h3>
                <div className="flex flex-wrap gap-3">
                  <Badge className="bg-green-500">Active</Badge>
                  <Badge className="bg-yellow-500">Pending</Badge>
                  <Badge className="bg-red-500">Inactive</Badge>
                  <Badge className="bg-blue-500">Processing</Badge>
                  <Badge className="bg-purple-500">Draft</Badge>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold theme-text-muted uppercase tracking-wider">With Icons</h3>
                <div className="flex flex-wrap gap-3">
                  <Badge><CheckCircle className="w-3 h-3 mr-1" /> Verified</Badge>
                  <Badge variant="secondary"><Star className="w-3 h-3 mr-1" /> Featured</Badge>
                  <Badge variant="outline"><Bell className="w-3 h-3 mr-1" /> New</Badge>
                  <Badge className="bg-purple-500"><Zap className="w-3 h-3 mr-1" /> Premium</Badge>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold theme-text-muted uppercase tracking-wider">Sizes</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="text-xs px-2 py-0.5">Small</Badge>
                  <Badge>Medium</Badge>
                  <Badge className="text-base px-4 py-1.5">Large</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COMPLEX SECTION */}
        <TabsContent value="complex" className="space-y-6">
          <Card className="layout-card-radius border-0 shadow-sm theme-surface">
            <CardHeader className="layout-card-padding border-b theme-border">
              <CardTitle className="theme-text">Complex Components</CardTitle>
              <CardDescription className="theme-text-muted">
                Combinations of multiple UI elements
              </CardDescription>
            </CardHeader>
            <CardContent className="layout-card-padding space-y-8">
              {/* User Card */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold theme-text-muted uppercase tracking-wider">User Profile Card</h3>
                <Card className="layout-card-radius border theme-border">
                  <CardContent className="layout-card-padding">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xl">
                        JD
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold theme-text">John Doe</h3>
                          <Badge className="bg-blue-500 text-xs">Pro</Badge>
                        </div>
                        <p className="text-sm theme-text-muted mb-3">john.doe@example.com</p>
                        <div className="flex gap-2">
                          <Button size="sm">Follow</Button>
                          <Button size="sm" variant="outline">Message</Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Stat Dashboard */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold theme-text-muted uppercase tracking-wider">Mini Dashboard</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <Card className="layout-card-radius border-0 shadow-sm theme-surface">
                    <CardContent className="layout-card-padding">
                      <div className="flex justify-between items-start mb-4">
                        <Mail className="w-5 h-5 theme-text-muted" />
                        <Badge className="bg-green-500 text-xs">+12%</Badge>
                      </div>
                      <p className="text-2xl font-black theme-text">1,234</p>
                      <p className="text-xs theme-text-muted uppercase tracking-wider mt-1">Messages</p>
                    </CardContent>
                  </Card>
                  <Card className="layout-card-radius border-0 shadow-sm theme-surface">
                    <CardContent className="layout-card-padding">
                      <div className="flex justify-between items-start mb-4">
                        <Users className="w-5 h-5 theme-text-muted" />
                        <Badge className="bg-blue-500 text-xs">+5%</Badge>
                      </div>
                      <p className="text-2xl font-black theme-text">567</p>
                      <p className="text-xs theme-text-muted uppercase tracking-wider mt-1">Users</p>
                    </CardContent>
                  </Card>
                  <Card className="layout-card-radius border-0 shadow-sm theme-surface">
                    <CardContent className="layout-card-padding">
                      <div className="flex justify-between items-start mb-4">
                        <Calendar className="w-5 h-5 theme-text-muted" />
                        <Badge className="bg-purple-500 text-xs">Today</Badge>
                      </div>
                      <p className="text-2xl font-black theme-text">89</p>
                      <p className="text-xs theme-text-muted uppercase tracking-wider mt-1">Events</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Feature List */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold theme-text-muted uppercase tracking-wider">Feature List</h3>
                <div className="space-y-2">
                  {[
                    { icon: CheckCircle, text: 'Unlimited projects', color: 'text-green-500' },
                    { icon: CheckCircle, text: 'Advanced analytics', color: 'text-green-500' },
                    { icon: CheckCircle, text: 'Priority support', color: 'text-green-500' },
                    { icon: XCircle, text: 'Custom domain', color: 'theme-text-muted opacity-50' },
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 layout-card-radius hover:bg-[var(--theme-surface-hover)] transition-colors">
                      <feature.icon className={`w-5 h-5 ${feature.color}`} />
                      <span className="text-sm theme-text">{feature.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer Stats */}
      <Card className="layout-card-radius border-0 shadow-lg theme-surface">
        <CardContent className="layout-card-padding">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-black theme-text">
              Endless Possibilities
            </h2>
            <div className="grid md:grid-cols-3 gap-6 pt-6">
              <div>
                <p className="text-4xl font-black theme-primary mb-2">60</p>
                <p className="text-sm theme-text-muted">Theme × Layout Combinations</p>
              </div>
              <div>
                <p className="text-4xl font-black theme-primary mb-2">35+</p>
                <p className="text-sm theme-text-muted">UI Components</p>
              </div>
              <div>
                <p className="text-4xl font-black theme-primary mb-2">2000+</p>
                <p className="text-sm theme-text-muted">UI Variants</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
