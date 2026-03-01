# Protocol: Agent Specialist Communication

## The "Consultation" Rule
Agents are NOT allowed to modify code in modules they do not represent. This prevents cascading bugs from cross-module edits.

## The Protocol

### Step 1: Identify the Need
Agent A (e.g., `InventoryMaster`) realizes it needs to create a financial journal entry.

### Step 2: Interface Research (NEW — CRITICAL)
Before requesting the bridge:
1. Agent A reads the target module's TypeScript interfaces
2. Agent A reads the target module's existing API endpoints or server actions
3. Agent A identifies if the needed functionality already exists

### Step 3: Request with Context
Agent A calls the specialist with:
> "FROM: [Agent A] | TO: [Agent B] | REQUEST: [What is needed] | CONTEXT: [Why it is needed] | EXISTING: [What already exists that might satisfy this need]"

### Step 4: Handoff with Contracts
The specialist responds with:
1. The exact TypeScript interface for the bridge
2. The function/API endpoint to use
3. Error handling expectations (what can fail, what to return)

### Step 5: Implementation with Type Checking
Both agents verify TypeScript compilation after implementing their respective sides.

## Why This Protocol Exists

The #1 source of bugs in TSFSYSTEM has been:
- **Type mismatches at module boundaries** (one module uses `string` IDs, another uses `number`)  
- **Missing prop aliases** (a hook returns `setSearchQuery` but consumers expect `onSetSearchQuery`)
- **Incomplete interface updates** (adding a field to a hook but not updating all 3 layout consumers)

This protocol ensures that both sides of a boundary agree on the data contract BEFORE writing code.

## Communication Template
```
FROM: [Agent A]
TO: [Agent B]  
REQUEST: [What is needed]
CONTEXT: [Why it is needed]
INTERFACE: [Expected TypeScript types]
EXISTING: [What already exists]
```

## Benefits
- No spaghetti code
- Module logic stays pure
- Type contracts are explicit
- `DataArchitect` ensures no duplicate data is created during the bridge
