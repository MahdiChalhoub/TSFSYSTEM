/**
 * TSF Page Intake Schema
 * ======================
 * The schema that business teams or agents fill before layout generation.
 *
 * This forces you to think about WHAT THE PAGE DOES before thinking about
 * what it looks like.
 */

import { LayoutArchetype } from "./layout-archetypes";

export type DataDensity = "low" | "medium" | "high";
export type WorkflowType =
  | "dashboard"
  | "workspace"
  | "form"
  | "detail"
  | "operations";
export type DevicePriority = "mobile" | "tablet" | "desktop";
export type UserRole =
  | "admin"
  | "manager"
  | "employee"
  | "accountant"
  | "storekeeper"
  | "salesperson"
  | "purchaser"
  | "operator";

/**
 * Page Intake - What business users describe
 */
export interface PageIntake {
  // ── Identity ──
  module: string; // "purchases", "finance", "crm", etc.
  pageName: string; // "Receiving Workspace", "Invoice List", etc.
  businessGoal: string; // "Receive supplier delivery and compare with PO"

  // ── Users ──
  userRoles: UserRole[]; // Who will use this page?
  userExpertise: "novice" | "intermediate" | "expert"; // Affects complexity

  // ── Actions ──
  primaryActions: string[]; // ["Confirm Receipt", "Reject Items"]
  secondaryActions?: string[]; // ["Scan Barcode", "Open Catalogue"]
  bulkActions?: string[]; // ["Approve All", "Export Selection"]

  // ── Data Characteristics ──
  dataDensity: DataDensity; // How much data is shown?
  recordType?: string; // "customer", "invoice", "product", etc.
  estimatedRecordCount?: number; // How many records typically shown?

  // ── Workflow ──
  workflowType: WorkflowType; // Dashboard, workspace, form, etc.
  isMultiStep?: boolean; // Wizard or single-page?
  requiresApproval?: boolean; // Approval workflow?
  isRealtime?: boolean; // Live data updates?

  // ── Features Needed ──
  needsKPI?: boolean; // Summary metrics
  needsTable?: boolean; // Data grid
  needsFilters?: boolean; // Filter controls
  needsDrawer?: boolean; // Detail panel
  needsModal?: boolean; // Quick actions
  needsStepper?: boolean; // Multi-step progress
  needsTimeline?: boolean; // Activity history
  needsCharts?: boolean; // Visualizations

  // ── Special Requirements ──
  specialNeeds?: string[]; // e.g., ["Expiry tracking", "Discrepancy detection"]
  complianceRequirements?: string[]; // e.g., ["Audit trail", "Approval chain"]
  performanceTargets?: {
    maxLoadTime?: number; // ms
    maxRecordsPerPage?: number;
  };

  // ── Device Targets ──
  devicePriority: DevicePriority[]; // ["desktop", "tablet"] - order matters
  mobileSupport: "required" | "optional" | "not-needed";
}

/**
 * Page Blueprint - What the Layout Architect Agent outputs
 */
export interface PageBlueprint {
  // ── Input Reference ──
  intake: PageIntake;

  // ── Chosen Archetype ──
  archetype: LayoutArchetype;
  archetypeRationale: string; // Why this archetype was chosen

  // ── Structure ──
  zones: {
    id: string;
    component: string;
    purpose: string;
    required: boolean;
  }[];

  // ── Layout Decisions ──
  layout: {
    grid: "fixed" | "fluid";
    maxWidth?: number;
    sidebar?: "left" | "right" | "none";
    footer?: "sticky" | "static" | "none";
    scroll: "page" | "content-zone" | "split";
  };

  // ── Component Mapping ──
  components: {
    zone: string;
    component: string;
    props: Record<string, any>;
  }[];

  // ── Responsive Strategy ──
  responsive: {
    mobile: string; // Description of mobile layout
    tablet: string; // Description of tablet layout
    desktop: string; // Description of desktop layout
  };

  // ── Validation ──
  validationScore: number; // Out of 100
  complianceIssues: string[];

  // ── Code Generation Ready ──
  ready: boolean;
  blockers?: string[];
}

/**
 * Example Intake: Receiving Workspace
 */
