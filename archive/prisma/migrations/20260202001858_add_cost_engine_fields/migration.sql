-- CreateTable
CREATE TABLE "TransactionSequence" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "prefix" TEXT,
    "suffix" TEXT,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "padding" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InventoryLevel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siteId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" DECIMAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryLevel_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryLevel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinancialEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "date" DATETIME NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "contactId" INTEGER,
    "transactionId" INTEGER,
    "journalEntryId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "loanId" INTEGER,
    CONSTRAINT "FinancialEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinancialEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinancialEvent_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinancialEvent_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contractNumber" TEXT,
    "contactId" INTEGER NOT NULL,
    "principalAmount" DECIMAL NOT NULL,
    "interestRate" DECIMAL NOT NULL DEFAULT 0,
    "interestType" TEXT NOT NULL DEFAULT 'NONE',
    "termMonths" INTEGER,
    "startDate" DATETIME NOT NULL,
    "paymentFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Loan_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoanInstallment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "loanId" INTEGER NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "principalAmount" DECIMAL NOT NULL,
    "interestAmount" DECIMAL NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL NOT NULL,
    "paidAmount" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LoanInstallment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChartOfAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "subType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "balance" DECIMAL NOT NULL DEFAULT 0.00,
    "balanceOfficial" DECIMAL NOT NULL DEFAULT 0.00,
    "syscohadaCode" TEXT,
    "syscohadaClass" TEXT,
    "isSystemOnly" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "requiresZeroBalance" BOOLEAN NOT NULL DEFAULT false,
    "parentId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChartOfAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ChartOfAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ChartOfAccount" ("balance", "code", "createdAt", "description", "id", "isActive", "name", "parentId", "subType", "type", "updatedAt") SELECT "balance", "code", "createdAt", "description", "id", "isActive", "name", "parentId", "subType", "type", "updatedAt" FROM "ChartOfAccount";
DROP TABLE "ChartOfAccount";
ALTER TABLE "new_ChartOfAccount" RENAME TO "ChartOfAccount";
CREATE UNIQUE INDEX "ChartOfAccount_code_key" ON "ChartOfAccount"("code");
CREATE TABLE "new_FinancialAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "balance" DECIMAL NOT NULL DEFAULT 0.00,
    "siteId" INTEGER,
    "ledgerAccountId" INTEGER,
    CONSTRAINT "FinancialAccount_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinancialAccount_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "ChartOfAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FinancialAccount" ("balance", "currency", "id", "name", "siteId", "type") SELECT "balance", "currency", "id", "name", "siteId", "type" FROM "FinancialAccount";
