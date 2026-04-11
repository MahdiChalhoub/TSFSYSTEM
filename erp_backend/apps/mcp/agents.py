
import logging
import asyncio
from typing import Dict, List, Optional, Any
from django.utils import timezone
from asgiref.sync import sync_to_async
from .models import MCPAgent, MCPAgentLog, MCPProvider
from .services import MCPService

logger = logging.getLogger(__name__)

class AgentBrain:
    """
    The 'Brain' that powers an MCPAgent.
    Handles thinking, tool selection, and execution.
    """
    
    def __init__(self, agent_id: int):
        self.agent_id = agent_id
        self.agent = None
        self.service = None
        self.logs = []

    async def _log(self, level: str, message: str, data: Dict = None):
        """Internal logging to DB."""
        if not self.agent:
            return
            
        def create_log():
            return MCPAgentLog.objects.create(
                agent=self.agent,
                organization=self.agent.organization,
                level=level,
                message=message,
                data=data or {}
            )
        
        log_entry = await sync_to_async(create_log)()
        self.logs.append(log_entry)
        print(f"[{self.agent.name}] {level.upper()}: {message}")

    async def run(self):
        """Execute one cycle of agent thinking/acting."""
        # Load agent and service in a thread-safe way
        self.agent = await sync_to_async(MCPAgent.objects.get)(id=self.agent_id)
        self.service = MCPService(self.agent.organization_id)

        if self.agent.status == 'running' and (timezone.now() - self.agent.updated_at).seconds < 300:
            logger.warning(f"Agent {self.agent.name} is already running. Skipping.")
            return

        self.agent.status = 'running'
        await sync_to_async(self.agent.save)()
        
        await self._log('info', f"Agent heartbeat triggered. Starting execution cycle...")
        
        try:
            # 1. Gather Context
            tools = await sync_to_async(self.service.get_tools)()
            await self._log('info', f"Detected {len(tools)} available business tools.")
            
            # 2. Build the Thought Prompt
            system_prompt = await sync_to_async(self._get_system_prompt)()
            messages = [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': "Analyze current business state and take necessary actions based on your role."}
            ]
            
            # 3. Request LLM Decision
            await self._log('thought', "Analyzing current business data and deciding on priorities...")
            
            # The chat method is already async, but it calls get_provider/get_tools which are sync
            # Let's check MCPService.chat again. It is 'async def chat'.
            # Inside it: provider = self.get_provider(provider_id) -> synd
            # So we should probably fix MCPService.chat to be safe or wrap the whole thing if it were sync.
            # Since it's already async, the internal sync calls are the problem.
            
            result = await self.service.chat(
                messages=messages,
                provider_id=self.agent.provider_id,
                tools=tools
            )
            
            if not result.get('success'):
                raise Exception(result.get('error', 'Unknown AI error'))
            
            response = result['response']
            
            # 4. Process Tool Calls
            tool_calls = response.get('tool_calls', [])
            if tool_calls:
                await self._log('info', f"AI decided to execute {len(tool_calls)} tools.")
                
                for tc in tool_calls:
                    func_name = tc.get('function', {}).get('name')
                    args = tc.get('function', {}).get('arguments', {})
                    
                    await self._log('action', f"Executing tool: {func_name}", data=args)
                    
                    # execute_tool is sync
                    tool_result = await sync_to_async(self.service.execute_tool)(
                        tool_name=func_name,
                        arguments=args
                    )
                    
                    if tool_result.get('success'):
                        await self._log('info', f"Tool {func_name} executed successfully.")
                    else:
                        await self._log('error', f"Tool {func_name} failed: {tool_result.get('error')}")
            
            # 5. Final Decision
            content = response.get('content', '')
            if content:
                await self._log('decision', content)
            
            self.agent.status = 'idle'
            self.agent.last_run_at = timezone.now()
            await sync_to_async(self.agent.save)()
            
            await self._log('info', "Execution cycle completed successfully.")
            
        except Exception as e:
            self.agent.status = 'error'
            await sync_to_async(self.agent.save)()
            await self._log('error', f"Critical failure: {str(e)}")
            logger.exception("Agent run failed")

    def _get_system_prompt(self) -> str:
        """Combine persona with constraints."""
        return f"""{self.agent.persona}

CURRENT DATE: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}
ORGANIZATION: {self.agent.organization.name}

CONSTRAINTS:
1. Only perform actions that fall within your ROLE.
2. If you are not in 'AUTO-EXECUTE' mode, only draft or suggest actions via decision logs.
3. CONCISE communication only.
4. Auto-execute is currently {'ENABLED' if self.agent.auto_execute else 'DISABLED'}.
"""

def run_agent_sync(agent_id: int):
    """Bridge for synchronous Celery/Scripts."""
    brain = AgentBrain(agent_id)
    asyncio.run(brain.run())
