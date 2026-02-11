import logging

logger = logging.getLogger(__name__)

def pre_install():
    """Run before files are swapped."""
    print("🔔 [FINANCE] Pre-install hook triggered for v1.0.6")
    logger.info("Finance module v1.0.6 pre-install starting...")

def post_install():
    """Run after files are swapped and migrations applied."""
    print("✅ [FINANCE] Post-install hook triggered for v1.0.6")
    logger.info("Finance module v1.0.6 post-install completed successfully.")
