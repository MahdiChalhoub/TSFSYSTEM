---
name: Proactive Bug Detection & Prevention
description: Requires the agent to act as a senior architect, anticipating edge cases, data corruption, and future user-errors before writing a single line of code.
---

# Proactive Bug Detection (The "Look Ahead" Rule)

You MUST NOT merely fulfill the explicit requirement. You MUST analyze the requirement for potential future failures, race conditions, unintended side-effects, or negative user experiences that the user didn't explicitly spell out.

## The Pre-Flight Analysis 

Before writing code for a feature or fix, you MUST perform a "Pre-Flight Analysis." This involves actively answering the following questions:
1. **The 'What If' Scenario:** What happens if the network drops in the middle of this transaction? Have I implemented atomic database rollbacks?
2. **Data Integrity Check:** What happens if the user inputs invalid data, malicious code, or tries to submit empty forms? Do I have backend validation *and* frontend validation? (e.g. Sales screen cannot save void or empty checkout lines).
3. **Scaling Constraints:** Will this query slow the system down if the database grows to 1 million records? Have I added indexing to these new columns?
4. **Integration Risks:** Does this change break any existing integrations (like the Accounting Ledger, the Cash Register logic, or the POS Sync)? 
5. **Audit Trails:** If a user makes an error 6 months from now regarding this feature, will there be an audit log proving who made what change?
6. **Dead Button & Filter Wiring Check:** Does every filter and button actually trigger state changes and API calls? Never deliver an un-wired button.

## Execution Mandate
If you detect *any* potential future issue during the Pre-Flight Analysis, you MUST NOT simply proceed blindly. You MUST design the fix, notify the User of the potential problem, and implement the system to prevent it permanently.
