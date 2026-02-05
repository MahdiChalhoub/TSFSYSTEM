# Workflow: Modular Request Orchestration (Core Platform)

## Goal
Safely route inter-module requests while ensuring multi-tenant isolation and graceful degradation when modules are unavailable.

## Actors
- **Requestor Module**: The module initiating the call (e.g., `pos`).
- **Connector Engine**: The central broker (`erp.connector_engine`).
- **Target Module**: The module providing the service (e.g., `inventory`).
- **Tenant Context**: The specific organization ID for data isolation.

## Steps
1. **Initiation**: Requestor calls `ConnectorEngine.route_read()` or `route_write()`.
2. **State Evaluation**:
    - Connector checks `SystemModule` for installation status.
    - Connector checks `OrganizationModule` for tenant enablement.
    - Connector performs a `PermissionService` check for the specific user.
3. **Policy Determination**: retrieves the most specific `ConnectorPolicy` (Endpoint-level > Module-level > Global).
4. **Execution**:
    - **Case AVAILABLE**: Forwards request to the target module's API.
    - **Case UNAVAILABLE**:
        - **Read**: Returns "Empty", "Cached", or "Mock" data based on policy.
        - **Write**: "Buffers" the payload for later, "Queues" as an event, or "Drops" it.
5. **Auditing**: Records the decision, latency, and outcome in `ConnectorLog`.

## Data Movement
- **Input**: Payload, organization identity, endpoint signature.
- **Output**: `ConnectorResponse` containing data + orchestration metadata.

## Tables Affected
- `ConnectorLog`: Audit trail.
- `ConnectorCache`: Fallback data for reads.
- `BufferedRequest`: Stored payloads for writes.
