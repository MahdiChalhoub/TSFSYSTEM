# Optimization Proposal: Core & Core Platform

Based on the analysis of the current "Spine" infrastructure, here are the proposed optimizations to enhance performance and stability.

## Core Module (Infrastructure)

| Optimization | Impact | Description |
| :--- | :--- | :--- |
| **Integrity Caching** | High | Cache the result of `verify_system_integrity()` in Redis/Filesystem. This prevents redundant DB engine checks on every worker boot/restart. |
| **Async Health Reporting** | Medium | Offload system health metrics (Disk, DB, License) to a background heartbeat rather than checking during request-response cycles. |
| **Dual-Stack Validation** | Low | Enhance `CoreService` to validate shared memory and cache readiness alongside PostgreSQL checks. |

## Core Platform (Orchestration)

| Optimization | Impact | Description |
| :--- | :--- | :--- |
| **Connector Policy Caching** | **Critical** | The `get_policy()` method currently hits the DB on every routing decision. Implementing a `ConnectorCache` layer for policies will reduce DB load by up to 90% for inter-module traffic. |
| **Non-Blocking Replay** | High | Move `replay_buffered()` to a Celery task. Currently, granting access to a module blocks the admin UI while all missed writes are replayed. |
| **State Batching** | Medium | When loading the Sidebar, batch the `get_module_state()` checks for all modules in a single query rather than one-by-one. |
| **Circuit Breaker Pattern** | High | Implement a circuit breaker in the Connector. if a target module is consistently failing, the Connector should force it to `DISABLED` state automatically for 5 minutes. |

## Implementation Roadmap
1. **Phase 1**: Policy Caching (Connector Engine).
2. **Phase 2**: Background Replay (Worker Integration).
3. **Phase 3**: Circuit Breaker implementation.
