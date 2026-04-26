"""Seed default AutoTaskRules + TaskTemplates for fiscal-period events.

Idempotent — safe to run multiple times. Creates one rule per org per
trigger if it doesn't already exist. Admins can then edit the rules
(assignee, priority, etc.) via /workspace/auto-task-rules.
"""
from django.core.management.base import BaseCommand

from apps.workspace.models import AutoTaskRule, TaskTemplate
from erp.models import Organization


RULES = [
    {
        'code': 'FIN-PER-CLOSE',
        'name': 'Fiscal period closing soon',
        'trigger_event': 'PERIOD_CLOSING_SOON',
        'rule_type': 'EVENT',
        'priority': 'HIGH',
        'template_title': 'Close fiscal period',
        'task_minutes': 30,
    },
    {
        'code': 'FIN-PER-START',
        'name': 'Next fiscal period opening soon',
        'trigger_event': 'PERIOD_STARTING_SOON',
        'rule_type': 'EVENT',
        'priority': 'MEDIUM',
        'template_title': 'Open next fiscal period',
        'task_minutes': 15,
    },
    {
        'code': 'FIN-PER-REOPEN',
        'name': 'Fiscal period reopen request',
        'trigger_event': 'PERIOD_REOPEN_REQUEST',
        'rule_type': 'EVENT',
        'priority': 'URGENT',
        'template_title': 'Review period reopen request',
        'task_minutes': 20,
    },
    {
        'code': 'FIN-FY-CLOSE',
        'name': 'Fiscal year closing soon',
        'trigger_event': 'YEAR_CLOSING_SOON',
        'rule_type': 'EVENT',
        'priority': 'HIGH',
        'template_title': 'Prepare year-end close',
        'task_minutes': 120,
    },
    {
        'code': 'FIN-FY-START',
        'name': 'New fiscal year starting soon',
        'trigger_event': 'YEAR_STARTING_SOON',
        'rule_type': 'EVENT',
        'priority': 'MEDIUM',
        'template_title': 'Open next fiscal year',
        'task_minutes': 30,
    },
    {
        'code': 'FIN-CHK-READY',
        'name': 'Close checklist ready — gate cleared',
        'trigger_event': 'CHECKLIST_READY_TO_CLOSE',
        'rule_type': 'EVENT',
        'priority': 'HIGH',
        'template_title': 'Run final close — checklist is ready',
        'task_minutes': 30,
    },
    {
        'code': 'FIN-CHK-OVERDUE',
        'name': 'Close checklist item overdue',
        'trigger_event': 'CHECKLIST_ITEM_OVERDUE',
        'rule_type': 'EVENT',
        'priority': 'URGENT',
        'template_title': 'Resolve overdue close-checklist item',
        'task_minutes': 30,
    },
]


class Command(BaseCommand):
    help = "Seed default auto-task rules for fiscal-period events (closing/starting soon, reopen)."

    def add_arguments(self, parser):
        parser.add_argument(
            '--org', type=int, default=None,
            help="Restrict to a single organization id (default: all).",
        )

    def handle(self, *args, **opts):
        orgs = Organization.objects.all()
        if opts.get('org'):
            orgs = orgs.filter(id=opts['org'])

        created = skipped = 0
        for org in orgs:
            for spec in RULES:
                if AutoTaskRule.objects.filter(organization=org, code=spec['code']).exists():
                    skipped += 1
                    continue
                tmpl = TaskTemplate.objects.create(
                    organization=org,
                    name=spec['template_title'],
                    default_priority=spec['priority'],
                    estimated_minutes=spec['task_minutes'],
                    default_points=1,
                    is_active=True,
                )
                AutoTaskRule.objects.create(
                    organization=org,
                    code=spec['code'],
                    name=spec['name'],
                    trigger_event=spec['trigger_event'],
                    rule_type=spec['rule_type'],
                    module='finance',
                    priority=spec['priority'],
                    template=tmpl,
                    conditions={},
                    is_active=True,
                    is_system_default=True,
                )
                created += 1
                self.stdout.write(f"  [{org.id}] seeded {spec['code']} → {spec['name']}")

        self.stdout.write(self.style.SUCCESS(
            f"Done. Created {created} rules, skipped {skipped} already-present."
        ))
