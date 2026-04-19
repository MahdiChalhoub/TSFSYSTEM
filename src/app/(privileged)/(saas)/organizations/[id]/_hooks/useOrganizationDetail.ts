'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    getOrganization, getOrgUsage, getOrgBilling, getOrgModules, toggleOrgModule,
    updateModuleFeatures, changeOrgPlan, getOrgUsers, createOrgUser, resetOrgUserPassword,
    getOrgSites, createOrgSite, toggleOrgSite, listClients, createClient, setOrgClient,
    getOrgAddons, purchaseAddon, cancelAddon, getOrgEncryptionStatus, toggleOrgEncryption,
    updateOrgSettings,
} from '../actions'
import type {
    SaasOrganization, SaasUsageData, SaasBillingData, SaasAddonData,
    SaasPlan, SaasModule, SaasUser, SaasSite,
} from '@/types/erp'

const EMPTY_BILLING: SaasBillingData = {
    history: [],
    balance: { total_paid: '0.00', total_credits: '0.00', net_balance: '0.00' },
    client: null,
}

const normalizeBilling = (b: unknown): SaasBillingData =>
    (b as SaasBillingData)?.history
        ? (b as SaasBillingData)
        : { ...EMPTY_BILLING, history: Array.isArray(b) ? (b as any[]) : [] }

