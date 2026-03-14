"""
ZATCA Phase 2 E-Invoicing — Verification Script
=================================================
Tests:
  1. UBL 2.1 XML generation with mandatory ZATCA elements
  2. ECDSA-SHA256 digital signing
  3. Invoice hash chaining (SHA-256)
  4. TLV QR code generation (Phase 2 fields)
  5. E-Invoice endpoint integration (submit, status, qr)
"""
import os, sys, django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
os.environ['LOCAL_DEV'] = '1'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from decimal import Decimal
from xml.etree import ElementTree as ET
import json, hashlib, base64

PASS = 0
FAIL = 0

def check(label, condition, detail=''):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  ✅ {label}")
    else:
        FAIL += 1
        print(f"  ❌ {label}" + (f" — {detail}" if detail else ''))


def setup_org_and_invoice():
    """Create test org, contact, invoice with lines."""
    from erp.models import Organization, User
    from apps.crm.models import Contact
    from apps.finance.invoice_models import Invoice, InvoiceLine

    org, _ = Organization.objects.get_or_create(
        slug='zatca-test',
        defaults={'name': 'ZATCA Test Corp', 'city': 'Riyadh', 'zip_code': '12345',
                  'address': '123 King Fahd Rd', 'country': 'Saudi Arabia',
                  'settings': {'country_code': 'SA'}}
    )

    user, _ = User.objects.get_or_create(
        username='zatca_tester',
        defaults={'organization': org, 'email': 'tester@zatca.test'}
    )

    contact, _ = Contact.objects.update_or_create(
        name='Saudi Buyer LLC', organization=org,
        defaults={'email': 'buyer@sa.test', 'type': 'CUSTOMER',
                  'balance': Decimal('0'), 'credit_limit': Decimal('10000'),
                  'airsi_tax_rate': Decimal('0'), 'is_airsi_subject': False}
    )

    invoice = Invoice.objects.create(
        organization=org,
        invoice_number='INV-ZATCA-001',
        type='SALES',
        status='SENT',
        contact=contact,
        contact_name='Saudi Buyer LLC',
        contact_vat_id='310000000000003',
        issue_date='2026-02-22',
        due_date='2026-03-24',
        subtotal_ht=Decimal('1000.00'),
        tax_amount=Decimal('150.00'),
        total_amount=Decimal('1150.00'),
        default_tax_rate=Decimal('15.00'),
        currency='SAR',
        created_by=user,
    )

    line = InvoiceLine.objects.create(
        organization=org,
        invoice=invoice,
        description='Cloud ERP License (Annual)',
        quantity=Decimal('1'),
        unit_price=Decimal('1000.00'),
        tax_rate=Decimal('15.00'),
        line_total_ht=Decimal('1000.00'),
        tax_amount=Decimal('150.00'),
        line_total_ttc=Decimal('1150.00'),
        sort_order=0,
    )

    return org, user, contact, invoice


def test_ubl_xml_generation(invoice):
    """Test 1: UBL 2.1 XML contains all mandatory ZATCA elements."""
    print("\n── Test 1: UBL 2.1 XML Generation ──")
    from apps.finance.einvoicing_service import ZATCAService

    service = ZATCAService(str(invoice.organization_id))
    xml = service.generate_ubl_xml(invoice)

    check("XML is non-empty string", isinstance(xml, str) and len(xml) > 100)
    check("Contains XML declaration", '<?xml' in xml)

    # Parse and verify elements
    root = ET.fromstring(xml)
    ns = {'cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
          'cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2'}

    check("Has cbc:ID", root.find('.//cbc:ID', ns) is not None)
    check("Has cbc:UUID", root.find('.//cbc:UUID', ns) is not None)
    check("Has cbc:IssueDate", root.find('.//cbc:IssueDate', ns) is not None)
    check("Has cbc:InvoiceTypeCode", root.find('.//cbc:InvoiceTypeCode', ns) is not None)
    check("Has cac:AccountingSupplierParty", root.find('.//cac:AccountingSupplierParty', ns) is not None)
    check("Has cac:AccountingCustomerParty", root.find('.//cac:AccountingCustomerParty', ns) is not None)
    check("Has cac:TaxTotal", root.find('.//cac:TaxTotal', ns) is not None)
    check("Has cac:LegalMonetaryTotal", root.find('.//cac:LegalMonetaryTotal', ns) is not None)
    check("Has cac:InvoiceLine", root.find('.//cac:InvoiceLine', ns) is not None)

    # Check payable amount
    payable = root.find('.//cbc:PayableAmount', ns)
    check("PayableAmount = 1150.00", payable is not None and payable.text == '1150.00')

    # Check previous invoice hash (PIH)
    pih = root.find(".//cbc:ID[.='PIH']/..", ns)
    check("Has PIH (Previous Invoice Hash) reference", pih is not None)

    return xml


