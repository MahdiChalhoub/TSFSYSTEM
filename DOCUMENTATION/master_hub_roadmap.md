### 🛡️ TSF System Audit Protocol & Locked File Rule
As of 2026-02-27, the Strict Audit Plan MUST be followed. 
See `DOCUMENTATION/system/STRICT_AUDIT_PLAN.md` and `.cursorrules` for details.
**Any modification to a locked or finalized file REQUIRES EXPLICIT USER APPROVAL.**

### 🛡️ TSF System Audit Protocol & Locked File Rule
As of 2026-02-27, the Strict Audit Plan MUST be followed. See `DOCUMENTATION/system/STRICT_AUDIT_PLAN.md` and `.cursorrules` for details.
**Any modification to a locked or finalized file REQUIRES EXPLICIT USER APPROVAL.**

### 🧹 The Refactoring Codebase Mandate
To prevent files from becoming unmanageable and introducing "stupid errors", the system enforces a Strict Refactoring Protocol.
- **Any time a page or component exceeds manageable length (e.g., > 300 lines), or contains mixed Server/Client logic, it MUST be refactored.**
- Refactoring MUST follow the `refactor-and-audit` workflow in the `.agents/workflows` directory.
- This ensures clean code, strict typing, and adherence to the 4-layer Audit Plan.
