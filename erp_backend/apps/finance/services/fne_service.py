"""
FNE E-Invoicing Service
========================
Integration with Côte d'Ivoire's Facture Normalisée Électronique (FNE) platform.
API managed by DGI (Direction Générale des Impôts).

Endpoints:
  - POST /external/invoices/sign → certify sale invoice, credit note, or purchase bordereau

Authentication:
  - Bearer Token (API Key from FNE dashboard, section "Paramétrage")

Tax Types:
  - TVA  = TVA normal (18%)
  - TVAB = TVA réduit (9%)
  - TVAC = TVA exonéré conventionnel (0%)
  - TVAD = TVA exonéré de droit commun (0%)

Invoice Templates:
  - B2C = Business to Consumer
  - B2B = Business to Business
  - B2G = Business to Government
  - B2F = Business to Foreign (multi-currency)
"""
import logging
import requests
from decimal import Decimal
from typing import Optional
from dataclasses import dataclass, field

logger = logging.getLogger('tsfsystem.fne')


# ═══════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════

FNE_SANDBOX_URL = 'http://54.247.95.108/ws'
FNE_SIGN_ENDPOINT = '/external/invoices/sign'
FNE_REFUND_ENDPOINT = '/external/invoices/{invoice_id}/refund'
FNE_TIMEOUT = 30  # seconds


@dataclass
class FNEConfig:
    """FNE connection config — loaded from org's e-invoice settings."""
    api_key: str
    base_url: str = FNE_SANDBOX_URL
    is_production: bool = False
    ncc: str = ''  # Numéro de Compte Contribuable
    establishment: str = ''
    point_of_sale: str = ''
    commercial_message: str = ''
    footer: str = ''

    @property
    def sign_url(self) -> str:
        return f"{self.base_url.rstrip('/')}{FNE_SIGN_ENDPOINT}"

    def refund_url(self, invoice_id: str) -> str:
        """Build the refund endpoint URL for a specific FNE invoice."""
        return f"{self.base_url.rstrip('/')}{FNE_REFUND_ENDPOINT.format(invoice_id=invoice_id)}"

    @property
    def headers(self) -> dict:
        return {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': f'Bearer {self.api_key}',
        }


# ═══════════════════════════════════════════════════════════════
# Data Models
# ═══════════════════════════════════════════════════════════════

@dataclass
class FNECustomTax:
    """Custom tax (e.g., AIRSI, DTD, GRA)."""
    name: str
    amount: float  # rate as percentage (e.g., 5 for 5%)

    def to_dict(self) -> dict:
        return {'name': self.name, 'amount': self.amount}


@dataclass
class FNELineItem:
    """Single invoice line item."""
    description: str
    quantity: float
    amount: float  # unit price HT
    taxes: list = field(default_factory=lambda: ['TVA'])  # TVA, TVAB, TVAC, TVAD
    reference: str = ''
    discount: float = 0  # percentage
    measurement_unit: str = ''
    custom_taxes: list = field(default_factory=list)  # list of FNECustomTax

    def to_dict(self) -> dict:
        d = {
            'description': self.description,
            'quantity': self.quantity,
            'amount': self.amount,
            'taxes': self.taxes,
        }
        if self.reference:
            d['reference'] = self.reference
        if self.discount:
            d['discount'] = self.discount
        if self.measurement_unit:
            d['measurementUnit'] = self.measurement_unit
        if self.custom_taxes:
            d['customTaxes'] = [ct.to_dict() if isinstance(ct, FNECustomTax) else ct for ct in self.custom_taxes]
        return d


