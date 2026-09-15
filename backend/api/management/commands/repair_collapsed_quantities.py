"""
Management command to repair order items whose quantity was collapsed on import.

Before the line-summing fix in OrderImportService, an order that listed the same
SKU on several lines (18 copies arriving as 18 lines of quantity 1) was imported
with only the last line's quantity, so pickers were sent out for 1 unit instead
of 18.

The next sync after the fix ships corrects qty_ordered on its own, but it does
not revisit orders already sitting in the pack queue - those stay flagged ready
while being short. So this command keys off the shape of the feed (which order
lines repeat) rather than off the quantity still being wrong, which makes it
safe to run either side of that sync, and safe to run twice.

Usage: python manage.py repair_collapsed_quantities [--apply]
"""
import requests
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import APIConfiguration, OrderItem


class Command(BaseCommand):
    help = 'Repair order items whose qty_ordered was collapsed by the old import'

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            help='Write the corrections (default is a dry run that changes nothing)',
        )

    def handle(self, *args, **options):
        apply_changes = options['apply']

        config = APIConfiguration.get_config()
        self.stdout.write(f'Fetching feed from {config.api_base_url}')
        response = requests.get(config.api_base_url, timeout=120)
        response.raise_for_status()
        data = response.json()

        if not data.get('success', False):
            self.stdout.write(self.style.ERROR('API response indicates failure'))
            return

        # What the feed asks for per (order number, sku), and how many lines it
        # took to say it - only the repeated ones could have been collapsed
        expected = defaultdict(int)
        line_count = defaultdict(int)
        for category in data.get('items_by_category', []):
            for subcategory in category.get('subcategories', []):
                for item in subcategory.get('items', []):
                    sku = str(item.get('sku', '')).strip()
                    for order_data in item.get('orders', []):
                        key = (str(order_data.get('order_id', '')), sku)
                        expected[key] += order_data.get('quantity', 1) or 0
                        line_count[key] += 1

        affected = []
        for key, count in line_count.items():
            if count < 2:
                continue
            order_number, sku = key
            order_item = OrderItem.objects.filter(
                order__number=order_number, sku=sku
            ).select_related('order').first()
            if order_item:
                affected.append((order_item, expected[key], count))

        if not affected:
            self.stdout.write(self.style.SUCCESS('No repeated order lines in the feed'))
            return

        self.stdout.write(self.style.WARNING(
            f'\n{len(affected)} order item(s) built from repeated feed lines:\n'
        ))

        repaired, demoted, already_packed, untouched = 0, [], [], 0

        for order_item, correct_qty, count in sorted(affected, key=lambda r: r[0].order.number):
            order = order_item.order
            needs_qty_fix = order_item.qty_ordered < correct_qty

            self.stdout.write(
                f'  Order {order.number} / {order_item.sku}: '
                f'{count} feed lines totalling {correct_qty}, '
                f'qty_ordered={order_item.qty_ordered} '
                f'(picked {order_item.qty_picked}, short {order_item.qty_short}, '
                f'status {order.status})'
                + ('' if needs_qty_fix else '  [quantity already correct]')
            )

            if order.status == 'packed':
                # Already shipped short. Correcting the quantity would not undo
                # that, and silently reopening a shipped order is worse than
                # leaving it for someone to decide on.
                already_packed.append((order.number, order_item.sku,
                                       order_item.qty_picked, correct_qty))
                continue

            if not apply_changes:
                continue

            with transaction.atomic():
                if needs_qty_fix:
                    order_item.qty_ordered = correct_qty
                    order_item.save(update_fields=['qty_ordered', 'updated_at'])
                    repaired += 1

                # Checked even when the quantity was already corrected by a
                # sync, because that sync leaves the pack queue stale: the order
                # keeps looking complete while it is short
                if order.ready_to_pack and not order.check_ready_to_pack():
                    order.ready_to_pack = False
                    order.status = 'picking' if order_item.qty_picked else 'open'
                    order.save(update_fields=['ready_to_pack', 'status', 'updated_at'])
                    demoted.append(order.number)
                elif not needs_qty_fix:
                    untouched += 1

        if already_packed:
            self.stdout.write(self.style.WARNING(
                '\nAlready packed - shipped short, needs a human decision:'
            ))
            for number, sku, picked, correct_qty in already_packed:
                self.stdout.write(
                    f'  Order {number} / {sku}: shipped {picked} of {correct_qty}'
                )

        if not apply_changes:
            self.stdout.write(self.style.WARNING(
                '\nDry run - nothing was changed. Re-run with --apply to write.'
            ))
            return

        self.stdout.write(self.style.SUCCESS(f'\nRepaired {repaired} order item(s)'))
        if demoted:
            self.stdout.write(self.style.WARNING(
                f'Pulled {len(demoted)} order(s) back out of the pack queue: '
                f'{", ".join(demoted)}'
            ))
        if untouched:
            self.stdout.write(f'{untouched} order item(s) already correct, left alone')
