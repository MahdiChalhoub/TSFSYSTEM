"""
User Tour Completion
====================
Per-user tour completion tracking. Replaces browser localStorage so
tour state persists across devices / incognito / cookie-clears.

Wired from the frontend via `/api/user-tours/` — see views_tours.py.
"""
from django.conf import settings
from django.db import models


class UserTourCompletion(models.Model):
    """One row per (user, tour_id). Upserted when the user finishes a tour."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tour_completions',
    )
    tour_id = models.CharField(max_length=128, help_text='e.g. finance-chart-of-accounts')
    completed_version = models.IntegerField(default=1, help_text='Tour version at completion; bump to force re-show')
    completed_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_tour_completions'
        unique_together = [('user', 'tour_id')]
        indexes = [models.Index(fields=['user', 'tour_id'])]

    def __str__(self) -> str:
        return f'{self.user_id}:{self.tour_id}@v{self.completed_version}'
