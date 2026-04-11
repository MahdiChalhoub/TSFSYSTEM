"""
IAM Services — Transfer

Handles persona transitions: Contact → Employee, Employee → Contact.
Transfers are ADDITIVE — they create the new relationship without destroying the old one.

IMPORTANT: These services PRE-FILL suggested values. The actual record creation
should be confirmed by admin, not blindly auto-finalized.
"""
from django.db import transaction

from apps.iam.services import audit


def promote_to_employee(user, organization, job_title='', salary=0,
                        employee_type='EMPLOYEE', created_by=None):
    """
    Create an Employee record from an existing User.
    Pre-fills from user data. Both records coexist (additive, not destructive).

    Returns: Employee instance
    """
    from apps.hr.models import Employee
    import uuid

    with transaction.atomic():
        employee, created = Employee.objects.get_or_create(
            user=user,
            organization=organization,
            defaults={
                'employee_id': f"EMP-{uuid.uuid4().hex[:8].upper()}",
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email,
                'phone': getattr(user, 'whatsapp_number', '') or '',
                'job_title': job_title,
                'employee_type': employee_type,
                'salary': salary,
            }
        )

        if created:
            audit.emit(audit.CONTACT_PROMOTED_TO_EMPLOYEE, user=user,
                       actor=created_by, organization=organization,
                       detail=f'Employee {employee.employee_id} created from user',
                       employee_id=employee.employee_id)

    return employee


def create_contact_from_employee(employee, contact_type='CUSTOMER',
                                 created_by=None):
    """
    Create a CRM Contact from an existing Employee and auto-link.
    Both records coexist (additive).

    Returns: (contact, portal_access or None)
    """
    from apps.crm.models import Contact
    from apps.iam.services.linking import link_user_to_contact

    with transaction.atomic():
        display_name = f"{employee.first_name or ''} {employee.last_name or ''}".strip()
        display_name = display_name or employee.employee_id

        contact = Contact.objects.create(
            organization=employee.organization,
            name=display_name,
            email=employee.email or '',
            phone=employee.phone or '',
            type=contact_type,
            status='ACTIVE',
        )

        access = None
        if employee.user:
            portal_type = 'SUPPLIER' if contact_type in ('SUPPLIER',) else 'CLIENT'
            access = link_user_to_contact(
                user=employee.user,
                contact=contact,
                portal_type=portal_type,
                granted_by=created_by,
            )
            audit.emit(audit.EMPLOYEE_LINKED_TO_CONTACT, user=employee.user,
                       actor=created_by, organization=employee.organization,
                       detail=f'Contact #{contact.id} created from employee {employee.employee_id}',
                       employee_id=employee.employee_id, contact_id=contact.id)

    return contact, access


def create_contact_from_user(user, contact_type='CUSTOMER', created_by=None):
    """
    Create a CRM Contact from a User and auto-link.

    Returns: (contact, portal_access)
    """
    from apps.crm.models import Contact
    from apps.iam.services.linking import link_user_to_contact

    with transaction.atomic():
        display_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
        display_name = display_name or user.email or user.username

        contact = Contact.objects.create(
            organization=user.organization,
            name=display_name,
            email=user.email or '',
            phone=getattr(user, 'whatsapp_number', '') or '',
            type=contact_type,
            status='ACTIVE',
        )

        portal_type = 'SUPPLIER' if contact_type in ('SUPPLIER',) else 'CLIENT'
        access = link_user_to_contact(
            user=user,
            contact=contact,
            portal_type=portal_type,
            granted_by=created_by,
        )

        audit.emit(audit.USER_LINKED_TO_CONTACT, user=user,
                   actor=created_by, organization=user.organization,
                   detail=f'Contact #{contact.id} ({contact_type}) created from user',
                   contact_id=contact.id, access_id=access.id)

    return contact, access
