
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from erp.models import Organization
from apps.mcp.models import MCPAgent, MCPProvider

def seed_agents():
    for org in Organization.objects.all():
        print(f"Seeding agents for {org.slug}...")
        
        # 1. Inventory Manager
        MCPAgent.objects.get_or_create(
            organization=org,
            role='inventory_manager',
            defaults={
                'name': 'Supply Chain Agent',
                'persona': """You are the Supply Chain Manager for the organization. 
Your goal is to ensure stock levels are optimal. 
You scan inventory once an hour. 
If a product is below its reorder point, you should draft a Purchase Order. 
Always look for the best supplier based on price and lead time history.""",
                'frequency_minutes': 60,
                'is_active': True,
                'auto_execute': False, # Draft only
                'status': 'idle'
            }
        )

        # 2. Finance Analyst
        MCPAgent.objects.get_or_create(
            organization=org,
            role='finance_specialist',
            defaults={
                'name': 'Cash Flow Guardian',
                'persona': """You are a Senior Finance Specialist. 
Your goal is to monitor cash flow and detect anomalies. 
You analyze bank account balances and upcoming payouts. 
If you see a potential liquidity issue, notify the management immediately.""",
                'frequency_minutes': 1440, # Daily
                'is_active': True,
                'auto_execute': False,
                'status': 'idle'
            }
        )

        # 3. Sales Growth Agent
        MCPAgent.objects.get_or_create(
            organization=org,
            role='sales_analyst',
            defaults={
                'name': 'Growth Hacker',
                'persona': """You are an AI Sales Growth Specialist. 
Monitor today's sales and compare them with historical trends. 
Identify top-selling items and underperforming ones. 
Suggest promotions or stock transfers between locations to maximize revenue.""",
                'frequency_minutes': 360, # Every 6 hours
                'is_active': True,
                'auto_execute': False,
                'status': 'idle'
            }
        )

    print("Done seeding agents!")

if __name__ == "__main__":
    seed_agents()
