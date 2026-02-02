
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  Serializable: 'Serializable'
});

exports.Prisma.OrganizationScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CountryScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name'
};

exports.Prisma.UnitScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  shortName: 'shortName',
  type: 'type',
  allowFraction: 'allowFraction',
  needsBalance: 'needsBalance',
  balanceCodeStructure: 'balanceCodeStructure',
  baseUnitId: 'baseUnitId',
  conversionFactor: 'conversionFactor'
};

exports.Prisma.FinancialAccountScalarFieldEnum = {
  id: 'id',
  name: 'name',
  type: 'type',
  currency: 'currency',
  balance: 'balance',
  siteId: 'siteId',
  ledgerAccountId: 'ledgerAccountId'
};

exports.Prisma.TransactionScalarFieldEnum = {
  id: 'id',
  accountId: 'accountId',
  siteId: 'siteId',
  amount: 'amount',
  type: 'type',
  description: 'description',
  referenceId: 'referenceId',
  scope: 'scope',
  createdAt: 'createdAt'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  password: 'password',
  name: 'name',
  isActive: 'isActive',
  organizationId: 'organizationId',
  roleId: 'roleId',
  homeSiteId: 'homeSiteId',
  cashRegisterId: 'cashRegisterId',
  employeeId: 'employeeId',
  linkedAccountId: 'linkedAccountId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RoleScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PermissionScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  action: 'action',
  entity: 'entity',
  entityId: 'entityId',
  field: 'field',
  oldValue: 'oldValue',
  newValue: 'newValue',
  userId: 'userId',
  timestamp: 'timestamp',
  organizationId: 'organizationId'
};

exports.Prisma.ContactScalarFieldEnum = {
  id: 'id',
  type: 'type',
  name: 'name',
  email: 'email',
  phone: 'phone',
  address: 'address',
  vatId: 'vatId',
  organizationId: 'organizationId',
  homeSiteId: 'homeSiteId',
  balance: 'balance',
  creditLimit: 'creditLimit',
  loyaltyPoints: 'loyaltyPoints',
  linkedAccountId: 'linkedAccountId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EmployeeScalarFieldEnum = {
  id: 'id',
  employeeId: 'employeeId',
  firstName: 'firstName',
  lastName: 'lastName',
  idNumber: 'idNumber',
  phone: 'phone',
  email: 'email',
  jobTitle: 'jobTitle',
  department: 'department',
  hireDate: 'hireDate',
  salary: 'salary',
  status: 'status',
  homeSiteId: 'homeSiteId',
  linkedAccountId: 'linkedAccountId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProductScalarFieldEnum = {
  id: 'id',
  sku: 'sku',
  barcode: 'barcode',
  name: 'name',
  description: 'description',
  organizationId: 'organizationId',
  productGroupId: 'productGroupId',
  size: 'size',
  sizeUnitId: 'sizeUnitId',
  costPrice: 'costPrice',
  costPriceHT: 'costPriceHT',
  costPriceTTC: 'costPriceTTC',
  tvaRate: 'tvaRate',
  sellingPriceHT: 'sellingPriceHT',
  sellingPriceTTC: 'sellingPriceTTC',
  basePrice: 'basePrice',
  minPrice: 'minPrice',
  brandId: 'brandId',
  countryId: 'countryId',
  unitId: 'unitId',
  status: 'status',
  supplierId: 'supplierId',
  taxRate: 'taxRate',
  isTaxIncluded: 'isTaxIncluded',
  isExpiryTracked: 'isExpiryTracked',
  minStockLevel: 'minStockLevel',
  categoryId: 'categoryId',
  parfumId: 'parfumId'
};

exports.Prisma.ProductGroupScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  image: 'image',
  brandId: 'brandId',
  categoryId: 'categoryId',
  parfumId: 'parfumId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CategoryScalarFieldEnum = {
  id: 'id',
  name: 'name',
  code: 'code',
  shortName: 'shortName',
  parentId: 'parentId'
};

exports.Prisma.BrandScalarFieldEnum = {
  id: 'id',
  name: 'name',
  shortName: 'shortName',
  logo: 'logo'
};

exports.Prisma.ParfumScalarFieldEnum = {
  id: 'id',
  name: 'name',
  shortName: 'shortName'
};

exports.Prisma.WarehouseScalarFieldEnum = {
  id: 'id',
  name: 'name',
  code: 'code',
  type: 'type',
  canSell: 'canSell',
  address: 'address',
  city: 'city',
  isActive: 'isActive',
  siteId: 'siteId'
};

