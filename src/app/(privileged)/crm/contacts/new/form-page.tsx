'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useState } from 'react';
import { createContact } from '@/app/actions/people';
import { User, ArrowLeft, Briefcase, Phone, Mail, MapPin, Building2, CreditCard, Globe, FileText, Clock, Tag, MessageCircle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ContactFormPage({
  sites,
  type = 'CUSTOMER',
  deliveryZones = [],
  taxProfiles = [],
}: {
  sites: Record<string, any>[],
  type?: string,
  deliveryZones?: Record<string, any>[],
  taxProfiles?: Record<string, any>[],
}) {
  const router = useRouter();
  const [state, action, isPending] = useActionState(
    async (prevState: Record<string, any>, formData: FormData) => {
      const result = await createContact(prevState, formData);
      if (result.success) {
        // Redirect to contacts list on success
        setTimeout(() => router.push('/crm/contacts'), 500);
      }
      return result;
    },
    { success: false, message: '' }
  );

  return (
    <div className="min-h-screen layout-container-padding theme-bg">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="h-9 px-3"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            type === 'CUSTOMER'
              ? 'bg-app-info-bg text-app-info'
              : 'bg-app-warning-bg text-app-warning'
          }`}>
            {type === 'CUSTOMER' ? <User size={24} /> : <Briefcase size={24} />}
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black theme-text">
              Create {type === 'CUSTOMER' ? 'Customer' : 'Supplier'}
            </h1>
            <p className="theme-text-muted mt-1">
              Add a new {type.toLowerCase()} to your contact list
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl">
        <div className="bg-app-surface rounded-[32px] shadow-lg border border-app-border p-6 md:p-8">
          {state.message && (
            <div className={`mb-6 p-4 rounded-2xl ${
              state.success
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {state.message}
            </div>
          )}

          <form action={action} className="space-y-6">
            <input type="hidden" name="type" value={type} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name */}
              <div>
                <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">
                  Entity / Individual Name *
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground" size={18} />
                  <input
                    name="name"
                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-app-background border-none focus:ring-4 focus:ring-app-primary outline-none transition-all font-bold text-app-foreground"
                    placeholder="Full Name or Company"
                    required
                  />
                </div>
              </div>

              {/* Company Name */}
              <div>
                <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">
                  Company Name
                </label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground" size={18} />
                  <input
                    name="companyName"
                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-app-background border-none focus:ring-4 focus:ring-app-primary outline-none transition-all font-bold text-app-foreground"
                    placeholder="Company / Organization"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground" size={18} />
                  <input
                    name="email"
                    type="email"
                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-app-background border-none focus:ring-4 focus:ring-app-primary outline-none transition-all font-bold text-app-foreground"
                    placeholder="contact@example.com"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground" size={18} />
                  <input
                    name="phone"
                    type="tel"
                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-app-background border-none focus:ring-4 focus:ring-app-primary outline-none transition-all font-bold text-app-foreground"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>

              {/* Home Site */}
              <div>
                <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">
                  Home Site
                </label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground" size={18} />
                  <select
                    name="homeSiteId"
                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-app-background border-none focus:ring-4 focus:ring-app-primary outline-none transition-all font-bold text-app-foreground appearance-none"
                  >
                    <option value="">Select Site</option>
                    {sites.map(site => (
                      <option key={site.id} value={site.id}>{site.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Address */}
              <div className="md:col-span-2">
                <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">
                  Address
                </label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-4 text-app-muted-foreground" size={18} />
                  <textarea
                    name="address"
                    rows={3}
                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-app-background border-none focus:ring-4 focus:ring-app-primary outline-none transition-all font-bold text-app-foreground resize-none"
                    placeholder="Street address, city, state, zip code"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="md:col-span-2">
                <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">
                  Notes
                </label>
                <div className="relative">
                  <FileText className="absolute left-4 top-4 text-app-muted-foreground" size={18} />
                  <textarea
                    name="notes"
                    rows={4}
                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-app-background border-none focus:ring-4 focus:ring-app-primary outline-none transition-all font-bold text-app-foreground resize-none"
                    placeholder="Additional information about this contact..."
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 justify-end pt-4 border-t border-app-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isPending}
                className="h-11 px-6 rounded-xl font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="h-11 px-6 rounded-xl font-bold bg-app-primary hover:bg-app-primary text-app-foreground shadow-lg"
              >
                {isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-app-foreground border-t-transparent mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <User size={18} className="mr-2" />
                    Create {type === 'CUSTOMER' ? 'Customer' : 'Supplier'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
