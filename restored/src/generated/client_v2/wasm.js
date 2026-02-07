
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
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
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
  conversion_factor: 'conversion_factor',
  organizationId: 'organizationId'
};

exports.Prisma.FinancialAccountScalarFieldEnum = {
  id: 'id',
  name: 'name',
  type: 'type',
  currency: 'currency',
  balance: 'balance',
  ledger_account_id: 'ledger_account_id',
  organizationId: 'organizationId',
  site_id: 'site_id'
};

exports.Prisma.TransactionScalarFieldEnum = {
  id: 'id',
  amount: 'amount',
  type: 'type',
  description: 'description',
  reference_id: 'reference_id',
  scope: 'scope',
  createdAt: 'createdAt',
  account_id: 'account_id',
  organizationId: 'organizationId',
  site_id: 'site_id'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  password: 'password',
  last_login: 'last_login',
  is_superuser: 'is_superuser',
  username: 'username',
  first_name: 'first_name',
  last_name: 'last_name',
  email: 'email',
  is_staff: 'is_staff',
  isActive: 'isActive',
  date_joined: 'date_joined',
  is_active_account: 'is_active_account',
  organizationId: 'organizationId',
  roleId: 'roleId',
  homeSiteId: 'homeSiteId'
};

exports.Prisma.RoleScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  organizationId: 'organizationId'
};

exports.Prisma.PermissionScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ContactScalarFieldEnum = {
  id: 'id',
  type: 'type',
  name: 'name',
  email: 'email',
  phone: 'phone',
  address: 'address',
  vatId: 'vatId',
  balance: 'balance',
  creditLimit: 'creditLimit',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  homeSiteId: 'homeSiteId',
  linkedAccountId: 'linkedAccountId',
  organizationId: 'organizationId'
};

exports.Prisma.EmployeeScalarFieldEnum = {
  id: 'id',
  employeeId: 'employeeId',
  firstName: 'firstName',
  lastName: 'lastName',
  phone: 'phone',
  email: 'email',
  jobTitle: 'jobTitle',
  salary: 'salary',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  linkedAccountId: 'linkedAccountId',
  organization_id: 'organization_id',
  user_id: 'user_id'
};

exports.Prisma.ProductScalarFieldEnum = {
  id: 'id',
  sku: 'sku',
  barcode: 'barcode',
  name: 'name',
  description: 'description',
  costPrice: 'costPrice',
  costPriceHT: 'costPriceHT',
  costPriceTTC: 'costPriceTTC',
  tvaRate: 'tvaRate',
  sellingPriceHT: 'sellingPriceHT',
  sellingPriceTTC: 'sellingPriceTTC',
  isExpiryTracked: 'isExpiryTracked',
  minStockLevel: 'minStockLevel',
  is_active: 'is_active',
  created_at: 'created_at',
  updated_at: 'updated_at',
  brandId: 'brandId',
  categoryId: 'categoryId',
  countryId: 'countryId',
  organizationId: 'organizationId',
  parfumId: 'parfumId',
  productGroupId: 'productGroupId',
  unitId: 'unitId',
  status: 'status',
  supplierId: 'supplierId'
};

exports.Prisma.ProductGroupScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  image: 'image',
  organizationId: 'organizationId'
};

exports.Prisma.CategoryScalarFieldEnum = {
  id: 'id',
  name: 'name',
  created_at: 'created_at',
  organizationId: 'organizationId'
};

exports.Prisma.BrandScalarFieldEnum = {
  id: 'id',
  name: 'name',
  created_at: 'created_at',
  organizationId: 'organizationId'
};

exports.Prisma.ParfumScalarFieldEnum = {
  id: 'id',
  name: 'name',
  short_name: 'short_name',
  organizationId: 'organizationId'
};

exports.Prisma.WarehouseScalarFieldEnum = {
  id: 'id',
  name: 'name',
  code: 'code',
  type: 'type',
  can_sell: 'can_sell',
  isActive: 'isActive',
  organizationId: 'organizationId',
  site_id: 'site_id'
};

exports.Prisma.StockBatchScalarFieldEnum = {
  id: 'id',
  batch_code: 'batch_code',
  expiry_date: 'expiry_date',
  cost_price: 'cost_price',
  created_at: 'created_at',
  organizationId: 'organizationId',
  product_id: 'product_id'
};

exports.Prisma.InventoryScalarFieldEnum = {
  id: 'id',
  quantity: 'quantity',
  organizationId: 'organizationId',
  product_id: 'product_id',
  warehouse_id: 'warehouse_id',
  batch_id: 'batch_id'
};

exports.Prisma.OrderScalarFieldEnum = {
  id: 'id',
  type: 'type',
  status: 'status',
  totalAmount: 'totalAmount',
  taxAmount: 'taxAmount',
  discount: 'discount',
  isVerified: 'isVerified',
  isLocked: 'isLocked',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  contactId: 'contactId',
  organizationId: 'organizationId',
  siteId: 'siteId',
  userId: 'userId'
};

exports.Prisma.OrderLineScalarFieldEnum = {
  id: 'id',
  quantity: 'quantity',
  unitPrice: 'unitPrice',
  taxRate: 'taxRate',
  total: 'total',
  unitCostHT: 'unitCostHT',
  effectiveCost: 'effectiveCost',
  orderId: 'orderId',
  organizationId: 'organizationId',
  productId: 'productId',
  batchId: 'batchId'
};

