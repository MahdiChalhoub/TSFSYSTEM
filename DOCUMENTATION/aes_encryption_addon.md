# AES-256 Field-Level Encryption Add-on

## Goal
Provides AES-256-GCM authenticated encryption for sensitive data fields (bank accounts, SSNs, etc.) as a paid SaaS add-on with per-organization key management.

## Architecture

### Data Flow
```
User Input → EncryptedCharField.get_prep_value() → encrypt_value() → DB (stored as 'enc:nonce:ciphertext')
DB Read    → EncryptedCharField.from_db_value()  → decrypt_value() → Plaintext in app
```

### Files

| File | Purpose |
|------|---------|
| `erp/encryption.py` | Core AES-256-GCM utility (encrypt/decrypt/keygen) |
| `erp/fields.py` | Custom `EncryptedCharField` Django field |
| `erp/encryption_service.py` | Lifecycle management (activate/deactivate/rotate) |
| `erp/views_saas_modules.py` | API endpoints for encryption management |
| `erp/models.py` | `Organization.encryption_key` + `encryption_enabled` |

## API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/saas/modules/encryption/status/` | Check org encryption status | Authenticated |
| POST | `/api/saas/modules/encryption/activate/` | Activate encryption | Authenticated + addon entitled |
| POST | `/api/saas/modules/encryption/deactivate/` | Deactivate (key preserved) | Authenticated |
| POST | `/api/saas/modules/encryption/rotate-key/` | Rotate key + re-encrypt all | Superadmin |

### Activate Request
```json
POST /api/saas/modules/encryption/activate/
{ "force": true }  // Superadmin can skip entitlement check
```

### Status Response
```json
{
  "organization": "Demo Corp",
  "encryption_enabled": true,
  "has_key": true,
  "addon_entitled": true,
  "plan": "Professional"
}
```

## Usage in Models

```python
from erp.fields import EncryptedCharField

class Employee(models.Model):
    ssn = EncryptedCharField(max_length=500, verbose_name='SSN')
    bank_account = EncryptedCharField(max_length=500)
```

## Security Model

- **Algorithm**: AES-256-GCM (authenticated encryption — confidentiality + integrity)
- **Key Size**: 256-bit (32 bytes), base64-encoded in DB
- **Nonce**: 96-bit random per encryption (NIST recommended for GCM)
- **Tenant Isolation**: Each org has its own unique key
- **Key Rotation**: Supported via `/rotate-key/` — re-encrypts all fields
- **Fail-Open**: If encryption fails, data stored as plaintext (data safety > strict encryption)
- **Deactivation**: Key preserved so existing encrypted data remains readable

## Database Changes

| Table | Column | Type | Notes |
|-------|--------|------|-------|
| `organization` | `encryption_key` | `CharField(64)` | Base64 AES-256 key |
| `organization` | `encryption_enabled` | `BooleanField` | Active toggle |

## Workflow

1. SaaS admin creates "AES-256 Encryption" `PlanAddon` (addon_type='encryption')
2. Assigns it to subscription plans
3. Tenant admin calls `POST /encryption/activate/`
4. System generates org key, enables encryption
5. Any model using `EncryptedCharField` now encrypts/decrypts transparently
6. Key rotation via `POST /encryption/rotate-key/` by superadmin
