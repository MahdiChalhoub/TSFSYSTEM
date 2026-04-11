import logging

logger = logging.getLogger(__name__)


class ZATCACoreMixin:

    def __init__(self, organization_id, config=None):
        """
        Args:
            organization_id: UUID of the organization
            config: Optional ZATCAConfig instance (auto-loaded if not provided)
        """
        self.organization_id = organization_id
        self._config = config


    @property
    def config(self):
        """Lazy-load ZATCAConfig for this organization."""
        if self._config is None:
            from apps.finance.zatca_config import ZATCAConfig
            self._config = ZATCAConfig.objects.filter(
                organization_id=self.organization_id,
                is_active=True,
            ).first()
        return self._config


    @property
    def base_url(self):
        if self.config and not self.config.is_sandbox:
            return self.ZATCA_API_BASE
        return self.ZATCA_SANDBOX