@dataclass
class FNEInvoiceRequest:
    """Full FNE invoice certification request."""
    # Required
    invoice_type: str  # 'sale', 'creditNote', 'purchase'
    payment_method: str  # 'cash', 'cheque', 'transfer', 'mobile-money', 'credit-card'
    template: str  # 'B2C', 'B2B', 'B2G', 'B2F'
    items: list  # list of FNELineItem

    # Client info
    client_ncc: str = ''  # NCC of the buyer
    client_company_name: str = ''
    client_phone: str = ''
    client_email: str = ''
    client_seller_name: str = ''

    # Establishment
    point_of_sale: str = ''
    establishment: str = ''

    # Optional
    commercial_message: str = ''
    footer: str = ''
    discount: float = 0  # global discount percentage

    # Credit note specific
    parent_reference: str = ''  # original invoice reference for credit notes

    # RNE (receipt linkage)
    is_rne: bool = False
    rne: str = ''  # receipt number

    # Multi-currency (B2F)
    foreign_currency: str = ''
    foreign_currency_rate: float = 0

    # Global custom taxes
    custom_taxes: list = field(default_factory=list)

    def to_dict(self) -> dict:
        d = {
            'invoiceType': self.invoice_type,
            'paymentMethod': self.payment_method,
            'template': self.template,
            'items': [item.to_dict() if isinstance(item, FNELineItem) else item for item in self.items],
        }
        # Client fields
        if self.client_ncc:
            d['clientNcc'] = self.client_ncc
        if self.client_company_name:
            d['clientCompanyName'] = self.client_company_name
        if self.client_phone:
            d['clientPhone'] = self.client_phone
        if self.client_email:
            d['clientEmail'] = self.client_email
        if self.client_seller_name:
            d['clientSellerName'] = self.client_seller_name

        # Establishment
        if self.point_of_sale:
            d['pointOfSale'] = self.point_of_sale
        if self.establishment:
            d['establishment'] = self.establishment

        # Optional
        if self.commercial_message:
            d['commercialMessage'] = self.commercial_message
        if self.footer:
            d['footer'] = self.footer
        if self.discount:
            d['discount'] = self.discount

        # Credit note
        if self.invoice_type == 'creditNote' and self.parent_reference:
            d['parentReference'] = self.parent_reference

        # RNE
        if self.is_rne:
            d['isRne'] = True
            d['rne'] = self.rne

        # Multi-currency
        if self.foreign_currency:
            d['foreignCurrency'] = self.foreign_currency
            d['foreignCurrencyRate'] = self.foreign_currency_rate

        # Global custom taxes
        if self.custom_taxes:
            d['customTaxes'] = [ct.to_dict() if isinstance(ct, FNECustomTax) else ct for ct in self.custom_taxes]

        return d


@dataclass
class FNEInvoiceResponse:
    """Parsed FNE certification response."""
    success: bool
    reference: str = ''  # e.g. "9606123E25000000019"
    ncc: str = ''
    token: str = ''  # verification URL → QR code
    warning: bool = False
    balance_sticker: int = 0
    invoice_id: str = ''
    invoice_data: dict = field(default_factory=dict)
    error_message: str = ''
    raw_response: dict = field(default_factory=dict)


# ═══════════════════════════════════════════════════════════════
# FNE Service
# ═══════════════════════════════════════════════════════════════