DROP TABLE "FinancialAccount";
ALTER TABLE "new_FinancialAccount" RENAME TO "FinancialAccount";
CREATE UNIQUE INDEX "FinancialAccount_ledgerAccountId_key" ON "FinancialAccount"("ledgerAccountId");
CREATE TABLE "new_FinancialSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyType" TEXT NOT NULL DEFAULT 'REGULAR',
    "salesTaxPercentage" DECIMAL NOT NULL DEFAULT 0.00,
    "purchaseTaxPercentage" DECIMAL NOT NULL DEFAULT 0.00,
    "customTaxRules" TEXT,
    "defaultTaxRate" DECIMAL NOT NULL DEFAULT 0.11,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "updatedAt" DATETIME NOT NULL,
    "worksInTTC" BOOLEAN NOT NULL DEFAULT true,
    "allowHTEntryForTTC" BOOLEAN NOT NULL DEFAULT false,
    "declareTVA" BOOLEAN NOT NULL DEFAULT false,
    "dualView" BOOLEAN NOT NULL DEFAULT false,
    "pricingCostBasis" TEXT NOT NULL DEFAULT 'AUTO'
);
INSERT INTO "new_FinancialSettings" ("allowHTEntryForTTC", "companyType", "currency", "customTaxRules", "declareTVA", "defaultTaxRate", "dualView", "id", "purchaseTaxPercentage", "salesTaxPercentage", "updatedAt", "worksInTTC") SELECT "allowHTEntryForTTC", "companyType", "currency", "customTaxRules", "declareTVA", "defaultTaxRate", "dualView", "id", "purchaseTaxPercentage", "salesTaxPercentage", "updatedAt", "worksInTTC" FROM "FinancialSettings";
DROP TABLE "FinancialSettings";
ALTER TABLE "new_FinancialSettings" RENAME TO "FinancialSettings";
CREATE TABLE "new_Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "contactId" INTEGER,
    "userId" INTEGER NOT NULL,
    "totalAmount" DECIMAL NOT NULL DEFAULT 0.00,
    "taxAmount" DECIMAL NOT NULL DEFAULT 0.00,
    "discount" DECIMAL NOT NULL DEFAULT 0.00,
    "notes" TEXT,
    "scope" TEXT,
    "paymentMethod" TEXT,
    "refCode" TEXT,
    "siteId" INTEGER,
    "invoicePriceType" TEXT NOT NULL DEFAULT 'HT',
    "vatRecoverable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("contactId", "createdAt", "discount", "id", "notes", "paymentMethod", "refCode", "scope", "siteId", "status", "taxAmount", "totalAmount", "type", "updatedAt", "userId") SELECT "contactId", "createdAt", "discount", "id", "notes", "paymentMethod", "refCode", "scope", "siteId", "status", "taxAmount", "totalAmount", "type", "updatedAt", "userId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE TABLE "new_OrderLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "unitPrice" DECIMAL NOT NULL,
    "taxRate" DECIMAL NOT NULL DEFAULT 0.00,
    "total" DECIMAL NOT NULL,
    "batchId" INTEGER,
    "unitCostHT" DECIMAL NOT NULL DEFAULT 0.00,
    "unitCostTTC" DECIMAL NOT NULL DEFAULT 0.00,
    "vatAmount" DECIMAL NOT NULL DEFAULT 0.00,
    "effectiveCost" DECIMAL NOT NULL DEFAULT 0.00,
    CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_OrderLine" ("batchId", "id", "orderId", "productId", "quantity", "taxRate", "total", "unitPrice") SELECT "batchId", "id", "orderId", "productId", "quantity", "taxRate", "total", "unitPrice" FROM "OrderLine";
DROP TABLE "OrderLine";
ALTER TABLE "new_OrderLine" RENAME TO "OrderLine";
CREATE TABLE "new_Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER NOT NULL,
    "siteId" INTEGER,
    "amount" DECIMAL NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "referenceId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'OFFICIAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("accountId", "amount", "createdAt", "description", "id", "referenceId", "siteId", "type") SELECT "accountId", "amount", "createdAt", "description", "id", "referenceId", "siteId", "type" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "roleId" INTEGER,
    "homeSiteId" INTEGER,
    "cashRegisterId" INTEGER,
    "employeeId" INTEGER,
    "linkedAccountId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_homeSiteId_fkey" FOREIGN KEY ("homeSiteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "FinancialAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_linkedAccountId_fkey" FOREIGN KEY ("linkedAccountId") REFERENCES "ChartOfAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "employeeId", "homeSiteId", "id", "isActive", "linkedAccountId", "name", "password", "roleId", "updatedAt") SELECT "createdAt", "email", "employeeId", "homeSiteId", "id", "isActive", "linkedAccountId", "name", "password", "roleId", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");
CREATE UNIQUE INDEX "User_linkedAccountId_key" ON "User"("linkedAccountId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TransactionSequence_type_key" ON "TransactionSequence"("type");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLevel_siteId_productId_key" ON "InventoryLevel"("siteId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialEvent_transactionId_key" ON "FinancialEvent"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialEvent_journalEntryId_key" ON "FinancialEvent"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "Loan_contractNumber_key" ON "Loan"("contractNumber");
