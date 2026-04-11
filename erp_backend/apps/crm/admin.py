from django.contrib import admin
from apps.crm.models import (
    Contact, ContactTag, ContactPerson, ContactComplianceDocument, 
    ContactTask, ComplianceRule, ComplianceEvent, ComplianceOverride
)

@admin.register(ComplianceRule)
class ComplianceRuleAdmin(admin.ModelAdmin):
    list_display = ('name', 'country_code', 'document_type', 'is_mandatory', 'block_level', 'is_active', 'version')
    list_filter = ('country_code', 'block_level', 'is_active')
    search_fields = ('name', 'document_type')

@admin.register(ComplianceEvent)
class ComplianceEventAdmin(admin.ModelAdmin):
    list_display = ('contact', 'event_type', 'risk_level', 'created_at')
    list_filter = ('event_type', 'risk_level')
    readonly_fields = ('created_at',)

@admin.register(ComplianceOverride)
class ComplianceOverrideAdmin(admin.ModelAdmin):
    list_display = ('contact', 'rule', 'granted_by', 'expiry_date', 'is_active')
    list_filter = ('is_active',)

@admin.register(ContactComplianceDocument)
class ContactComplianceDocumentAdmin(admin.ModelAdmin):
    list_display = ('contact', 'type', 'document_number', 'expiry_date', 'review_status', 'is_active', 'version')
    list_filter = ('review_status', 'is_active')
    readonly_fields = ('file_hash', 'is_immutable')
