"""
IAM Module — Initial Migration (v2 — refined)

Creates:
- iam_contact_portal_access table (bridge: User ↔ Contact with portal grants)
- iam_portal_approval_request table (approval lifecycle before access creation)

With proper constraints and composite indexes.
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('erp', '0023_user_iam_fields'),
        ('crm', '0001_initial'),
    ]

    operations = [
        # ── ContactPortalAccess ──────────────────────────────────────
        migrations.CreateModel(
            name='ContactPortalAccess',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('portal_type', models.CharField(
                    choices=[('CLIENT', 'Client Portal'), ('SUPPLIER', 'Supplier Portal')],
                    max_length=20,
                )),
                ('status', models.CharField(
                    choices=[('ACTIVE', 'Active'), ('BLOCKED', 'Blocked'), ('REVOKED', 'Revoked')],
                    default='ACTIVE',
                    max_length=20,
                )),
                ('relationship_role', models.CharField(
                    choices=[
                        ('OWNER', 'Business Owner'), ('REPRESENTATIVE', 'Representative'),
                        ('ACCOUNTING', 'Accounting Contact'), ('LOGISTICS', 'Logistics Contact'),
                        ('PURCHASER', 'Purchaser'), ('SELF', 'Self (Individual)'),
                    ],
                    default='SELF', max_length=20,
                )),
                ('is_primary', models.BooleanField(default=True)),
                ('created_via', models.CharField(
                    choices=[
                        ('AUTO_LINK', 'Auto-linked on registration'),
                        ('ADMIN_CREATE', 'Created by admin'),
                        ('SELF_REGISTER', 'Self-registration'),
                        ('APPROVAL', 'Created after approval'),
                        ('TRANSFER', 'Persona transfer'),
                    ],
                    default='ADMIN_CREATE', max_length=20,
                )),
                ('can_access_portal', models.BooleanField(default=True)),
                ('can_access_ecommerce', models.BooleanField(default=True)),
                ('visibility_scope', models.JSONField(blank=True, default=dict)),
                ('granted_at', models.DateTimeField(blank=True, null=True)),
                ('revoked_at', models.DateTimeField(blank=True, null=True)),
                ('revoke_reason', models.TextField(blank=True, null=True)),
                ('last_portal_login', models.DateTimeField(blank=True, null=True)),
                ('notes', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE, to='erp.organization',
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='portal_access_records', to=settings.AUTH_USER_MODEL,
                )),
                ('contact', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='portal_access_records', to='crm.contact',
                )),
                ('granted_by', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='portal_access_granted', to=settings.AUTH_USER_MODEL,
                )),
                ('revoked_by', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='portal_access_revoked', to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'iam_contact_portal_access',
                'ordering': ['-created_at'],
            },
        ),

        # ── PortalApprovalRequest ────────────────────────────────────
        migrations.CreateModel(
            name='PortalApprovalRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('request_type', models.CharField(
                    choices=[
                        ('CLIENT_REGISTRATION', 'Client Portal Registration'),
                        ('SUPPLIER_REGISTRATION', 'Supplier Portal Registration'),
                        ('PORTAL_LINK_CHANGE', 'Portal Link Change'),
                        ('ACCESS_REACTIVATION', 'Access Reactivation Request'),
                    ],
                    max_length=30,
                )),
                ('status', models.CharField(
                    choices=[
                        ('PENDING', 'Pending Review'), ('APPROVED', 'Approved'),
                        ('REJECTED', 'Rejected'), ('NEEDS_CORRECTION', 'Needs Correction'),
                        ('CANCELLED', 'Cancelled'),
                    ],
                    default='PENDING', max_length=20,
                )),
                ('submitted_data', models.JSONField(blank=True, default=dict)),
                ('review_notes', models.TextField(blank=True, null=True)),
                ('correction_notes', models.TextField(blank=True, null=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE, to='erp.organization',
                )),
                ('target_user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='portal_approval_requests', to=settings.AUTH_USER_MODEL,
                )),
                ('target_contact', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='portal_approval_requests', to='crm.contact',
                )),
                ('resulting_access', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='approval_request', to='iam.contactportalaccess',
                )),
                ('reviewed_by', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='portal_approvals_reviewed', to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'iam_portal_approval_request',
                'ordering': ['-created_at'],
            },
        ),

        # ── Constraints ─────────────────────────────────────────────
        migrations.AddConstraint(
            model_name='contactportalaccess',
            constraint=models.UniqueConstraint(
                fields=['organization', 'user', 'contact', 'portal_type'],
                name='unique_portal_access_per_org_user_contact_type',
            ),
        ),

        # ── Indexes ──────────────────────────────────────────────────
        migrations.AddIndex(
            model_name='contactportalaccess',
            index=models.Index(
                fields=['organization', 'user', 'portal_type', 'status'],
                name='idx_portal_user_type_status',
            ),
        ),
        migrations.AddIndex(
            model_name='contactportalaccess',
            index=models.Index(
                fields=['organization', 'contact', 'portal_type', 'status'],
                name='idx_portal_contact_type_status',
            ),
        ),
        migrations.AddIndex(
            model_name='contactportalaccess',
            index=models.Index(
                fields=['organization', 'portal_type', 'status'],
                name='idx_portal_org_type_status',
            ),
        ),
        migrations.AddIndex(
            model_name='contactportalaccess',
            index=models.Index(
                fields=['organization', 'is_primary'],
                name='idx_portal_org_primary',
            ),
        ),
        migrations.AddIndex(
            model_name='portalapprovalrequest',
            index=models.Index(
                fields=['organization', 'status', 'request_type'],
                name='idx_approval_org_status_type',
            ),
        ),
        migrations.AddIndex(
            model_name='portalapprovalrequest',
            index=models.Index(
                fields=['organization', 'target_user'],
                name='idx_approval_org_user',
            ),
        ),
    ]
