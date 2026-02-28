
import os
import django
import time
from datetime import timedelta
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.mcp.models import MCPAgent
from apps.mcp.agents import run_agent_sync

def main_loop():
    print("🚀 Virtual Employee Heartbeat Started...")
    while True:
        try:
            # Find active agents that are due for a run
            now = timezone.now()
            agents_to_run = list(MCPAgent.objects.filter(
                is_active=True,
                status='idle'
            ))
            
            for agent in agents_to_run:
                # Check if it's time to run based on frequency
                should_run = False
                if not agent.last_run_at:
                    should_run = True
                else:
                    due_at = agent.last_run_at + timedelta(minutes=agent.frequency_minutes)
                    if now >= due_at:
                        should_run = True
                
                if should_run:
                    print(f"🔔 [PULSE] Waking up agent: {agent.name}...")
                    run_agent_sync(agent.id)
            
            time.sleep(10) # Check every 10 seconds
            
        except Exception as e:
            import traceback
            print(f"❌ Heartbeat Error: {e}")
            traceback.print_exc()
            time.sleep(30)

if __name__ == "__main__":
    main_loop()
