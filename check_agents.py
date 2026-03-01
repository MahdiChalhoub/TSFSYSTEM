import os
import django
import sys
from erp.models import Organization
from apps.mcp.models import MCPAgent

def list_agents():
    # Setup Django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'erp_backend.settings')
    sys.path.append('erp_backend')
    django.setup()
    
    print("Listing all MCPAgents:")
    for agent in MCPAgent.objects.all():
        print(f"- ID: {agent.id}, NAME: {agent.name}, ROLE: {agent.role}, STATUS: {agent.status}")

if __name__ == "__main__":
    list_agents()