class FNEService:
    """
    Côte d'Ivoire FNE e-invoicing certification service.

    Usage:
        config = FNEConfig(api_key='kAF01gEM40r1Uz5WLJn5lxAnGMwVjCME')
        service = FNEService(config)

        # Certify a sale invoice
        request = FNEInvoiceRequest(
            invoice_type='sale',
            payment_method='cash',
            template='B2B',
            client_ncc='9502363N',
            client_company_name='KPMG CÔTE D\\'IVOIRE',
            client_phone='0709080765',
            client_email='info@kpmg.ci',
            items=[
                FNELineItem(
                    description='Sac de riz',
                    quantity=30,
                    amount=20000,
                    taxes=['TVA'],
                )
            ]
        )
        response = service.sign_invoice(request)
        print(response.reference)  # "9606123E25000000019"
        print(response.token)      # QR code URL
    """

    def __init__(self, config: FNEConfig):
        self.config = config
        self.session = requests.Session()
        self.session.headers.update(config.headers)

    def sign_invoice(self, request: FNEInvoiceRequest) -> FNEInvoiceResponse:
        """
        Submit an invoice for FNE certification.

        Returns FNEInvoiceResponse with:
        - reference: the official FNE invoice number
        - token: verification URL to be encoded as QR code
        - invoice_data: full certified invoice details
        """
        payload = request.to_dict()

        logger.info(
            'FNE sign_invoice: type=%s template=%s items=%d',
            request.invoice_type, request.template, len(request.items)
        )

        try:
            resp = self.session.post(
                self.config.sign_url,
                json=payload,
                timeout=FNE_TIMEOUT,
            )

            if resp.status_code == 200:
                data = resp.json()
                invoice = data.get('invoice', {})
                return FNEInvoiceResponse(
                    success=True,
                    reference=data.get('reference', ''),
                    ncc=data.get('ncc', ''),
                    token=data.get('token', ''),
                    warning=data.get('warning', False),
                    balance_sticker=data.get('balance_sticker', 0),
                    invoice_id=invoice.get('id', ''),
                    invoice_data=invoice,
                    raw_response=data,
                )

            elif resp.status_code == 401:
                logger.error('FNE auth failed: API key invalid or expired')
                return FNEInvoiceResponse(
                    success=False,
                    error_message='Authentication failed. Check your FNE API key.',
                    raw_response={'status': 401},
                )

            elif resp.status_code == 400:
                error_data = resp.json() if resp.headers.get('content-type', '').startswith('application/json') else {}
                logger.error('FNE bad request: %s', error_data)
                return FNEInvoiceResponse(
                    success=False,
                    error_message=error_data.get('message', f'Bad request (400): {resp.text[:200]}'),
                    raw_response=error_data,
                )

            else:
                logger.error('FNE unexpected status: %d %s', resp.status_code, resp.text[:200])
                return FNEInvoiceResponse(
                    success=False,
                    error_message=f'Unexpected response: {resp.status_code}',
                    raw_response={'status': resp.status_code, 'body': resp.text[:500]},
                )

        except requests.exceptions.Timeout:
            logger.error('FNE timeout after %ds', FNE_TIMEOUT)
            return FNEInvoiceResponse(
                success=False,
                error_message=f'FNE server timeout after {FNE_TIMEOUT}s. Try again later.',
            )

        except requests.exceptions.ConnectionError as e:
            logger.error('FNE connection error: %s', str(e))
            return FNEInvoiceResponse(
                success=False,
                error_message='Cannot connect to FNE server. Check internet connection.',
            )

        except Exception as e:
            logger.exception('FNE unexpected error')
            return FNEInvoiceResponse(
                success=False,
                error_message=f'Unexpected error: {str(e)}',
            )

    def sign_sale(self, **kwargs) -> FNEInvoiceResponse:
        """Shortcut for sale invoice certification."""
        kwargs['invoice_type'] = 'sale'
        return self.sign_invoice(FNEInvoiceRequest(**kwargs))

    def sign_credit_note(self, parent_reference: str, **kwargs) -> FNEInvoiceResponse:
        """Shortcut for credit note (avoir) using the /sign endpoint with invoiceType=creditNote."""
        kwargs['invoice_type'] = 'creditNote'
        kwargs['parent_reference'] = parent_reference
        return self.sign_invoice(FNEInvoiceRequest(**kwargs))

    def sign_refund(self, original_fne_invoice_id: str, refund_items: list) -> FNEInvoiceResponse:
        """
        Certify a credit note (Avoir) via the FNE /refund endpoint.

        Per DGI spec API #2:
          POST /external/invoices/{id}/refund
          Body: { "items": [{ "id": "<fne_item_id>", "quantity": N }] }

        Args:
            original_fne_invoice_id: The FNE platform UUID of the original sale invoice
                                     (from invoice.id in the /sign response)
            refund_items: List of dicts with 'id' (FNE item UUID) and 'quantity' (qty to refund)

        Returns:
            FNEInvoiceResponse with the credit note reference and QR code token
        """
        if not original_fne_invoice_id:
            return FNEInvoiceResponse(
                success=False,
                error_message='Original FNE invoice ID is required for credit note certification.',
            )

        payload = {'items': refund_items}
        url = self.config.refund_url(original_fne_invoice_id)

        logger.info(
            'FNE sign_refund: original_invoice=%s items=%d',
            original_fne_invoice_id, len(refund_items)
        )

        try:
            resp = self.session.post(url, json=payload, timeout=FNE_TIMEOUT)

            if resp.status_code in (200, 201):
                data = resp.json()
                return FNEInvoiceResponse(
                    success=True,
                    reference=data.get('reference', ''),
                    ncc=data.get('ncc', ''),
                    token=data.get('token', ''),
                    warning=data.get('warning', False),
                    balance_sticker=data.get('balance_sticker', 0),
                    raw_response=data,
                )

            elif resp.status_code == 401:
                logger.error('FNE refund auth failed')
                return FNEInvoiceResponse(
                    success=False,
                    error_message='Authentication failed. Check your FNE API key.',
                    raw_response={'status': 401},
                )

            elif resp.status_code == 400:
                error_data = resp.json() if resp.headers.get('content-type', '').startswith('application/json') else {}
                logger.error('FNE refund bad request: %s', error_data)
                return FNEInvoiceResponse(
                    success=False,
                    error_message=error_data.get('message', f'Bad request (400): {resp.text[:200]}'),
                    raw_response=error_data,
                )

            else:
                logger.error('FNE refund unexpected: %d %s', resp.status_code, resp.text[:200])
                return FNEInvoiceResponse(
                    success=False,
                    error_message=f'Unexpected response: {resp.status_code}',
                    raw_response={'status': resp.status_code, 'body': resp.text[:500]},
                )

        except requests.exceptions.Timeout:
            return FNEInvoiceResponse(success=False, error_message=f'FNE timeout after {FNE_TIMEOUT}s.')
        except requests.exceptions.ConnectionError as e:
            return FNEInvoiceResponse(success=False, error_message='Cannot connect to FNE.')
        except Exception as e:
            logger.exception('FNE refund error')
            return FNEInvoiceResponse(success=False, error_message=f'Unexpected error: {str(e)}')

    def sign_purchase(self, **kwargs) -> FNEInvoiceResponse:
        """Shortcut for purchase bordereau certification."""
        kwargs['invoice_type'] = 'purchase'
        return self.sign_invoice(FNEInvoiceRequest(**kwargs))


