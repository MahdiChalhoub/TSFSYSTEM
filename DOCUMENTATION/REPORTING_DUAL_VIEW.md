# Dual-View Reporting Architecture

## Goal
To allow businesses to maintain two parallel accounting views within a single organization:
1.  **Official View**: Includes only transactions tagged as `OFFICIAL`. This is typically used for regulatory reporting, tax declarations, and audits.
2.  **Internal View (Management)**: Includes ALL transactions (`OFFICIAL` + `INTERNAL`). This provides a real-world perspective on business health, including owner draws, cash adjustments, or internal transfers that don't belong in legal filings.

## From where data is READ
- **JournalEntryLine**: Every line is filtered by its parent `JournalEntry.scope`.
- **ChartOfAccount**: Stores two running balances: `balance` (Internal) and `balance_official`.

## Where data is SAVED
- `JournalEntry.scope`: Determines which balance bucket is affected upon posting.

## Dual-View Logic (Dual-View Accounting)
When a `JournalEntry` is posted:
- If `scope == 'OFFICIAL'`: Both `balance` AND `balance_official` are updated.
- If `scope == 'INTERNAL'`: ONLY the `balance` is updated.
- **Reporting**:
    - **Official Mode**: Queries only look at `balance_official` or lines with `scope == 'OFFICIAL'`.
    - **Internal Mode**: Queries look at the total `balance` or all lines.

## Workflow: Generating a Report
1.  **Select Scope**: User chooses "Official" or "Internal" in the UI.
2.  **Rollup Strategy**: The system fetches the COA tree.
3.  **Recursive Calculation**: For each category (e.g., ASSETS), the system sums the selected balance bucket of all children.
4.  **Display**: The system renders a hierarchical view showing totals per account group.

## How the system achieves its goal
By maintaining two distinct balance totals per account and scope tagging every entry, the system provides "Two Ledgers, One System," eliminating the need for manual CSV reconciliations between official books and internal management files.
