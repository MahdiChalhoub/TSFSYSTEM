"""
ConnectorEngine Signals
=======================
Django signals used by the ConnectorEngine event bus for loose-coupled
inter-module communication.

Usage:
    # In any module's apps.py ready() or a receiver file:
    from erp.signals import connector_event
    from django.dispatch import receiver

    @receiver(connector_event)
    def handle_connector_event(sender, **kwargs):
        target_module = kwargs['target_module']
        event_name = kwargs['event_name']
        payload = kwargs['payload']
        organization_id = kwargs['organization_id']
        
        if target_module == 'finance' and event_name == 'order:completed':
            # React to order completion in finance module
            pass
"""

import django.dispatch

# Fired by ConnectorEngine._deliver_event when no direct handler is found
# Provides: target_module, event_name, payload, organization_id
connector_event = django.dispatch.Signal()
