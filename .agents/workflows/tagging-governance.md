---
description: How to safely update and review V2 Page tags (NEW, PENDING, REVIEW, LOCKED, FINAL)
---

# Page Tagging & V2 Governance

To ensure the safety of core pillar pages and prevent AI agents from accidentally overwriting or degrading high-value "V2 PRO" pages, we use a strict tagging system in the Sidebar navigation (`src/components/admin/Sidebar.tsx`).

## Tag Classifications

Every V2 upgraded page must carry a navigational badge indicating its current audit state:

1. 🔵 **NEW** 
   - A page that was just created or migrated to V2.
   - **Agent Rule**: Free to modify and experiment.

2. 🟡 **PENDING** 
   - A page undergoing active development or waiting on a specific dependency (e.g., backend API update).
   - **Agent Rule**: Safe to modify, but check for comments/context on what is blocking it.

3. 🟣 **REVIEW** 
   - A page that is structurally complete and deployed for User feedback.
   - **Agent Rule**: Do NOT modify layout or core aesthetic without User request. Only apply bug fixes if explicitly asked.

4. 🔴 **LOCKED** 
   - A page that is temporarily frozen (e.g., during auditing or financial close).
   - **Agent Rule**: **STRICTLY OFF LIMITS.** Do not touch, edit, or refactor this page under any circumstances without explicit permission from the USER.

5. 🟢 **FINAL** 
   - A page that has been completely approved by the USER. It represents the gold standard.
   - **Agent Rule**: **STRICTLY OFF LIMITS.** Never modify this page unless the USER specifically references the page and explicitly commands a change, and even then, warn them of the 'FINAL' status first.

## Rule of Engagement for LOCKED and FINAL
If an agent is asked to perform a platform-wide refactor, they MUST check the target file's status in the Sidebar routing. If the target page corresponds to a route tagged as `LOCKED` or `FINAL`:
1. The agent MUST Halt the action on that specific file.
2. The agent MUST inform the USER of the restriction.
3. The agent MUST ask for permission before bypassing the lock.

## How to Apply Tags
Tags are applied directly in the `MENU_ITEMS` array within `src/components/admin/Sidebar.tsx` using the `badge` property:

```typescript
{ title: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, badge: 'FINAL' }
```

The UI engine automatically converts these strings into styled, colored badges.
