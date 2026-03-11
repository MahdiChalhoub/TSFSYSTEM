from django.utils import timezone
from decimal import Decimal
from django.db import transaction
from django.db.models import Q
from apps.crm.models.compliance_models import ComplianceRule, ComplianceEvent, ComplianceOverride
from apps.crm.models.contact_models import ContactComplianceDocument, ContactTask

class ComplianceResolver:
    """
    11/10 Engine Layer: Resolves applicable policies for a contact. (§Missing 16, 15)
    Handles Organization-level, Branch-level, and Country-level rule merging.
    """
    @staticmethod
    def resolve_rules(contact, branch_id=None):
        """
        Policy resolution logic with specificity priority:
        1. Branch-specific rules
        2. Organization-wide rules
        3. Country-specific defaults
        """
        # Base filter: Active rules for this org
        qs = ComplianceRule.objects.filter(
            tenant_id=contact.organization_id,
            is_active=True,
            country_code=contact.country_code or 'CI'
        )
        
        # Branch-specific vs Org-wide
        if branch_id:
            # Get rules that are either global (branch_id is null) or specific to this branch
            qs = qs.filter(Q(branch_id__isnull=True) | Q(branch_id=branch_id))
        else:
            qs = qs.filter(branch_id__isnull=True)
            
        # Filter by contact traits
        applicable_rules = []
        for rule in qs:
            if rule.entity_type != 'BOTH' and rule.entity_type != contact.entity_type: continue
            if rule.contact_type != 'BOTH' and rule.contact_type != contact.type:
                # Handle BOTH contact type (Customer & Supplier)
                if not (contact.type == 'BOTH' and rule.contact_type in ['CUSTOMER', 'SUPPLIER']):
                    continue
            applicable_rules.append(rule)
            
        return applicable_rules