export function useOrganizationDetail(orgId: string) {
    const router = useRouter()

    const [org, setOrg] = useState<SaasOrganization | null>(null)
    const [usage, setUsage] = useState<SaasUsageData | null>(null)
    const [billing, setBilling] = useState<SaasBillingData>(EMPTY_BILLING)
    const [modules, setModules] = useState<SaasModule[]>([])
    const [users, setUsers] = useState<SaasUser[]>([])
    const [sites, setSites] = useState<SaasSite[]>([])
    const [addons, setAddons] = useState<SaasAddonData>({ purchased: [], available: [] })
    const [encryptionStatus, setEncryptionStatus] = useState<Record<string, any> | null>(null)
    const [allClients, setAllClients] = useState<Record<string, unknown>[]>([])

    const [loading, setLoading] = useState(true)
    const [toggling, setToggling] = useState<string | null>(null)
    const [switching, setSwitching] = useState(false)
    const [togglingEncryption, setTogglingEncryption] = useState(false)
    const [purchasingAddon, setPurchasingAddon] = useState<string | null>(null)
    const [cancellingAddon, setCancellingAddon] = useState<string | null>(null)
    const [savingClient, setSavingClient] = useState(false)

    useEffect(() => {
        (async () => {
            try {
                const [orgData, usageData, billingData, modulesData, usersData, sitesData, addonsData] = await Promise.all([
                    getOrganization(orgId), getOrgUsage(orgId), getOrgBilling(orgId), getOrgModules(orgId),
                    getOrgUsers(orgId), getOrgSites(orgId), getOrgAddons(orgId),
                ])
                setOrg(orgData)
                setUsage(usageData)
                setBilling(normalizeBilling(billingData))
                setModules(Array.isArray(modulesData) ? modulesData : [])
                setUsers(Array.isArray(usersData) ? usersData : [])
                setSites(Array.isArray(sitesData) ? sitesData : [])
                setAddons(addonsData || { purchased: [], available: [] })
                getOrgEncryptionStatus(orgId).then(s => setEncryptionStatus(s)).catch(() => { })
            } catch {
                toast.error('Failed to load organization details')
            } finally {
                setLoading(false)
            }
        })()
    }, [orgId])

    const refreshUsage = async () => setUsage(await getOrgUsage(orgId))
    const refreshBilling = async () => setBilling(normalizeBilling(await getOrgBilling(orgId)))
    const refreshUsers = async () => {
        const data = await getOrgUsers(orgId); setUsers(Array.isArray(data) ? data : [])
    }
    const refreshSites = async () => {
        const data = await getOrgSites(orgId); setSites(Array.isArray(data) ? data : [])
    }
    const refreshModules = async () => {
        const data = await getOrgModules(orgId); setModules(Array.isArray(data) ? data : [])
    }
    const refreshAddons = async () => {
        const data = await getOrgAddons(orgId); setAddons(data || { purchased: [], available: [] })
    }
    const refreshUsageAndBilling = async () => {
        const [u, b] = await Promise.all([getOrgUsage(orgId), getOrgBilling(orgId)])
        setUsage(u); setBilling(normalizeBilling(b))
    }

    const errMsg = (e: unknown, fallback: string) => e instanceof Error ? e.message : (String(e) || fallback)

    async function toggleModule(code: string, currentStatus: string) {
        setToggling(code)
        try {
            const action = currentStatus === 'INSTALLED' ? 'disable' : 'enable'
            await toggleOrgModule(orgId, code, action)
            toast.success(`Module ${code} ${action}d`)
            await Promise.all([refreshModules(), refreshUsage()])
        } catch { toast.error('Failed to toggle module') }
        finally { setToggling(null) }
    }

    async function toggleFeature(moduleCode: string, featureCode: string, enabled: boolean) {
        const mod = modules.find(m => m.code === moduleCode)
        if (!mod) return
        const current: string[] = mod.active_features || []
        const updated = enabled ? [...current, featureCode] : current.filter((f: string) => f !== featureCode)
        try {
            await updateModuleFeatures(orgId, moduleCode, updated)
            await refreshModules()
            toast.success(`Feature ${featureCode} ${enabled ? 'enabled' : 'disabled'}`)
        } catch { toast.error('Failed to update feature') }
    }

    async function toggleSite(siteId: string) {
        try {
            const result = await toggleOrgSite(orgId, siteId)
            toast.success(result.message)
            await refreshSites()
        } catch { toast.error('Failed to toggle site') }
    }

    async function switchPlan(plan: SaasPlan) {
        setSwitching(true)
        const prevHistoryLen = billing?.history?.length ?? 0
        try {
            const result = await changeOrgPlan(orgId, String(plan.id))
            toast.success(result.message || `Switched to ${plan.name}`)
            if (result.modules_disabled?.length > 0) {
                toast.info(`Disabled modules: ${result.modules_disabled.join(', ')}`)
            }
            await refreshUsage()
            let newBilling = normalizeBilling(await getOrgBilling(orgId))
            if (newBilling.history.length <= prevHistoryLen) {
                await new Promise(r => setTimeout(r, 600))
                newBilling = normalizeBilling(await getOrgBilling(orgId))
            }
            setBilling(newBilling)
            router.refresh()
        } catch (err: unknown) {
            toast.error(errMsg(err, 'Failed to change plan'))
        } finally {
            setSwitching(false)
        }
    }

    async function createUser(user: any) {
        try {
            await createOrgUser(orgId, user)
            toast.success('User created')
            await refreshUsers()
        } catch (e: unknown) { toast.error(errMsg(e, 'Failed to create user')); throw e }
    }

    async function resetPassword(userId: string, password: string) {
        try {
            await resetOrgUserPassword(orgId, userId, password)
            toast.success('Password reset')
        } catch (e: unknown) { toast.error(errMsg(e, 'Failed to reset password')); throw e }
    }

    async function createSite(site: any) {
        try {
            await createOrgSite(orgId, site)
            toast.success('Site created')
            await refreshSites()
        } catch (e: unknown) { toast.error(errMsg(e, 'Failed to create site')); throw e }
    }

    async function purchase(addonId: string, addonName: string) {
        setPurchasingAddon(addonId)
        try {
            const result = await purchaseAddon(orgId, addonId)
            toast.success(result.message || `${addonName} purchased`)
            await refreshAddons()
        } catch (e: unknown) { toast.error(errMsg(e, 'Failed to purchase add-on')) }
        finally { setPurchasingAddon(null) }
    }

    async function cancel(purchaseId: string, addonName: string) {
        setCancellingAddon(purchaseId)
        try {
            const result = await cancelAddon(orgId, purchaseId)
            toast.success(result.message || `${addonName} cancelled`)
            await refreshAddons()
        } catch (e: unknown) { toast.error(errMsg(e, 'Failed to cancel add-on')) }
        finally { setCancellingAddon(null) }
    }

    async function toggleEncryption(action: 'activate' | 'deactivate' = 'activate') {
        setTogglingEncryption(true)
        try {
            const result = await toggleOrgEncryption(orgId, action)
            toast.success(result.message || 'Encryption toggled')
            setEncryptionStatus(await getOrgEncryptionStatus(orgId))
        } catch (e: unknown) { toast.error(errMsg(e, 'Failed to toggle encryption')) }
        finally { setTogglingEncryption(false) }
    }

    async function searchClients(q: string) {
        const data = await listClients(q)
        setAllClients(Array.isArray(data) ? data : [])
    }

    async function assignClient(clientId: string) {
        try {
            await setOrgClient(orgId, clientId)
            toast.success('Client assigned')
            await refreshUsageAndBilling()
        } catch (e: unknown) { toast.error(errMsg(e, 'Failed to assign client')) }
    }

    async function unassignClient() {
        try {
            await setOrgClient(orgId, null)
            toast.success('Client unassigned')
            await refreshUsageAndBilling()
        } catch (e: unknown) { toast.error(errMsg(e, 'Failed to unassign client')) }
    }

    async function createAndAssignClient(client: any) {
        setSavingClient(true)
        try {
            const result = await createClient(client)
            if (result?.id) {
                await setOrgClient(orgId, result.id)
                toast.success('Client created and assigned')
                await refreshUsageAndBilling()
            }
        } catch (e: unknown) { toast.error(errMsg(e, 'Failed to create client')) }
        finally { setSavingClient(false) }
    }

    async function updateSettings(updated: any) {
        await updateOrgSettings(orgId, updated)
        setOrg(await getOrganization(orgId))
    }

    return {
        // state
        org, usage, billing, modules, users, sites, addons, encryptionStatus, allClients,
        loading, toggling, switching, togglingEncryption,
        purchasingAddon, cancellingAddon, savingClient,
        // actions
        toggleModule, toggleFeature, toggleSite, switchPlan,
        createUser, resetPassword, createSite,
        purchase, cancel, toggleEncryption,
        searchClients, assignClient, unassignClient, createAndAssignClient,
        updateSettings,
    }
}
