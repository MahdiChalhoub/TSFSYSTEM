# Protocol: Agent Specialist Communication

## The "Consultation" Rule
Agents are NOT allowed to modify code in modules they do not represent. Instead, they must follow this handshake:

1.  **Identify Need**: Agent A (e.g., `InventoryMaster`) realizes it needs to create a financial journal entry.
2.  **Request Access**: Agent A calls the specialist for that module: "Requesting `FinanceCustodian` to provide an API or action for creating a journal entry."
3.  **Handoff**:
    - The specialist (`FinanceCustodian`) reviews the request.
    - The specialist provides the *connector* code or ensures the requested action exists and is secure.
    - If the change is significant, the `MasterAgent` must approve the bridge.

## Communication Template
When an agent communicates with another, it should use this format:
> "FROM: [Agent A] | TO: [Agent B] | REQUEST: [What is needed] | CONTEXT: [Why it is needed]"

## Benefits
- No spaghetti code.
- Module logic stays pure.
- `DataArchitect` ensures no duplicate data is created during the bridge.
