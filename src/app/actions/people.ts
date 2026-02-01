'use server';

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getPostingRules } from "./finance/posting-rules";

/**
 * Creates a Contact (Master Data) and automatically establishes a linked ledger account.
 * Follows the principle: Home Site = Master Data Attribute.
 */
export async function createContact(prevState: any, formData: FormData) {
    const name = formData.get('name') as string;
    const type = formData.get('type') as string; // 'SUPPLIER' or 'CUSTOMER'
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const homeSiteId = formData.get('homeSiteId') ? parseInt(formData.get('homeSiteId') as string) : null;

    try {
        // 1. Get the parent account from Posting Rules or Fallback
        const rules = await getPostingRules();
        const rootId = type === 'CUSTOMER' ? rules.automation.customerRoot : rules.automation.supplierRoot;

        let parentAccount;
        if (rootId) {
            parentAccount = await prisma.chartOfAccount.findUnique({ where: { id: rootId } });
        }

        // Final Fallback if rule is missing or ID is stale
        if (!parentAccount) {
            const fallbackCode = type === 'CUSTOMER' ? '1200' : '2100';
            parentAccount = await prisma.chartOfAccount.findUnique({ where: { code: fallbackCode } });
        }

        if (!parentAccount) {
            throw new Error(`Base Chart of Account for ${type} not found. Please setup Posting Rules or COA first.`);
        }

        const parentCode = parentAccount.code;

        // 2. Generate sub-account code
        const count = await prisma.chartOfAccount.count({ where: { parentId: parentAccount.id } });
        const subCode = `${parentCode}-${(count + 1).toString().padStart(4, '0')}`;

        // 3. Create the Ledger Account (Sub-ledger)
        const linkedAccount = await prisma.chartOfAccount.create({
            data: {
                code: subCode,
                name: `${name} (${type === 'CUSTOMER' ? 'AR' : 'AP'})`,
                type: parentAccount.type,
                subType: type === 'CUSTOMER' ? 'RECEIVABLE' : 'PAYABLE',
                parentId: parentAccount.id
            }
        });

        // 4. Create the Contact (Master Data)
        const contact = await prisma.contact.create({
            data: {
                name,
                type,
                email,
                phone,
                homeSiteId,
                linkedAccountId: linkedAccount.id
            }
        });

        revalidatePath('/admin/crm');
        return { success: true, contact };
    } catch (e: any) {
        console.error("Failed to create contact:", e);
        return { success: false, message: e.message };
    }
}

/**
 * Creates an Employee (HR Master Data), links them to a sub-ledger for Payroll,
 * and optionally creates/links a User login account.
 */
export async function createEmployee(prevState: any, formData: FormData) {
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const email = formData.get('email') as string;
    const employeeId = formData.get('employeeId') as string; // e.g. EMP-001
    const jobTitle = formData.get('jobTitle') as string;
    const homeSiteId = formData.get('homeSiteId') ? parseInt(formData.get('homeSiteId') as string) : null;
    const createLogin = formData.get('createLogin') === 'on';
    const roleId = formData.get('roleId') ? parseInt(formData.get('roleId') as string) : null;

    const fullName = `${firstName} ${lastName}`;

    try {
        // 1. Generate/Find Employee Payroll Account (Root from Posting Rules or 2200)
        const rules = await getPostingRules();
        const rootId = rules.automation.payrollRoot;

        let parentAccount;
        if (rootId) {
            parentAccount = await prisma.chartOfAccount.findUnique({ where: { id: rootId } });
        }

        if (!parentAccount) {
            parentAccount = await prisma.chartOfAccount.findUnique({ where: { code: '2200' } });
        }

        if (!parentAccount) {
            parentAccount = await prisma.chartOfAccount.create({
                data: { code: '2200', name: 'Accrued Payroll & Salaries', type: 'LIABILITY', subType: 'PAYABLE' }
            });
        }

        const count = await prisma.chartOfAccount.count({ where: { parentId: parentAccount.id } });
        const subCode = `2200-${(count + 1).toString().padStart(4, '0')}`;

        // 2. Create the Ledger Account for specific employee
        const linkedAccount = await prisma.chartOfAccount.create({
            data: {
                code: subCode,
                name: `Payable to ${fullName}`,
                type: 'LIABILITY',
                subType: 'PAYABLE',
                parentId: parentAccount.id
            }
        });

        // 3. Create the Employee record (HR Data)
        const employee = await prisma.employee.create({
            data: {
                employeeId,
                firstName,
                lastName,
                email,
                jobTitle,
                homeSiteId,
                linkedAccountId: linkedAccount.id
            }
        });

        // 4. Create User Login if requested
        if (createLogin && roleId) {
            await prisma.user.create({
                data: {
                    name: fullName,
                    email: email,
                    password: 'change-me', // User should reset on first login
                    roleId,
                    homeSiteId,
                    employeeId: employee.id,
                    linkedAccountId: linkedAccount.id // Direct link for ease of access
                }
            });
        }

        revalidatePath('/admin/hr');
        return { success: true, employee };
    } catch (e: any) {
        console.error("Failed to create employee:", e);
        return { success: false, message: e.message };
    }
}

export async function getRoles() {
    return await prisma.role.findMany({
        include: { _count: { select: { users: true } } }
    });
}