exports.Prisma.StockBatchScalarFieldEnum = {
  id: 'id',
  productId: 'productId',
  batchCode: 'batchCode',
  expiryDate: 'expiryDate',
  costPrice: 'costPrice'
};

exports.Prisma.InventoryScalarFieldEnum = {
  id: 'id',
  warehouseId: 'warehouseId',
  productId: 'productId',
  batchId: 'batchId',
  quantity: 'quantity'
};

exports.Prisma.OrderScalarFieldEnum = {
  id: 'id',
  type: 'type',
  status: 'status',
  contactId: 'contactId',
  userId: 'userId',
  isVerified: 'isVerified',
  verifiedById: 'verifiedById',
  isLocked: 'isLocked',
  totalAmount: 'totalAmount',
  taxAmount: 'taxAmount',
  discount: 'discount',
  notes: 'notes',
  scope: 'scope',
  paymentMethod: 'paymentMethod',
  refCode: 'refCode',
  siteId: 'siteId',
  invoicePriceType: 'invoicePriceType',
  vatRecoverable: 'vatRecoverable',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OrderLineScalarFieldEnum = {
  id: 'id',
  orderId: 'orderId',
  productId: 'productId',
  quantity: 'quantity',
  unitPrice: 'unitPrice',
  taxRate: 'taxRate',
  total: 'total',
  batchId: 'batchId',
  unitCostHT: 'unitCostHT',
  unitCostTTC: 'unitCostTTC',
  vatAmount: 'vatAmount',
  effectiveCost: 'effectiveCost'
};

exports.Prisma.TaskScalarFieldEnum = {
  id: 'id',
  title: 'title',
  description: 'description',
  type: 'type',
  status: 'status',
  priority: 'priority',
  assignedToId: 'assignedToId',
  dueDate: 'dueDate',
  completedAt: 'completedAt'
};

exports.Prisma.SystemSettingsScalarFieldEnum = {
  id: 'id',
  key: 'key',
  value: 'value',
  updatedAt: 'updatedAt',
  createdAt: 'createdAt'
};

exports.Prisma.BarcodeSettingsScalarFieldEnum = {
  id: 'id',
  prefix: 'prefix',
  length: 'length',
  nextSequence: 'nextSequence',
  isEnabled: 'isEnabled',
  updatedAt: 'updatedAt'
};

exports.Prisma.TransactionSequenceScalarFieldEnum = {
  id: 'id',
  type: 'type',
  prefix: 'prefix',
  suffix: 'suffix',
  nextNumber: 'nextNumber',
  padding: 'padding',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProductImageScalarFieldEnum = {
  id: 'id',
  url: 'url',
  isPrimary: 'isPrimary',
  productId: 'productId',
  createdAt: 'createdAt'
};

exports.Prisma.FinancialSettingsScalarFieldEnum = {
  id: 'id',
  companyType: 'companyType',
  organizationId: 'organizationId',
  salesTaxPercentage: 'salesTaxPercentage',
  purchaseTaxPercentage: 'purchaseTaxPercentage',
  customTaxRules: 'customTaxRules',
  defaultTaxRate: 'defaultTaxRate',
  currency: 'currency',
  updatedAt: 'updatedAt',
  worksInTTC: 'worksInTTC',
  allowHTEntryForTTC: 'allowHTEntryForTTC',
  declareTVA: 'declareTVA',
  dualView: 'dualView',
  pricingCostBasis: 'pricingCostBasis'
};

exports.Prisma.FiscalYearScalarFieldEnum = {
  id: 'id',
  name: 'name',
  startDate: 'startDate',
  endDate: 'endDate',
  status: 'status',
  isLocked: 'isLocked',
  isHardLocked: 'isHardLocked',
  autoCloseDate: 'autoCloseDate'
};

exports.Prisma.FiscalPeriodScalarFieldEnum = {
  id: 'id',
  fiscalYearId: 'fiscalYearId',
  name: 'name',
  number: 'number',
  type: 'type',
  startDate: 'startDate',
  endDate: 'endDate',
  status: 'status'
};

exports.Prisma.ChartOfAccountScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  description: 'description',
  type: 'type',
  subType: 'subType',
  isActive: 'isActive',
  organizationId: 'organizationId',
  balance: 'balance',
  balanceOfficial: 'balanceOfficial',
  syscohadaCode: 'syscohadaCode',
  syscohadaClass: 'syscohadaClass',
  isSystemOnly: 'isSystemOnly',
  isHidden: 'isHidden',
  requiresZeroBalance: 'requiresZeroBalance',
  parentId: 'parentId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.JournalEntryScalarFieldEnum = {
  id: 'id',
  transactionDate: 'transactionDate',
  description: 'description',
  reference: 'reference',
  fiscalYearId: 'fiscalYearId',
  fiscalPeriodId: 'fiscalPeriodId',
  status: 'status',
  scope: 'scope',
  siteId: 'siteId',
  isVerified: 'isVerified',
  verifiedById: 'verifiedById',
  isLocked: 'isLocked',
  reversalOfId: 'reversalOfId',
  createdAt: 'createdAt',
  postedAt: 'postedAt',
  createdBy: 'createdBy'
};

exports.Prisma.JournalEntryLineScalarFieldEnum = {
  id: 'id',
  journalEntryId: 'journalEntryId',
  accountId: 'accountId',
  contactId: 'contactId',
  employeeId: 'employeeId',
  debit: 'debit',
  credit: 'credit',
  description: 'description'
};

exports.Prisma.PriceListScalarFieldEnum = {
  id: 'id',
  name: 'name',
  currency: 'currency',
  isDefault: 'isDefault',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PricingRuleScalarFieldEnum = {
  id: 'id',
  priceListId: 'priceListId',
  productId: 'productId',
  categoryId: 'categoryId',
  adjustmentType: 'adjustmentType',
  value: 'value',
  minQuantity: 'minQuantity',
  priority: 'priority',
  productGroupId: 'productGroupId'
};

exports.Prisma.SiteScalarFieldEnum = {
  id: 'id',
  name: 'name',
  code: 'code',
  address: 'address',
  city: 'city',
  phone: 'phone',
  vatNumber: 'vatNumber',
  isActive: 'isActive',
  organizationId: 'organizationId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InventoryLevelScalarFieldEnum = {
  id: 'id',
  siteId: 'siteId',
  productId: 'productId',
  quantity: 'quantity',
  updatedAt: 'updatedAt'
};

exports.Prisma.FinancialEventScalarFieldEnum = {
  id: 'id',
  eventType: 'eventType',
  status: 'status',
  amount: 'amount',
  currency: 'currency',
  date: 'date',
  reference: 'reference',
  notes: 'notes',
  contactId: 'contactId',
  transactionId: 'transactionId',
  journalEntryId: 'journalEntryId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  loanId: 'loanId'
};

exports.Prisma.LoanScalarFieldEnum = {
  id: 'id',
  contractNumber: 'contractNumber',
  contactId: 'contactId',
  principalAmount: 'principalAmount',
  interestRate: 'interestRate',
  interestType: 'interestType',
  termMonths: 'termMonths',
  startDate: 'startDate',
  paymentFrequency: 'paymentFrequency',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LoanInstallmentScalarFieldEnum = {
  id: 'id',
  loanId: 'loanId',
  dueDate: 'dueDate',
  principalAmount: 'principalAmount',
  interestAmount: 'interestAmount',
  totalAmount: 'totalAmount',
  paidAmount: 'paidAmount',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
  Organization: 'Organization',
  Country: 'Country',
  Unit: 'Unit',
  FinancialAccount: 'FinancialAccount',
  Transaction: 'Transaction',
  User: 'User',
  Role: 'Role',
  Permission: 'Permission',
  AuditLog: 'AuditLog',
  Contact: 'Contact',
  Employee: 'Employee',
  Product: 'Product',
  ProductGroup: 'ProductGroup',
  Category: 'Category',
  Brand: 'Brand',
  Parfum: 'Parfum',
  Warehouse: 'Warehouse',
  StockBatch: 'StockBatch',
  Inventory: 'Inventory',
  Order: 'Order',
  OrderLine: 'OrderLine',
  Task: 'Task',
  SystemSettings: 'SystemSettings',
  BarcodeSettings: 'BarcodeSettings',
  TransactionSequence: 'TransactionSequence',
  ProductImage: 'ProductImage',
  FinancialSettings: 'FinancialSettings',
  FiscalYear: 'FiscalYear',
  FiscalPeriod: 'FiscalPeriod',
  ChartOfAccount: 'ChartOfAccount',
  JournalEntry: 'JournalEntry',
  JournalEntryLine: 'JournalEntryLine',
  PriceList: 'PriceList',
  PricingRule: 'PricingRule',
  Site: 'Site',
  InventoryLevel: 'InventoryLevel',
  FinancialEvent: 'FinancialEvent',
  Loan: 'Loan',
  LoanInstallment: 'LoanInstallment'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
