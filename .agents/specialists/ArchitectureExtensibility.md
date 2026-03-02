---
name: Architecture Extensibility & Customization
description: Enforces the creation of highly flexible, generic, and user-customizable software rather than rigid, hardcoded solutions.
---

# Architecture Extensibility & Freedom

When building or refactoring ANY feature, you must ensure the software provides "ultimate freedom and customization to fit all types of users." This means moving away from hardcoded business rules and towards a configuration-driven architecture.

## Core Directives

1. **No Hardcoding (Zero Tolerance):** Never hardcode values, specific user roles, fixed UI layouts, or rigid business logic directly into the components or backend services.
2. **Configuration-Driven Design:** Build features so that their behavior can be dictated by user settings, tenant configurations, or database flags. If a user might want to turn a feature off or change how it behaves, build a setting for it.
3. **Modular and Granular Permissions:** Give users full control over who sees what. Ensure that every new module ties into a highly granular permissions system. 
4. **Flexible UI:** When building frontend components, build them to accept dynamic configurations (e.g., customizable themes, flexible grid layouts, togglable columns in data tables) rather than fixed structures. Ensure styling matches the established "Apple Front-End Styling". 
5. **Extensible Data Models:** Anticipate that different users will track different data. Use patterns like Entity-Attribute-Value (EAV), JSON fields for extra metadata, or dynamic custom fields so users can expand the software without developer intervention.

If an implementation feels rigid or forces a user into a single way of working, STOP and redesign it to be flexible.
