# Core Module

## Overview
The Core module provides foundational infrastructure for all TSFSYSTEM modules, including multi-tenant isolation, authentication, RBAC, audit logging, and base models. It is the architectural backbone that every other module depends on.

## Key Features
- Multi-tenant (organization) data isolation
- JWT-based authentication
- Role-Based Access Control (RBAC)
- Comprehensive audit logging
- Base model classes with lifecycle hooks
- User and team management
- Organization settings and configuration
- API authentication and permissions

## Core Models

### Organization
**Purpose**: Represents a tenant in the multi-tenant system
**Key Fields**: name, slug, logo, settings, is_active, created_at
**Relationships**: Has many Users, has settings
**Key Methods**:
- `get_setting(key, default=None)` - Retrieve organization setting
- `set_setting(key, value)` - Update organization setting
- `activate()` / `deactivate()` - Control org status

### User
**Purpose**: System users with authentication and permissions
**Key Fields**: email, username, organization, is_active, role, permissions
**Relationships**: Belongs to Organization, has many Teams
**Key Methods**:
- `has_perm(permission)` - Check user permission
- `get_accessible_organizations()` - Multi-org users
- `generate_token()` - JWT token generation

### Team
**Purpose**: User groups within organization
**Key Fields**: name, organization, members, permissions
**Relationships**: Belongs to Organization, has many Users
**Key Methods**: `add_member()`, `remove_member()`, `grant_permission()`

### AuditLog
**Purpose**: Comprehensive audit trail of all system changes
**Key Fields**: user, organization, action, model, object_id, changes, timestamp, ip_address
**Relationships**: References User and Organization
**Key Methods**: `create_log_entry()` - Static helper for logging

### Permission
**Purpose**: Granular permission definitions
**Key Fields**: codename, name, module, description
**Relationships**: Many-to-many with User and Team

## API Endpoints

### POST /api/auth/login/
**Description**: Authenticate user and get JWT token
**Authentication**: Not required
**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```
**Response**:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "organization": "acme-corp"
  }
}
```

### POST /api/auth/refresh/
**Description**: Refresh access token using refresh token
**Request Body**: `{"refresh_token": "..."}`

### GET /api/core/organizations/
**Description**: List organizations (multi-org users only)
**Authentication**: Required
**Response**: List of organizations user has access to

### GET /api/core/users/
**Description**: List users in current organization
**Authentication**: Required
**Permissions**: `core.view_user`
**Query Parameters**: `role`, `is_active`, `search`

### POST /api/core/users/
**Description**: Create new user
**Permissions**: `core.add_user`
**Request Body**:
```json
{
  "email": "newuser@example.com",
  "username": "newuser",
  "role": "sales_rep",
  "permissions": ["sales.view_order", "crm.view_contact"]
}
```

### GET /api/core/audit-logs/
**Description**: View audit trail
**Permissions**: `core.view_auditlog`
**Query Parameters**: `user`, `action`, `model`, `date_from`, `date_to`

## Business Logic

### Multi-Tenant Isolation
- **Database Level**: All models inherit `TenantAwareModel`
- **Middleware**: `TenantMiddleware` sets `request.tenant`
- **QuerySet Filtering**: Automatic `organization=` filter
- **Row-Level Security**: PostgreSQL RLS policies (optional)

**Example**:
```python
# All queries automatically scoped to organization
products = Product.objects.all()  # Only current org's products
```

### Authentication Flow
1. User submits credentials to `/api/auth/login/`
2. Validate email/password
3. Generate JWT access token (15 min expiry)
4. Generate refresh token (7 days expiry)
5. Return tokens + user data
6. Client includes token in Authorization header
7. Middleware validates token on each request

### Permission Checking
```python
# Decorator-based
@permission_required('sales.add_order')
def create_order(request):
    ...

# Code-based
if request.user.has_perm('finance.view_invoice'):
    ...

# View mixin
class InvoiceViewSet(PermissionRequiredMixin, viewsets.ModelViewSet):
    permission_required = 'finance.view_invoice'
```