exports.Prisma.SystemSettingsScalarFieldEnum = {
  id: 'id',
  key: 'key',
  value: 'value',
  organizationId: 'organizationId'
};

exports.Prisma.FiscalYearScalarFieldEnum = {
  id: 'id',
  name: 'name',
  start_date: 'start_date',
  end_date: 'end_date',
  is_closed: 'is_closed',
  organizationId: 'organizationId'
};

exports.Prisma.FiscalPeriodScalarFieldEnum = {
  id: 'id',
  name: 'name',
  start_date: 'start_date',
  end_date: 'end_date',
  is_closed: 'is_closed',
  fiscal_year_id: 'fiscal_year_id',
  organizationId: 'organizationId'
};

exports.Prisma.ChartOfAccountScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  type: 'type',
  sub_type: 'sub_type',
  is_system_only: 'is_system_only',
  isActive: 'isActive',
  balance: 'balance',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  parent_id: 'parent_id',
  organizationId: 'organizationId',
  balance_official: 'balance_official',
  description: 'description',
  is_hidden: 'is_hidden',
  requires_zero_balance: 'requires_zero_balance',
  syscohada_class: 'syscohada_class',
  syscohada_code: 'syscohada_code'
};

exports.Prisma.JournalEntryScalarFieldEnum = {
  id: 'id',
  transaction_date: 'transaction_date',
  description: 'description',
  reference: 'reference',
  status: 'status',
  scope: 'scope',
  is_verified: 'is_verified',
  is_locked: 'is_locked',
  posted_at: 'posted_at',
  createdAt: 'createdAt',
  updated_at: 'updated_at',
  fiscal_period_id: 'fiscal_period_id',
  fiscal_year_id: 'fiscal_year_id',
  organizationId: 'organizationId',
  site_id: 'site_id'
};

exports.Prisma.JournalEntryLineScalarFieldEnum = {
  id: 'id',
  debit: 'debit',
  credit: 'credit',
  description: 'description',
  contact_id: 'contact_id',
  employee_id: 'employee_id',
  account_id: 'account_id',
  journal_entry_id: 'journal_entry_id',
  organizationId: 'organizationId'
};

exports.Prisma.SiteScalarFieldEnum = {
  id: 'id',
  name: 'name',
  code: 'code',
  address: 'address',
  city: 'city',
  phone: 'phone',
  vat_number: 'vat_number',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  organizationId: 'organizationId'
};

exports.Prisma.InventoryLevelScalarFieldEnum = {
  id: 'id',
  quantity: 'quantity',
  organization_id: 'organization_id',
  product_id: 'product_id',
  site_id: 'site_id'
};

exports.Prisma.InventoryMovementScalarFieldEnum = {
  id: 'id',
  type: 'type',
  quantity: 'quantity',
  cost_price: 'cost_price',
  reference: 'reference',
  reason: 'reason',
  created_at: 'created_at',
  organization_id: 'organization_id',
  product_id: 'product_id',
  warehouse_id: 'warehouse_id'
};

exports.Prisma.Role_permissionsScalarFieldEnum = {
  id: 'id',
  role_id: 'role_id',
  permission_id: 'permission_id'
};

exports.Prisma.User_groupsScalarFieldEnum = {
  id: 'id',
  user_id: 'user_id',
  group_id: 'group_id'
};

exports.Prisma.User_user_permissionsScalarFieldEnum = {
  id: 'id',
  user_id: 'user_id',
  permission_id: 'permission_id'
};

exports.Prisma.Auth_groupScalarFieldEnum = {
  id: 'id',
  name: 'name'
};

exports.Prisma.Auth_group_permissionsScalarFieldEnum = {
  id: 'id',
  group_id: 'group_id',
  permission_id: 'permission_id'
};

exports.Prisma.Auth_permissionScalarFieldEnum = {
  id: 'id',
  name: 'name',
  content_type_id: 'content_type_id',
  codename: 'codename'
};

exports.Prisma.Django_admin_logScalarFieldEnum = {
  id: 'id',
  action_time: 'action_time',
  object_id: 'object_id',
  object_repr: 'object_repr',
  action_flag: 'action_flag',
  change_message: 'change_message',
  content_type_id: 'content_type_id',
  user_id: 'user_id'
};

exports.Prisma.Django_content_typeScalarFieldEnum = {
  id: 'id',
  app_label: 'app_label',
  model: 'model'
};

exports.Prisma.Django_migrationsScalarFieldEnum = {
  id: 'id',
  app: 'app',
  name: 'name',
  applied: 'applied'
};

exports.Prisma.Django_sessionScalarFieldEnum = {
  session_key: 'session_key',
  session_data: 'session_data',
  expire_date: 'expire_date'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
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
  SystemSettings: 'SystemSettings',
  FiscalYear: 'FiscalYear',
  FiscalPeriod: 'FiscalPeriod',
  ChartOfAccount: 'ChartOfAccount',
  JournalEntry: 'JournalEntry',
  JournalEntryLine: 'JournalEntryLine',
  Site: 'Site',
  InventoryLevel: 'InventoryLevel',
  InventoryMovement: 'InventoryMovement',
  Role_permissions: 'Role_permissions',
  User_groups: 'User_groups',
  User_user_permissions: 'User_user_permissions',
  auth_group: 'auth_group',
  auth_group_permissions: 'auth_group_permissions',
  auth_permission: 'auth_permission',
  django_admin_log: 'django_admin_log',
  django_content_type: 'django_content_type',
  django_migrations: 'django_migrations',
  django_session: 'django_session'
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