# ═══════════════════════════════════════════════════════════════
# Helper: Build FNE request from TSFSYSTEM sale/purchase data
# ═══════════════════════════════════════════════════════════════

TAX_TYPE_MAP = {
    'TVA': 'TVA',       # 18% standard
    'TVAB': 'TVAB',     # 9% reduced
    'TVAC': 'TVAC',     # 0% exempt (convention)
    'TVAD': 'TVAD',     # 0% exempt (droit commun)
}

PAYMENT_METHOD_MAP = {
    'CASH': 'cash',
    'CHEQUE': 'cheque',
    'BANK_TRANSFER': 'transfer',
    'MOBILE_MONEY': 'mobile-money',
    'CREDIT_CARD': 'credit-card',
    'CREDIT': 'credit',
}


def build_fne_request_from_sale(sale_order, org_settings: dict = None) -> FNEInvoiceRequest:
    """
    Convert a TSFSYSTEM SaleOrder into an FNEInvoiceRequest.

    Args:
        sale_order: SaleOrder model instance with lines + contact
        org_settings: org e-invoice settings dict

    Returns:
        FNEInvoiceRequest ready for certification
    """
    settings = org_settings or {}

    # Determine template based on client type
    contact = getattr(sale_order, 'contact', None)
    template = 'B2C'
    if contact:
        if getattr(contact, 'is_government', False):
            template = 'B2G'
        elif getattr(contact, 'is_company', False):
            template = 'B2B'
        country = getattr(contact, 'country', '') or ''
        if country and country.upper() not in ('CI', 'CIV'):
            template = 'B2F'

    # Build line items
    items = []
    for line in sale_order.lines.all():
        taxes = []
        custom_taxes_list = []

        # Map TSFSYSTEM tax to FNE tax type
        for tax_line in getattr(line, 'tax_lines', []):
            tax_type = getattr(tax_line, 'tax_type', 'TVA')
            if tax_type in TAX_TYPE_MAP:
                if TAX_TYPE_MAP[tax_type] not in taxes:
                    taxes.append(TAX_TYPE_MAP[tax_type])
            else:
                # Custom tax (AIRSI, DTD, etc.)
                custom_taxes_list.append(FNECustomTax(
                    name=tax_type,
                    amount=float(getattr(tax_line, 'rate', 0) * 100),
                ))

        if not taxes:
            taxes = ['TVA']  # default

        items.append(FNELineItem(
            description=getattr(line, 'description', '') or getattr(line, 'product_name', ''),
            quantity=float(getattr(line, 'quantity', 1)),
            amount=float(getattr(line, 'unit_price_ht', 0)),
            taxes=taxes,
            reference=getattr(line, 'product_code', '') or '',
            discount=float(getattr(line, 'discount_pct', 0) or 0),
            measurement_unit=getattr(line, 'unit_name', '') or '',
            custom_taxes=custom_taxes_list,
        ))

    # Build request
    payment_method = PAYMENT_METHOD_MAP.get(
        getattr(sale_order, 'payment_method', 'CASH'),
        'cash'
    )

    request = FNEInvoiceRequest(
        invoice_type='sale',
        payment_method=payment_method,
        template=template,
        items=items,
        client_company_name=getattr(contact, 'company_name', '') or getattr(contact, 'name', '') if contact else '',
        client_phone=getattr(contact, 'phone', '') if contact else '',
        client_email=getattr(contact, 'email', '') if contact else '',
        client_ncc=getattr(contact, 'tax_id', '') if contact else '',
        point_of_sale=settings.get('point_of_sale', ''),
        establishment=settings.get('establishment', ''),
        commercial_message=settings.get('commercial_message', ''),
        footer=settings.get('footer', ''),
    )

    # Multi-currency
    if template == 'B2F':
        request.foreign_currency = getattr(sale_order, 'currency_code', '') or ''
        request.foreign_currency_rate = float(getattr(sale_order, 'exchange_rate', 0) or 0)

    return request


def get_fne_config(organization) -> Optional[FNEConfig]:
    """
    Load FNE config from organization's e-invoice settings.

    Reads from org.settings['einvoice'] or the EInvoiceStandard model.
    """
    settings = getattr(organization, 'settings', {}) or {}
    einvoice = settings.get('einvoice', {})

    api_key = einvoice.get('api_key') or einvoice.get('fne_api_key')
    if not api_key:
        return None

    base_url = einvoice.get('base_url') or einvoice.get('fne_url') or FNE_SANDBOX_URL

    return FNEConfig(
        api_key=api_key,
        base_url=base_url,
        is_production='fne.dgi.gouv.ci' in base_url or einvoice.get('is_production', False),
        ncc=einvoice.get('ncc', ''),
        establishment=einvoice.get('establishment', ''),
        point_of_sale=einvoice.get('point_of_sale', ''),
        commercial_message=einvoice.get('commercial_message', ''),
        footer=einvoice.get('footer', ''),
    )