### Audit Logging
All model changes automatically logged via `AuditLogMixin`:
```python
class Product(AuditLogMixin, TenantAwareModel):
    name = models.CharField(max_length=255)
    # Changes to name field automatically logged
```

## Events

**Published**:
- `core.user.created`: New user registered
- `core.user.login`: User authenticated
- `core.user.logout`: User session ended
- `core.organization.created`: New tenant created
- `core.permission.granted`: Permission assigned to user

**Consumed**:
- (None - Core is foundational, doesn't consume events from other modules)

## Configuration

**Settings** (Django settings.py):
- `TENANT_MODEL`: Model to use for tenant (default: `core.Organization`)
- `JWT_SECRET_KEY`: Secret for signing tokens
- `JWT_ACCESS_TOKEN_LIFETIME`: Token expiry (default: 15 minutes)
- `JWT_REFRESH_TOKEN_LIFETIME`: Refresh token expiry (default: 7 days)
- `AUDIT_LOG_ENABLED`: Enable/disable audit logging (default: True)

**Environment Variables**:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis for caching and sessions
- `SECRET_KEY`: Django secret key

## Base Classes

### TenantAwareModel
```python
class TenantAwareModel(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        # Auto-set organization from thread-local context
        if not self.organization_id:
            self.organization = get_current_organization()
        super().save(*args, **kwargs)
```

### AuditLogMixin
```python
class AuditLogMixin:
    def save(self, *args, **kwargs):
        # Capture old values
        old_instance = self.__class__.objects.get(pk=self.pk) if self.pk else None

        # Save
        super().save(*args, **kwargs)

        # Log changes
        AuditLog.create_log_entry(
            user=get_current_user(),
            action='UPDATE' if old_instance else 'CREATE',
            instance=self,
            changes=self.get_changed_fields(old_instance)
        )
```

### TimestampedModel
```python
class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
```

## Common Workflows

### Workflow 1: User Registration
1. Admin creates user via API
2. System generates temporary password
3. Email sent to user with login link
4. User logs in, prompted to change password
5. User session created
6. Audit log entry created

### Workflow 2: Permission Grant
1. Admin navigates to user management
2. Selects user and permissions to grant
3. System validates admin has permission to grant
4. Permissions assigned
5. User cache invalidated
6. Audit log entry created
7. Event emitted for other modules

## Testing

**Unit Tests**:
```python
# Test tenant isolation
def test_queryset_filtered_by_organization(self):
    org1_product = Product.objects.create(organization=self.org1, name="P1")
    org2_product = Product.objects.create(organization=self.org2, name="P2")

    set_current_organization(self.org1)
    products = Product.objects.all()

    self.assertEqual(products.count(), 1)
    self.assertEqual(products.first(), org1_product)

# Test authentication
def test_login_returns_jwt_token(self):
    response = self.client.post('/api/auth/login/', {
        'email': 'test@example.com',
        'password': 'password123'
    })
    self.assertEqual(response.status_code, 200)
    self.assertIn('access_token', response.json())
```

## Dependencies

**Depends on**:
- Django framework
- PostgreSQL database
- Redis (caching, sessions)

**Depended on by**:
- ALL modules (finance, inventory, sales, crm, hr, pos, etc.)

## Security Considerations

### Critical Security Features
1. **Tenant Isolation**: Absolute data separation between organizations
2. **JWT Security**: Signed tokens with expiration
3. **Password Hashing**: bcrypt with work factor 12
4. **CSRF Protection**: Django middleware enabled
5. **Rate Limiting**: Login endpoint rate-limited (5 attempts/min)
6. **Audit Trail**: All security events logged

### Security Tests
- Cross-tenant data access attempts (should fail)
- Token expiration and refresh
- Permission escalation attempts
- SQL injection via authentication

## Performance Optimization

- **Caching**: User permissions cached in Redis (5-minute TTL)
- **Database Indexes**: On `organization_id`, `email`, `username`
- **Connection Pooling**: PostgreSQL pgBouncer
- **Query Optimization**: `select_related` for organization joins

---

**Last Updated**: 2026-03-14
**Module Status**: Production
**Test Coverage**: 95%
**Critical Module**: YES - All other modules depend on this