def test_signing(xml, org):
    """Test 2: ECDSA-SHA256 digital signing."""
    print("\n── Test 2: ECDSA-SHA256 Signing ──")
    from apps.finance.einvoicing_service import ZATCAService

    service = ZATCAService(str(org.id))
    result = service.sign_invoice(xml)

    check("Returns dict", isinstance(result, dict))
    check("Has signed_xml", 'signed_xml' in result)
    check("Has signature_value", 'signature_value' in result and len(result['signature_value']) > 10)
    check("Has invoice_hash (SHA-256)", 'invoice_hash' in result and len(result['invoice_hash']) == 64)
    check("Status is SIGNED", result.get('status') == 'SIGNED')

    # Verify hash matches manual computation
    manual_hash = hashlib.sha256(xml.encode('utf-8')).hexdigest()
    check("Hash matches manual SHA-256", result['invoice_hash'] == manual_hash)

    return result


def test_hash_chain(org, invoice):
    """Test 3: Invoice hash chaining."""
    print("\n── Test 3: Hash Chain ──")
    from apps.finance.einvoicing_service import ZATCAService
    from apps.finance.zatca_config import ZATCAConfig

    # Create a ZATCAConfig for chain testing
    config, _ = ZATCAConfig.objects.update_or_create(
        organization=org,
        defaults={
            'vat_registration_number': '310000000000003',
            'seller_name': 'ZATCA Test Corp',
            'is_sandbox': True,
            'is_active': True,
            'last_invoice_hash': '0' * 64,
            'invoice_counter': 0,
        }
    )

    service = ZATCAService(str(org.id))

    # First invoice in chain
    prev_hash_1 = service.build_hash_chain(invoice)
    check("First invoice prev_hash is genesis (64 zeros)", prev_hash_1 == '0' * 64)

    xml_1 = service.generate_ubl_xml(invoice, previous_hash=prev_hash_1)
    hash_1 = service.compute_invoice_hash(xml_1)
    check("Invoice hash is 64-char hex", len(hash_1) == 64 and all(c in '0123456789abcdef' for c in hash_1))

    # Update chain
    service.update_chain(hash_1)
    config.refresh_from_db()
    check("Chain anchor updated", config.last_invoice_hash == hash_1)
    check("Counter incremented", config.invoice_counter == 1)

    # Second invoice should link to hash_1
    prev_hash_2 = service.build_hash_chain(invoice)
    check("Second invoice links to first hash", prev_hash_2 == hash_1)

    return config


def test_qr_code(invoice, config):
    """Test 4: TLV QR code generation."""
    print("\n── Test 4: TLV QR Code ──")
    from apps.finance.einvoicing_service import ZATCAService

    service = ZATCAService(str(invoice.organization_id))
    qr_result = service.generate_qr_code(invoice, signature_value='test-sig-value')

    check("Returns dict", isinstance(qr_result, dict))
    check("Has qr_data (base64)", 'qr_data' in qr_result and len(qr_result['qr_data']) > 10)
    check("Has qr_text (data URI)", 'qr_text' in qr_result and qr_result['qr_text'].startswith('data:'))

    # Decode and verify TLV tags
    qr_bytes = base64.b64decode(qr_result['qr_data'])
    tags_found = set()
    i = 0
    while i < len(qr_bytes):
        tag = qr_bytes[i]
        length = qr_bytes[i + 1]
        tags_found.add(tag)
        i += 2 + length

    check("TLV Tag 1 (seller name) present", 1 in tags_found)
    check("TLV Tag 2 (VAT number) present", 2 in tags_found)
    check("TLV Tag 3 (timestamp) present", 3 in tags_found)
    check("TLV Tag 4 (total) present", 4 in tags_found)
    check("TLV Tag 5 (VAT amount) present", 5 in tags_found)

    # Test convenience alias used by serializer
    qr_data_str = service.generate_qr_code_data(invoice)
    check("generate_qr_code_data() returns string", isinstance(qr_data_str, str))


