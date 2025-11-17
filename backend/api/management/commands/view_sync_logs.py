"""
Management command to view sync logs
Usage: python manage.py view_sync_logs [--last N]
"""
from django.core.management.base import BaseCommand
from api.models import SyncLog


class Command(BaseCommand):
    help = 'View sync logs from database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--last',
            type=int,
            default=10,
            help='Number of recent logs to show (default: 10)',
        )
        parser.add_argument(
            '--errors',
            action='store_true',
            help='Show only error logs',
        )

    def handle(self, *args, **options):
        last = options['last']
        errors_only = options['errors']

        logs = SyncLog.objects.all()
        if errors_only:
            logs = logs.filter(status='error')
        
        logs = logs.order_by('-started_at')[:last]

        if not logs.exists():
            self.stdout.write(self.style.WARNING('No sync logs found'))
            return

        self.stdout.write(self.style.SUCCESS(f'\n=== Last {last} Sync Logs ===\n'))

        for log in logs:
            status_color = {
                'success': self.style.SUCCESS,
                'error': self.style.ERROR,
                'in_progress': self.style.WARNING,
            }.get(log.status, self.style.WARNING)

            self.stdout.write(f'\n{"-" * 80}')
            self.stdout.write(f'Sync ID: {log.id}')
            self.stdout.write(f'Started: {log.started_at}')
            self.stdout.write(f'Completed: {log.completed_at or "Still running..."}')
            self.stdout.write(f'Status: {status_color(log.status.upper())}')
            self.stdout.write(f'Triggered by: {log.triggered_by.username if log.triggered_by else "System"}')
            
            if log.duration:
                self.stdout.write(f'Duration: {log.duration:.2f} seconds')

            self.stdout.write(f'\nStatistics:')
            self.stdout.write(f'  Orders fetched: {log.orders_fetched}')
            self.stdout.write(f'  Orders created: {log.orders_created}')
            self.stdout.write(f'  Orders updated: {log.orders_updated}')
            self.stdout.write(f'  Products created: {log.products_created}')
            self.stdout.write(f'  Products updated: {log.products_updated}')

            if log.error_message:
                self.stdout.write(self.style.ERROR(f'\nError Message:'))
                self.stdout.write(self.style.ERROR(f'  {log.error_message}'))
            
            if log.detailed_errors:
                self.stdout.write(self.style.WARNING(f'\nDetailed Errors ({len(log.detailed_errors)} items):'))
                for i, error in enumerate(log.detailed_errors[:10], 1):  # Show max 10 errors
                    self.stdout.write(self.style.WARNING(f'  {i}. {error}'))
                if len(log.detailed_errors) > 10:
                    self.stdout.write(self.style.WARNING(f'  ... and {len(log.detailed_errors) - 10} more errors'))

        self.stdout.write(f'\n{"-" * 80}\n')
