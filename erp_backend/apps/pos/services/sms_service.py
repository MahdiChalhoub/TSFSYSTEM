"""
Pluggable SMS service for TSFSYSTEM.

Providers supported:
  - twilio         : Twilio REST API
  - africas_talking: Africa's Talking SMS API (great coverage in West/East Africa)
  - infobip        : Infobip SMS REST API
  - webhook        : Generic HTTP POST webhook (bring-your-own provider)
  - none           : Disabled (no SMS sent)

Config is stored in POSSettings per organisation.
All network calls are wrapped in try/except — SMS failure must never
break the delivery creation flow.
"""

import logging
import requests

logger = logging.getLogger(__name__)


def send_delivery_code_sms(phone: str, recipient_name: str, code: str, pos_settings) -> bool:
    """
    Send the client_delivery_code to the client via SMS.
    Returns True if successfully sent, False otherwise.
    Never raises — failure is logged and silently swallowed.
    """
    provider = getattr(pos_settings, 'sms_provider', 'none')
    if provider == 'none' or not provider:
        return False
    if not phone or not code:
        return False

    # Sanitise phone (strip spaces/dashes, ensure + prefix)
    phone = _normalise_phone(phone)
    if not phone:
        logger.warning("[SMS] Invalid phone number — skipping SMS.")
        return False

    message = _build_message(recipient_name, code)

    try:
        if provider == 'twilio':
            return _send_twilio(phone, message, pos_settings)
        elif provider == 'africas_talking':
            return _send_africas_talking(phone, message, pos_settings)
        elif provider == 'infobip':
            return _send_infobip(phone, message, pos_settings)
        elif provider == 'webhook':
            return _send_webhook(phone, message, code, pos_settings)
        else:
            logger.warning(f"[SMS] Unknown provider '{provider}' — skipping.")
            return False
    except Exception as exc:
        logger.error(f"[SMS] Unexpected error sending to {phone}: {exc}")
        return False


# ── Message template ─────────────────────────────────────────────────────────

def _build_message(recipient_name: str, code: str) -> str:
    name = recipient_name.strip() if recipient_name else "Customer"
    return (
        f"Hello {name},\n"
        f"Your delivery confirmation code is: {code}\n"
        f"Give this code to the driver when your order arrives."
    )


# ── Phone normalisation ───────────────────────────────────────────────────────

def _normalise_phone(phone: str) -> str:
    """Strip formatting characters; ensure E.164 format."""
    import re
    phone = re.sub(r'[\s\-\(\)]', '', str(phone))
    if not phone:
        return ''
    # Add + if missing (assume international)
    if not phone.startswith('+'):
        phone = '+' + phone
    # Basic E.164 length check (7–15 digits after +)
    digits = phone[1:]
    if not digits.isdigit() or not (7 <= len(digits) <= 15):
        return ''
    return phone


# ── Twilio ────────────────────────────────────────────────────────────────────

def _send_twilio(phone: str, message: str, settings) -> bool:
    account_sid = getattr(settings, 'sms_account_sid', '') or ''
    auth_token  = getattr(settings, 'sms_api_key', '') or ''
    from_number = getattr(settings, 'sms_sender_id', '') or ''

    if not all([account_sid, auth_token, from_number]):
        logger.error("[SMS/Twilio] Missing credentials (account_sid, api_key, sender_id).")
        return False

    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    resp = requests.post(
        url,
        auth=(account_sid, auth_token),
        data={'From': from_number, 'To': phone, 'Body': message},
        timeout=10,
    )
    if resp.status_code in (200, 201):
        logger.info(f"[SMS/Twilio] Sent to {phone}")
        return True
    logger.error(f"[SMS/Twilio] Failed ({resp.status_code}): {resp.text[:300]}")
    return False


# ── Africa's Talking ──────────────────────────────────────────────────────────

def _send_africas_talking(phone: str, message: str, settings) -> bool:
    api_key   = getattr(settings, 'sms_api_key', '') or ''
    username  = getattr(settings, 'sms_account_sid', '') or 'sandbox'
    sender_id = getattr(settings, 'sms_sender_id', '') or None

    if not api_key:
        logger.error("[SMS/AfricasTalking] Missing api_key.")
        return False

    payload = {
        'username': username,
        'to': phone,
        'message': message,
    }
    if sender_id:
        payload['from'] = sender_id

    resp = requests.post(
        "https://api.africastalking.com/version1/messaging",
        headers={
            'apiKey': api_key,
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        data=payload,
        timeout=10,
    )
    data = resp.json() if resp.content else {}
    status = data.get('SMSMessageData', {}).get('Recipients', [{}])[0].get('status', '')
    if resp.status_code == 201 or 'Success' in str(status):
        logger.info(f"[SMS/AfricasTalking] Sent to {phone}")
        return True
    logger.error(f"[SMS/AfricasTalking] Failed ({resp.status_code}): {resp.text[:300]}")
    return False


# ── Infobip ───────────────────────────────────────────────────────────────────

def _send_infobip(phone: str, message: str, settings) -> bool:
    api_key    = getattr(settings, 'sms_api_key', '') or ''
    base_url   = getattr(settings, 'sms_webhook_url', '') or ''  # Infobip base URL
    sender_id  = getattr(settings, 'sms_sender_id', '') or 'TSF'

    if not api_key or not base_url:
        logger.error("[SMS/Infobip] Missing api_key or base_url (stored in webhook_url field).")
        return False

    url = f"{base_url.rstrip('/')}/sms/2/text/advanced"
    payload = {
        "messages": [{
            "from": sender_id,
            "destinations": [{"to": phone.lstrip('+')}],
            "text": message,
        }]
    }
    resp = requests.post(
        url,
        headers={'Authorization': f'App {api_key}', 'Content-Type': 'application/json'},
        json=payload,
        timeout=10,
    )
    if resp.status_code in (200, 201):
        logger.info(f"[SMS/Infobip] Sent to {phone}")
        return True
    logger.error(f"[SMS/Infobip] Failed ({resp.status_code}): {resp.text[:300]}")
    return False


# ── Generic Webhook ───────────────────────────────────────────────────────────

def _send_webhook(phone: str, message: str, code: str, settings) -> bool:
    """
    POST to a custom webhook URL with JSON body:
    { "phone": "+22507...", "message": "...", "code": "123456" }
    Authorization: Bearer <sms_api_key>  (if provided)
    """
    webhook_url = getattr(settings, 'sms_webhook_url', '') or ''
    api_key     = getattr(settings, 'sms_api_key', '') or ''

    if not webhook_url:
        logger.error("[SMS/Webhook] No webhook URL configured.")
        return False

    headers = {'Content-Type': 'application/json'}
    if api_key:
        headers['Authorization'] = f'Bearer {api_key}'

    resp = requests.post(
        webhook_url,
        json={'phone': phone, 'message': message, 'code': code},
        headers=headers,
        timeout=10,
    )
    if resp.status_code in (200, 201, 202, 204):
        logger.info(f"[SMS/Webhook] Sent to {phone} via {webhook_url}")
        return True
    logger.error(f"[SMS/Webhook] Failed ({resp.status_code}): {resp.text[:300]}")
    return False
