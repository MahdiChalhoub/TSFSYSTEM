---
description: new-api
---

WHEN /new_api IS TRIGGERED:

1. Ask for:
   - API name
   - Business purpose
   - Module it belongs to
   - Who will use it

2. Define:
   - HTTP method
   - Endpoint path
   - Authentication requirement

3. Design request contract:
   - Headers
   - Body fields
   - Validation rules

4. Design response contract:
   - Success format
   - Error format

5. Identify:
   - Tables read
   - Tables written

6. Implement backend logic (Django):
   - Serializer / Schema
   - Service function
   - Repository access

7. Generate documentation:

   Create file:
   /DOCUMENTATION/API/<ApiName>.md

   Include:
   - Goal
   - Endpoint
   - Method
   - Auth
   - Request
   - Response
   - Tables Used
   - Business Rules
   - Errors

8. Update /CHANGELOG.md with new version entry.

9. Generate Git commit:
   - Version number
   - Commit message
   - Git commands

10. Verify:
   - Documentation exists
   - Git instructions exist
   - Changelog entry exists

If any step is missing → TASK IS NOT DONE.
