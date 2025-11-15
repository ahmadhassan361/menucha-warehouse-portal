import logging
from celery import shared_task
from django.utils import timezone
from .services import OrderImportService
from .models import APIConfiguration

logger = logging.getLogger(__name__)


@shared_task(name='api.tasks.sync_orders_task')
def sync_orders_task():
    """
    Periodic task to sync orders from external API
    Runs based on configured interval in APIConfiguration
    """
    try:
        # Check if auto-sync is enabled
        config = APIConfiguration.get_config()
        
        if not config.auto_sync_enabled:
            logger.info("Auto-sync is disabled. Skipping sync.")
            return {
                'status': 'skipped',
                'message': 'Auto-sync is disabled'
            }
        
        logger.info("Starting scheduled order sync...")
        
        # Run sync
        service = OrderImportService(triggered_by=None)
        success, message, stats = service.sync_orders()
        
        if success:
            logger.info(f"Scheduled sync completed successfully: {message}")
            return {
                'status': 'success',
                'message': message,
                'stats': stats
            }
        else:
            logger.error(f"Scheduled sync failed: {message}")
            return {
                'status': 'error',
                'message': message,
                'stats': stats
            }
    
    except Exception as e:
        error_msg = f"Scheduled sync task failed: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return {
            'status': 'error',
            'message': error_msg
        }


@shared_task(name='api.tasks.cleanup_old_logs')
def cleanup_old_logs_task(days=30):
    """
    Task to cleanup old pick events and sync logs
    Keeps only last N days of logs
    """
    from datetime import timedelta
    from .models import PickEvent, SyncLog
    
    try:
        cutoff_date = timezone.now() - timedelta(days=days)
        
        # Delete old pick events
        pick_events_deleted = PickEvent.objects.filter(timestamp__lt=cutoff_date).delete()[0]
        
        # Delete old sync logs (keep all for now, can be adjusted)
        # sync_logs_deleted = SyncLog.objects.filter(started_at__lt=cutoff_date).delete()[0]
        
        logger.info(f"Cleanup completed: Deleted {pick_events_deleted} old pick events")
        
        return {
            'status': 'success',
            'pick_events_deleted': pick_events_deleted,
        }
    
    except Exception as e:
        error_msg = f"Cleanup task failed: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return {
            'status': 'error',
            'message': error_msg
        }


@shared_task(name='api.tasks.send_daily_summary')
def send_daily_summary_task():
    """
    Task to send daily summary email (optional feature)
    Can include: orders picked, orders ready to pack, out of stock items
    """
    try:
        from .models import Order, StockException
        from .services import NotificationService
        
        # Get statistics
        orders_ready = Order.objects.filter(ready_to_pack=True, status='ready_to_pack').count()
        unresolved_exceptions = StockException.objects.filter(resolved=False).count()
        
        # Build message
        message = f"""
Daily Order Picking Summary

Orders Ready to Pack: {orders_ready}
Unresolved Stock Exceptions: {unresolved_exceptions}

Generated: {timezone.now().strftime('%Y-%m-%d %H:%M')}
        """.strip()
        
        # Send email
        success, result = NotificationService.send_email_notification(
            subject="Daily Order Picking Summary",
            message=message
        )
        
        if success:
            logger.info("Daily summary sent successfully")
            return {
                'status': 'success',
                'message': 'Daily summary sent'
            }
        else:
            logger.warning(f"Failed to send daily summary: {result}")
            return {
                'status': 'error',
                'message': result
            }
    
    except Exception as e:
        error_msg = f"Daily summary task failed: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return {
            'status': 'error',
            'message': error_msg
        }
