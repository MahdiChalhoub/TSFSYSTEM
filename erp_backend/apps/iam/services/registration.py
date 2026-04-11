"""
IAM Services — Registration

Client registration: auto-approve, strong auto-link, create access immediately.
Supplier registration: create pending ApprovalRequest, admin reviews and links later.

IMPORTANT: Supplier flow does NOT create ContactPortalAccess directly.
It creates a PortalApprovalRequest. Access is only created after admin approval.
"""
from django.utils import timezone
from django.db import transaction

from apps.iam.services import audit


def register_client(organization, email, password, first_name='', last_name='',
                    phone=''):
    """
    Client Portal / eCommerce signup → auto-approved.

    Flow:
    1. Create User (ACTIVE)
    2. Strong-match existing Contact(CUSTOMER) by email
    3. If strong match: auto-link via ContactPortalAccess
    4. If no match: auto-create minimal Contact(CUSTOMER)
    5. Emit audit events

    Returns: (user, contact, portal_access)
    """
    from erp.models import User
    from apps.crm.models import Contact
    from apps.iam.models import ContactPortalAccess
    from apps.iam.services.linking import strong_match_contact

    with transaction.atomic():
        # 1. Create User
        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            organization=organization,
            account_status='ACTIVE',
            registration_channel='CLIENT_PORTAL',
        )
        audit.emit(audit.USER_REGISTERED, user=user, organization=organization,
                   detail=f'Client registration via portal: {email}',
                   channel='CLIENT_PORTAL')

        # 2. Strong-match contact
        contact = strong_match_contact(
            organization=organization,
            email=email,
            contact_types=['CUSTOMER', 'BOTH'],
        )

        # 3. If found → auto-link
        if contact:
            created_via = 'AUTO_LINK'
            audit.emit(audit.CONTACT_AUTO_LINKED, user=user, organization=organization,
                       detail=f'Auto-linked to existing contact #{contact.id} ({contact.name})',
                       contact_id=contact.id)
        else:
            # 4. No match → create minimal Contact
            display_name = f"{first_name} {last_name}".strip() or email
            contact = Contact.objects.create(
                organization=organization,
                name=display_name,
                email=email,
                phone=phone or '',
                type='CUSTOMER',
                status='ACTIVE',
            )
            created_via = 'SELF_REGISTER'
            audit.emit(audit.CONTACT_AUTO_CREATED, user=user, organization=organization,
                       detail=f'Auto-created customer contact #{contact.id}',
                       contact_id=contact.id)

        # 5. Create portal access (immediately active)
        access = ContactPortalAccess.objects.create(
            organization=organization,
            user=user,
            contact=contact,
            portal_type='CLIENT',
            status='ACTIVE',
            relationship_role='SELF',
            is_primary=True,
            created_via=created_via,
            can_access_portal=True,
            can_access_ecommerce=True,
            granted_by=None,  # self-registration
            granted_at=timezone.now(),
        )
        audit.emit(audit.CLIENT_ACCESS_CREATED, user=user, organization=organization,
                   detail=f'Client portal access granted',
                   access_id=access.id, contact_id=contact.id)

    return user, contact, access


def register_supplier(organization, email, password, first_name='', last_name='',
                      company_name='', phone='', submitted_data=None):
    """
    Supplier Portal signup → creates PENDING ApprovalRequest.

    DOES NOT create ContactPortalAccess. Admin must:
    1. Review the request
    2. Link to existing supplier contact (or create one)
    3. Approve → which creates the access record

    Returns: (user, approval_request)
    """
    from erp.models import User
    from apps.iam.models import PortalApprovalRequest

    with transaction.atomic():
        # 1. Create User (pending)
        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            organization=organization,
            account_status='PENDING',
            registration_channel='SUPPLIER_PORTAL',
        )
        audit.emit(audit.USER_REGISTERED, user=user, organization=organization,
                   detail=f'Supplier registration via portal: {email}',
                   channel='SUPPLIER_PORTAL')

        # 2. Create approval request (NOT a ContactPortalAccess)
        payload = submitted_data or {}
        payload.update({
            'company_name': company_name,
            'email': email,
            'phone': phone,
            'first_name': first_name,
            'last_name': last_name,
        })

        request = PortalApprovalRequest.objects.create(
            organization=organization,
            request_type='SUPPLIER_REGISTRATION',
            status='PENDING',
            target_user=user,
            target_contact=None,  # Admin will link during approval
            submitted_data=payload,
        )
        audit.emit(audit.APPROVAL_SUBMITTED, user=user, organization=organization,
                   detail=f'Supplier approval request #{request.id} created',
                   request_id=request.id, company_name=company_name)

    return user, request