def test_e_invoice_endpoint(org, user, invoice):
    """Test 5: E-Invoice endpoint integration."""
    print("\n── Test 5: E-Invoice Endpoint Integration ──")
    from django.test import Client

    client = Client(HTTP_HOST='localhost')
    client.force_login(user)

    headers = {'HTTP_X_TENANT_ID': str(org.id)}

    # Test submit (with provider=zatca query param)
    resp = client.post(
        f'/api/finance/einvoice/submit/{invoice.id}/?provider=zatca',
        content_type='application/json',
        data='{}',
        **headers,
    )
    print(f"  Submit response: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        check("Submit returns status", 'status' in data)
        check("Submit returns invoice_hash", 'invoice_hash' in data)
        check("Submit returns clearance_id", 'clearance_id' in data)
        check("Submit returns qr_data", 'qr_data' in data)
        check("Status is CLEARED or REPORTED", data.get('status') in ('CLEARED', 'REPORTED'))
    else:
        check("Submit endpoint succeeds", False, f"Got {resp.status_code}: {resp.content[:200]}")

    # Refresh invoice from DB
    invoice.refresh_from_db()
    check("Invoice has invoice_hash after submit", bool(invoice.invoice_hash))
    check("Invoice has previous_invoice_hash after submit", invoice.previous_invoice_hash is not None)
    check("Invoice fne_status is CERTIFIED", invoice.fne_status == 'CERTIFIED')

    # Test status endpoint
    resp = client.get(
        f'/api/finance/einvoice/status/{invoice.id}/',
        **headers,
    )
    if resp.status_code == 200:
        data = resp.json()
        check("Status endpoint returns invoice_hash", 'invoice_hash' in data)
        check("Status endpoint returns zatca_clearance_id", 'zatca_clearance_id' in data)
        check("Status endpoint doesn't crash", True)
    else:
        check("Status endpoint works", False, f"Got {resp.status_code}: {resp.content[:200]}")

    # Test QR endpoint
    resp = client.get(
        f'/api/finance/einvoice/qr/{invoice.id}/',
        **headers,
    )
    if resp.status_code == 200:
        data = resp.json()
        check("QR endpoint returns qr_data", 'qr_data' in data and data['qr_data'])
    else:
        check("QR endpoint works", False, f"Got {resp.status_code}: {resp.content[:200]}")


def main():
    global PASS, FAIL
    print("=" * 60)
    print("ZATCA Phase 2 E-Invoicing — Verification")
    print("=" * 60)

    # Force create tables
    print("\n── Setup: Creating tables ──")
    from django.db import connection

    # Create zatca_config table
    try:
        with connection.schema_editor() as schema_editor:
            from apps.finance.zatca_config import ZATCAConfig
            schema_editor.create_model(ZATCAConfig)
            print(f"  Created table: zatca_config")
    except Exception as e:
        if 'already exists' in str(e):
            print(f"  Table zatca_config already exists")
        else:
            print(f"  Note: {e}")

    # Add new columns to invoice table (each in its own autocommit cursor)
    from apps.finance.invoice_models import Invoice
    for field_name in ['invoice_hash', 'previous_invoice_hash', 'zatca_signed_xml', 'zatca_clearance_id']:
        try:
            field = Invoice._meta.get_field(field_name)
            col_type = _get_column_type(field)
            # Check if column exists first
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name = 'invoice' AND column_name = %s",
                    [field_name]
                )
                if cursor.fetchone():
                    print(f"  Column invoice.{field_name} already exists")
                else:
                    cursor.execute(f"ALTER TABLE invoice ADD COLUMN {field_name} {col_type}")
                    print(f"  Added column: invoice.{field_name}")
        except Exception as e:
            print(f"  Error for {field_name}: {e}")

    # Run tests
    org, user, contact, invoice = setup_org_and_invoice()

    xml = test_ubl_xml_generation(invoice)
    test_signing(xml, org)
    config = test_hash_chain(org, invoice)
    test_qr_code(invoice, config)
    test_e_invoice_endpoint(org, user, invoice)

    # Summary
    print("\n" + "=" * 60)
    total = PASS + FAIL
    print(f"Results: {PASS}/{total} passed, {FAIL} failed")
    if FAIL == 0:
        print("🎉 ALL TESTS PASSED")
    else:
        print("⚠️  SOME TESTS FAILED")
    print("=" * 60)

    # Cleanup
    try:
        from apps.finance.invoice_models import Invoice, InvoiceLine
        InvoiceLine.objects.filter(invoice__invoice_number='INV-ZATCA-001').delete()
        Invoice.objects.filter(invoice_number='INV-ZATCA-001').delete()
    except Exception:
        pass


def _get_column_type(field):
    """Get SQL column type for a Django field."""
    if isinstance(field, (type(None),)):
        return 'TEXT'
    internal = field.get_internal_type()
    if internal == 'CharField':
        return f"VARCHAR({field.max_length}) NULL"
    elif internal == 'TextField':
        return 'TEXT NULL'
    return 'TEXT NULL'


if __name__ == '__main__':
    main()