class ComplianceService:
    @staticmethod
    def recompute_compliance(contact, branch_id=None):
        """
        11/10 Enterprise-grade compliance recomputation.
        Updates cache, score, and risk level based on rules, documents, and overrides.
        """
        # 1. Resolve Rules (Policy Resolver Layer)
        applicable_rules = ComplianceResolver.resolve_rules(contact, branch_id)

        # 2. Fetch active and approved documents
        active_docs = contact.compliance_documents.filter(is_active=True)
        doc_map = {d.type: d for d in active_docs}
        
        # 3. Fetch active overrides
        overrides = ComplianceOverride.objects.filter(
            contact=contact,
            is_active=True,
            expiry_date__gt=timezone.now()
        ).values_list('rule_id', flat=True)
        
        status = 'COMPLIANT'
        risk_level = 'LOW'
        score = Decimal('100.00')
        next_expiry = None
        missing_mandatory = []
        expired_docs = []
        warning_docs = []
        unverified_docs = []
        pending_review = []
        
        for rule in applicable_rules:
            # Skip if overridden
            if rule.id in overrides: continue

            doc = doc_map.get(rule.document_type)
            
            if not doc:
                if rule.is_mandatory:
                    missing_mandatory.append(rule.name)
                    score -= Decimal('20.00')
                continue
            
            # Check review status
            if doc.review_status in ['UPLOADED', 'UNDER_REVIEW']:
                pending_review.append(rule.name)
                score -= Decimal('5.00')
            elif doc.review_status == 'REJECTED':
                missing_mandatory.append(f"{rule.name} (Rejected)")
                score -= Decimal('20.00')
            
            # Check expiry with grace period
            if doc.expiry_date:
                effective_expiry = doc.expiry_date
                blocking_expiry = doc.expiry_date + timezone.timedelta(days=rule.grace_period_days)
                
                if not next_expiry or doc.expiry_date < next_expiry:
                    next_expiry = doc.expiry_date
                
                today = timezone.now().date()
                if today > blocking_expiry:
                    expired_docs.append(rule.name)
                    score -= Decimal('30.00')
                elif today > effective_expiry:
                    warning_docs.append(f"{rule.name} (In Grace Period)")
                    score -= Decimal('10.00')
                elif (doc.expiry_date - today).days <= rule.renewal_days_before:
                    warning_docs.append(rule.name)
                    score -= Decimal('5.00')

        # Finalize status
        if expired_docs:
            status = 'EXPIRED_DOC'
            risk_level = 'CRITICAL'
        elif missing_mandatory:
            status = 'MISSING_DOC'
            risk_level = 'HIGH'
        elif pending_review:
            status = 'UNVERIFIED'
            risk_level = 'MEDIUM'
        elif warning_docs:
            status = 'EXPIRING_SOON'
            risk_level = 'MEDIUM'
        
        if score < 0: score = Decimal('0.00')

        # Update Contact Cache
        contact.compliance_status = status
        contact.compliance_score = score
        contact.compliance_risk_level = risk_level
        contact.compliance_next_expiry = next_expiry
        contact.compliance_last_checked = timezone.now()
        
        contact.save(update_fields=[
            'compliance_status', 'compliance_score', 'compliance_risk_level', 
            'compliance_next_expiry', 'compliance_last_checked'
        ])
        
        return {
            'status': status,
            'score': score,
            'risk': risk_level,
            'missing': missing_mandatory,
            'expired': expired_docs,
            'warnings': warning_docs,
            'pending': pending_review
        }

    @staticmethod
    def transaction_guard(contact, action_type, branch_id=None):
        """
        Compliance Guard (§Missing 16).
        Checks if the contact is allowed to perform action_type.
        """
        if contact.status == 'BLOCKED':
            return False, "Contact is manually blocked via lifecycle status."

        # Policy Resolution
        rules = ComplianceResolver.resolve_rules(contact, branch_id)
        
        active_docs = contact.compliance_documents.filter(is_active=True)
        doc_map = {d.type: d for d in active_docs}
        
        # Check overrides
        overrides = ComplianceOverride.objects.filter(
            contact=contact,
            is_active=True,
            expiry_date__gt=timezone.now()
        ).values_list('rule_id', flat=True)
        
        for rule in rules:
            if rule.id in overrides: continue
            
            doc = doc_map.get(rule.document_type)
            is_missing = doc is None or doc.review_status == 'REJECTED'
            
            today = timezone.now().date()
            is_expired = False
            if doc and doc.expiry_date:
                blocking_expiry = doc.expiry_date + timezone.timedelta(days=rule.grace_period_days)
                if today > blocking_expiry:
                    is_expired = True
            
            if is_missing or is_expired:
                # Severity-based blocking
                should_block = False
                if rule.block_level == 'STRICT': should_block = True
                elif rule.block_level == 'BLOCK_CONFIRMATION' and action_type in ['CONFIRM_ORDER', 'GENERATE_INVOICE', 'PROCESS_PAYMENT', 'PURCHASE_ORDER']: should_block = True
                elif rule.block_level == 'BLOCK_INVOICE' and action_type in ['GENERATE_INVOICE', 'SUPPLIER_INVOICE']: should_block = True
                elif rule.block_level == 'BLOCK_PAYMENT' and action_type in ['PROCESS_PAYMENT', 'SUPPLIER_PAYMENT']: should_block = True
                
                if should_block:
                    reason = f"Compliance Block ({action_type}): Document '{rule.name}' is {'MISSING' if is_missing else 'EXPIRED'}."
                    # Log Event
                    ComplianceEvent.objects.create(
                        tenant_id=contact.organization_id,
                        contact=contact,
                        event_type='VIOLATION_BLOCK',
                        risk_level='HIGH',
                        details={'action': action_type, 'rule': rule.name, 'reason': 'MISSING' if is_missing else 'EXPIRED'}
                    )
                    return False, reason
                    
        return True, ""

    @staticmethod
    def register_document(contact, doc_type, doc_number, file_id=None, expiry_date=None, user=None):
        """
        Registers a document with versioning and immutability. (§Missing 17)
        """
        from apps.storage.models.storage_models import StoredFile
        
        with transaction.atomic():
            # 1. Supersede older versions
            old_versions = contact.compliance_documents.filter(type=doc_type, is_active=True)
            version = 1
            if old_versions.exists():
                latest_old = old_versions.order_by('-version').first()
                version = (latest_old.version or 1) + 1
                # Mark old ones as superseded and LOCK them
                old_versions.update(is_active=False, review_status='SUPERSEDED', is_immutable=True)
            
            # Fetch file hash if available
            file_hash = None
            if file_id:
                file_record = StoredFile.objects.filter(uuid=file_id).first()
                if file_record:
                    file_hash = file_record.checksum

            # 2. Create new version
            new_doc = ContactComplianceDocument.objects.create(
                tenant_id=contact.organization_id,
                contact=contact,
                type=doc_type,
                document_number=doc_number,
                attachment_id=file_id,
                file_hash=file_hash,
                expiry_date=expiry_date,
                version=version,
                is_active=True,
                review_status='UPLOADED'
            )
            
            # 3. Log Event
            ComplianceEvent.objects.create(
                tenant_id=contact.organization_id,
                contact=contact,
                event_type='DOC_UPLOADED',
                document=new_doc,
                actor=user,
                risk_level='LOW',
                details={'doc_type': doc_type, 'version': version, 'doc_number': doc_number}
            )
            
            ComplianceService.recompute_compliance(contact)
            return new_doc

    @staticmethod
    def approve_document(doc, user):
        """
        Approves a document version and LOCKS it for integrity. (§Missing 17)
        """
        with transaction.atomic():
            doc.review_status = 'APPROVED'
            doc.is_verified = True
            doc.verified_at = timezone.now()
            doc.verified_by = user.id
            doc.is_immutable = True # Verified docs are legally locked
            doc.save()
            
            ComplianceEvent.objects.create(
                tenant_id=doc.organization_id,
                contact=doc.contact,
                event_type='STATUS_CHANGE',
                document=doc,
                actor=user,
                details={'new_status': 'APPROVED'}
            )
            
            ComplianceService.recompute_compliance(doc.contact)

    @staticmethod
    def grant_override(contact, rule, user, expiry_date, reason):
        """Manual bypass."""
        override = ComplianceOverride.objects.create(
            tenant_id=contact.organization_id,
            contact=contact,
            rule=rule,
            granted_by=user,
            reason=reason,
            expiry_date=expiry_date
        )
        ComplianceEvent.objects.create(
            tenant_id=contact.organization_id,
            contact=contact,
            event_type='MANUAL_OVERRIDE',
            actor=user,
            risk_level='MEDIUM',
            details={'rule': rule.name if rule else 'GLOBAL', 'reason': reason}
        )
        ComplianceService.recompute_compliance(contact)
        return override

    @staticmethod
    def process_escalations(contact):
        """
        Escalation Engine logic (§Missing 18).
        Called during batch scans to trigger alerts based on rule-specific chains.
        """
        rules = ComplianceResolver.resolve_rules(contact)
        active_docs = contact.compliance_documents.filter(is_active=True).values_list('type', 'expiry_date')
        doc_map = {t: e for t, e in active_docs}
        
        today = timezone.now().date()
        
        for rule in rules:
            expiry = doc_map.get(rule.document_type)
            if not expiry or expiry < today:
                # Document is missing or expired
                days_overdue = (today - expiry).days if expiry else 999
                
                # Check escalation chain
                chain = rule.escalation_chain or []
                for step in sorted(chain, key=lambda x: x.get('days', 0), reverse=True):
                    if days_overdue >= step.get('days', 0):
                        # Trigger escalation
                        ComplianceService._trigger_escalation(contact, rule, step)
                        break

    @staticmethod
    def _trigger_escalation(contact, rule, step):
        """Internal alert trigger."""
        notify_role = step.get('notify', 'OWNER')
        # Logic to notify via Task/Notification
        ContactTask.objects.get_or_create(
            tenant_id=contact.organization_id,
            contact=contact,
            type='COMPLIANCE_RENEWAL',
            status='OPEN',
            title=f"ESCALATION [{notify_role}]: {rule.name} overdue",
            defaults={
                'description': f"Compliance for {contact.name} is failing rule '{rule.name}'. Escalation to {notify_role}.",
                'priority': 'CRITICAL' if notify_role != 'OWNER' else 'HIGH'
            }
        )
