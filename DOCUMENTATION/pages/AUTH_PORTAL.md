# Page Documentation: VANTAGE OS Auth Portal (Landing)

- **Goal of the page**: To serve as the primary gateway for the VANTAGE Enterprise OS, unifying Workspace Discovery (Login), Employee Sign-Up (Recruitment), and Business Registration (Founding) into a single, premium interface.
- **From where data is READ**: 
    - None (Static configuration for discovery).
- **Where data is SAVED**:
    - `Business Registration`: Provisions a new `Organization`, `Site`, and `User` via `registerBusiness` server action.
- **Variables user interacts with**:
    - `AuthMode`: 'login' | 'signup' | 'register' (Controls view state).
    - `formData.workspace`: Target slug for Login/Sign-up redirection.
    - `formData.name`: New Business Name.
    - `formData.slug`: New Business Unique Identifier.
- **Step-by-step workflow**:
    1. **Entrance (Login)**: User enters their Workspace ID. On submit, they are redirected to `https://[slug].vantage.com/login`.
    2. **Recruitment (Sign Up)**: User enters the Workspace ID they wish to join. On submit, they are redirected to `https://[slug].vantage.com/register/user`.
    3. **Founding (Register)**: User enters new Business details. On submit, the system provisions the backend and redirects them to the new instance dashboard.
- **How the page achieves its goal**: By using a state-driven UI with high-end aesthetics (Glassmorphism, Tailwind transitions), it provides a frictionless entry point for all user personas (Owners, Employees, Leads).

## Technical Implementation
- **Location**: `src/app/landing/page.tsx` (Rewritten via middleware from root `/`).
- **Aesthetics**: Slate-950 base, Ethereal gradients, Backdrop-blur-2xl cards.
- **Routing**: Internal Next.js middleware rewrites the root domain to this segment.
