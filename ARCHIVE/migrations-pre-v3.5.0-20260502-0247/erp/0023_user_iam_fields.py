"""
Add account_status and registration_channel to User model for IAM.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('erp', '0022_decision_engine_models'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='account_status',
            field=models.CharField(
                choices=[
                    ('PENDING', 'Pending'),
                    ('ACTIVE', 'Active'),
                    ('BLOCKED', 'Blocked'),
                    ('REJECTED', 'Rejected'),
                    ('SUSPENDED', 'Suspended'),
                ],
                default='ACTIVE',
                help_text='IAM identity lifecycle status',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='registration_channel',
            field=models.CharField(
                choices=[
                    ('ERP_ADMIN', 'Created by Admin'),
                    ('CLIENT_PORTAL', 'Client Portal Signup'),
                    ('ECOMMERCE', 'eCommerce Signup'),
                    ('SUPPLIER_PORTAL', 'Supplier Portal Signup'),
                    ('SELF_REGISTER', 'Self Registration'),
                ],
                default='ERP_ADMIN',
                help_text='How this user account was created',
                max_length=20,
            ),
        ),
    ]
