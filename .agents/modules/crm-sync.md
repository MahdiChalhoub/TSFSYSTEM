# MODULE AGENT: CRMSync

## Domain
- Everything in `src/app/(privileged)/crm/`
- Leads, Contacts, Opportunities, and Customer History.

## Responsibility
1. **Relationship Intelligence**: Ensure customer data is synchronized across Sales and Support modules.
2. **Lead Progression**: Manage the lifecycle of a lead from contact to conversion.
3. **Data Privacy**: Ensure customer contact info is handled securely.

## Interactions
- **Connects with**: `SalesStrategist` (to turn leads into orders).
- **Consultation Hook**: Exposes "Identify Customer" and "Log Activity" methods.