export const EXAMPLE_INTAKE_RECEIVING: PageIntake = {
  module: "purchases",
  pageName: "Receiving Workspace",
  businessGoal: "Receive supplier delivery and compare with PO",

  userRoles: ["storekeeper", "purchaser"],
  userExpertise: "intermediate",

  primaryActions: ["Confirm Receipt", "Reject Items"],
  secondaryActions: ["Scan Barcode", "Open Catalogue", "Print Labels"],
  bulkActions: ["Accept All", "Reject All"],

  dataDensity: "high",
  recordType: "purchase_order_line",
  estimatedRecordCount: 50,

  workflowType: "operations",
  isMultiStep: false,
  requiresApproval: true,
  isRealtime: true,

  needsKPI: true,
  needsTable: true,
  needsFilters: true,
  needsDrawer: true,
  needsModal: false,
  needsStepper: false,
  needsTimeline: false,
  needsCharts: false,

  specialNeeds: [
    "Expiry tracking",
    "Discrepancy detection",
    "Safety stock indicators",
    "Supplier issue alerts",
  ],

  complianceRequirements: ["Audit trail", "Approval chain"],

  performanceTargets: {
    maxLoadTime: 1500,
    maxRecordsPerPage: 100,
  },

  devicePriority: ["desktop", "tablet"],
  mobileSupport: "not-needed",
};

/**
 * Example Intake: Customer List
 */
export const EXAMPLE_INTAKE_CUSTOMER_LIST: PageIntake = {
  module: "crm",
  pageName: "Customer List",
  businessGoal: "Browse, search, and manage customer records",

  userRoles: ["salesperson", "manager"],
  userExpertise: "novice",

  primaryActions: ["Create Customer"],
  secondaryActions: ["Export", "Import", "Bulk Edit"],

  dataDensity: "medium",
  recordType: "customer",
  estimatedRecordCount: 200,

  workflowType: "workspace",
  isMultiStep: false,
  requiresApproval: false,
  isRealtime: false,

  needsKPI: true,
  needsTable: true,
  needsFilters: true,
  needsDrawer: true,
  needsModal: true,

  specialNeeds: ["Credit limit warnings", "Overdue invoices"],

  devicePriority: ["desktop", "tablet", "mobile"],
  mobileSupport: "required",
};

/**
 * Example Intake: Invoice Form
 */
export const EXAMPLE_INTAKE_INVOICE_FORM: PageIntake = {
  module: "finance",
  pageName: "Create Invoice",
  businessGoal: "Create and submit new customer invoice",

  userRoles: ["accountant", "salesperson"],
  userExpertise: "intermediate",

  primaryActions: ["Submit Invoice", "Save Draft"],
  secondaryActions: ["Preview", "Duplicate", "Cancel"],

  dataDensity: "low",
  workflowType: "form",
  isMultiStep: true,
  requiresApproval: true,

  needsKPI: false,
  needsTable: true, // Line items table
  needsFilters: false,
  needsDrawer: false,
  needsModal: false,
  needsStepper: true,
  needsTimeline: false,

  specialNeeds: ["Tax calculation", "Currency conversion", "Payment terms"],

  complianceRequirements: ["Tax compliance", "Audit trail", "Approval workflow"],

  devicePriority: ["desktop"],
  mobileSupport: "optional",
};

/**
 * Intake Validator
 */
export function validateIntake(intake: PageIntake): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!intake.module) errors.push("Module is required");
  if (!intake.pageName) errors.push("Page name is required");
  if (!intake.businessGoal) errors.push("Business goal is required");
  if (!intake.userRoles || intake.userRoles.length === 0) {
    errors.push("At least one user role is required");
  }
  if (!intake.primaryActions || intake.primaryActions.length === 0) {
    errors.push("At least one primary action is required");
  }
  if (intake.primaryActions && intake.primaryActions.length > 3) {
    warnings.push("Too many primary actions - consider making some secondary");
  }

  // Consistency checks
  if (intake.workflowType === "dashboard" && !intake.needsKPI) {
    warnings.push("Dashboard pages typically need KPIs");
  }

  if (intake.workflowType === "workspace" && !intake.needsTable) {
    warnings.push("Workspace pages typically need a data table");
  }

  if (intake.workflowType === "form" && intake.needsTable) {
    warnings.push("Form pages rarely need tables - is this a line-item form?");
  }

  if (intake.dataDensity === "high" && !intake.needsFilters) {
    warnings.push("High-density data typically needs filters");
  }

  if (intake.isRealtime && intake.dataDensity === "high") {
    warnings.push(
      "Real-time + high-density can cause performance issues - consider pagination"
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
