
# 2FA (Two-Factor Authentication) Documentation

## Goal
Enhance system security by requiring a second verification step (OTP) during login.

## Data Movement
### Read From
- `erp.User`: `is_2fa_enabled`, `two_factor_secret`.
- Client: OTP code from Authenticator app.

### Saved To
- `erp.User`: `two_factor_secret` (during setup), `is_2fa_enabled`.

## User Interactions
- **Enable 2FA**: User scans QR code and enters verification OTP.
- **Login with 2FA**: After password verification, user is prompted for OTP.
- **Disable 2FA**: User can turn off 2FA from profile settings.

## Workflow Step-by-Step
1. **Setup**:
   - User goes to Security settings.
   - System generates a 32-character base32 secret.
   - System displays a QR code (otpauth URL).
   - User scans with Google Authenticator.
   - User enters the current OTP to confirm setup.
   - System sets `is_2fa_enabled = True`.

2. **Login**:
   - User enters email/password.
   - Backend verifies password.
   - If 2FA is enabled, backend returns `2fa_required: true`.
   - Frontend redirects to `/2fa/verify`.
   - User enters OTP.
   - Backend verifies OTP using `pyotp`.
   - Backend issues session cookies.

## How it Achieves Goal
By using TOTP (Time-based One-Time Password), even if a password is stolen, the attacker cannot gain access without the physical device generating the OTP.
