"""
Depreciation Celery Tasks
==========================
Automated tasks for monthly depreciation posting.
"""

from celery import shared_task
from datetime import date
from django.db import transaction
import logging

logger = logging.getLogger(__name__)


@shared_task(name='finance.post_monthly_depreciation')
def post_monthly_depreciation_task(organization_id: int, month: int = None, year: int = None):
    """
    Post depreciation for all active assets for a specific month.

    Args:
        organization_id: Organization ID
        month: Month (1-12), defaults to current month
        year: Year, defaults to current year

    Returns:
        Dict with posting results
    """
    from erp.models import Organization
    from apps.finance.services.depreciation_service import DepreciationBatchService

    # Default to current month/year
    if month is None or year is None:
        today = date.today()
        month = month or today.month
        year = year or today.year

    try:
        organization = Organization.objects.get(id=organization_id)

        logger.info(
            f"Starting monthly depreciation posting for {organization.name} "
            f"({year}-{month:02d})"
        )

        # Post depreciation for all assets
        results = DepreciationBatchService.post_depreciation_for_month(
            organization, month, year
        )

        logger.info(
            f"Completed monthly depreciation posting for {organization.name}: "
            f"{results['posted']} posted, {results['already_posted']} already posted, "
            f"{results['errors']} errors, Total: {results['total_amount']}"
        )

        return {
            'success': True,
            'organization_id': organization_id,
            'month': month,
            'year': year,
            'results': results
        }

    except Organization.DoesNotExist:
        logger.error(f"Organization {organization_id} not found")
        return {
            'success': False,
            'error': f"Organization {organization_id} not found"
        }
    except Exception as e:
        logger.error(f"Error posting depreciation: {str(e)}", exc_info=True)
        return {
            'success': False,
            'error': str(e)
        }


@shared_task(name='finance.post_depreciation_all_orgs')
def post_depreciation_all_organizations(month: int = None, year: int = None):
    """
    Post depreciation for all organizations (run monthly via cron).

    Args:
        month: Month (1-12), defaults to current month
        year: Year, defaults to current year

    Returns:
        Dict with summary results
    """
    from erp.models import Organization

    if month is None or year is None:
        today = date.today()
        month = month or today.month
        year = year or today.year

    logger.info(f"Starting depreciation posting for all organizations ({year}-{month:02d})")

    organizations = Organization.objects.filter(is_active=True)

    summary = {
        'total_organizations': organizations.count(),
        'success': 0,
        'errors': 0,
        'total_posted': 0,
        'details': []
    }

    for org in organizations:
        try:
            result = post_monthly_depreciation_task(org.id, month, year)

            if result.get('success'):
                summary['success'] += 1
                summary['total_posted'] += result['results']['posted']
            else:
                summary['errors'] += 1

            summary['details'].append({
                'organization_id': org.id,
                'organization_name': org.name,
                'result': result
            })

        except Exception as e:
            logger.error(f"Error processing organization {org.id}: {str(e)}", exc_info=True)
            summary['errors'] += 1
            summary['details'].append({
                'organization_id': org.id,
                'organization_name': org.name,
                'error': str(e)
            })

    logger.info(
        f"Completed depreciation posting for all organizations: "
        f"{summary['success']} success, {summary['errors']} errors, "
        f"{summary['total_posted']} total assets posted"
    )

    return summary


@shared_task(name='finance.generate_asset_schedules')
def generate_all_asset_schedules(organization_id: int):
    """
    Generate depreciation schedules for all assets without schedules.

    Args:
        organization_id: Organization ID

    Returns:
        Dict with generation results
    """
    from erp.models import Organization
    from apps.finance.models import Asset
    from apps.finance.services.depreciation_service import DepreciationService

    try:
        organization = Organization.objects.get(id=organization_id)

        # Get assets without schedules
        assets = Asset.objects.filter(
            organization=organization,
            status='ACTIVE'
        )

        results = {
            'total_assets': 0,
            'generated': 0,
            'errors': 0,
            'details': []
        }

        for asset in assets:
            results['total_assets'] += 1

            # Check if schedule exists
            if asset.amortization_lines.exists():
                continue

            try:
                service = DepreciationService(asset)
                schedule = service.generate_depreciation_schedule()

                results['generated'] += 1
                results['details'].append({
                    'asset_id': asset.id,
                    'asset_name': asset.name,
                    'status': 'generated',
                    'schedule_entries': len(schedule)
                })

            except Exception as e:
                results['errors'] += 1
                results['details'].append({
                    'asset_id': asset.id,
                    'asset_name': asset.name,
                    'status': 'error',
                    'error': str(e)
                })

        logger.info(
            f"Generated depreciation schedules for {organization.name}: "
            f"{results['generated']} generated, {results['errors']} errors"
        )

        return {
            'success': True,
            'organization_id': organization_id,
            'results': results
        }

    except Organization.DoesNotExist:
        logger.error(f"Organization {organization_id} not found")
        return {
            'success': False,
            'error': f"Organization {organization_id} not found"
        }
    except Exception as e:
        logger.error(f"Error generating schedules: {str(e)}", exc_info=True)
        return {
            'success': False,
            'error': str(e)
        }
