import logging
from django.db import transaction
from django.db.models import F
from typing import Dict, List, Tuple
from ..models import OrderItem, StockException, Order

logger = logging.getLogger(__name__)


class StockExceptionService:
    """
    Service to handle stock exceptions (out-of-stock / shortage tracking)
    """
    
    @staticmethod
    @transaction.atomic
    def mark_not_in_stock(
        sku: str,
        allocations: List[Dict[str, int]],
        user,
        notes: str = ''
    ) -> Tuple[bool, str, List[int]]:
        """
        Mark items as not in stock for specific orders
        
        Args:
            sku: The SKU that is out of stock
            allocations: List of dicts with 'order_id' and 'qty_short'
            user: User reporting the shortage
            notes: Optional notes
            
        Returns:
            (success: bool, message: str, affected_order_ids: List[int])
        """
        if not allocations:
            return False, "No allocations provided", []
        
        affected_order_ids = []
        total_qty_short = 0
        order_numbers = []
        
        # Process each allocation
        for allocation in allocations:
            order_id = allocation.get('order_id')
            qty_short = allocation.get('qty_short', 0)
            
            if qty_short <= 0:
                continue
            
            try:
                # Find the order item
                order_item = OrderItem.objects.select_related('order', 'product').get(
                    order_id=order_id,
                    sku=sku
                )
                
                # Check if we can mark this quantity as short
                if order_item.qty_remaining < qty_short:
                    logger.warning(
                        f"Cannot mark {qty_short} units as short for order {order_item.order.number}. "
                        f"Only {order_item.qty_remaining} units remaining."
                    )
                    continue
                
                # Update qty_short
                order_item.qty_short = F('qty_short') + qty_short
                order_item.save(update_fields=['qty_short', 'updated_at'])
                
                # Refresh to get updated value
                order_item.refresh_from_db()
                
                # Track order
                if order_item.order_id not in affected_order_ids:
                    affected_order_ids.append(order_item.order_id)
                    order_numbers.append(order_item.order.number)
                
                total_qty_short += qty_short
                
                logger.info(
                    f"Marked {qty_short}x {sku} as not in stock for order {order_item.order.number} "
                    f"by {user.username}"
                )
                
            except OrderItem.DoesNotExist:
                logger.error(f"Order item not found: order_id={order_id}, sku={sku}")
                continue
        
        if total_qty_short == 0:
            return False, "No items were marked as not in stock", []
        
        # Create stock exception record
        try:
            # Get product info
            order_item = OrderItem.objects.filter(sku=sku).select_related('product').first()
            product_title = order_item.title if order_item else sku
            category = order_item.category if order_item else 'Unknown'
            
            stock_exception = StockException.objects.create(
                sku=sku,
                product_title=product_title,
                category=category,
                qty_short=total_qty_short,
                order_numbers=order_numbers,
                reported_by=user,
                notes=notes
            )
            
            logger.info(f"Created stock exception: {stock_exception}")
            
        except Exception as e:
            logger.error(f"Failed to create stock exception: {str(e)}")
        
        # NOTE: Orders with shortages should NOT be automatically marked as ready to pack
        # They will only appear in ready-to-pack once ALL items are fully picked (no shortages)
        
        message = f"Marked {total_qty_short}x {sku} as not in stock across {len(order_numbers)} order(s)"
        
        return True, message, affected_order_ids
    
    @staticmethod
    def get_stock_exceptions(resolved: bool = None, from_date=None, to_date=None) -> List[StockException]:
        """
        Get stock exceptions with optional filters
        
        Args:
            resolved: Filter by resolved status (None = all, True = resolved, False = unresolved)
            from_date: Filter exceptions from this date
            to_date: Filter exceptions to this date
            
        Returns:
            List of StockException objects
        """
        queryset = StockException.objects.all()
        
        if resolved is not None:
            queryset = queryset.filter(resolved=resolved)
        
        if from_date:
            queryset = queryset.filter(timestamp__gte=from_date)
        
        if to_date:
            queryset = queryset.filter(timestamp__lte=to_date)
        
        return queryset.order_by('-timestamp')
    
    @staticmethod
    @transaction.atomic
    def resolve_exception(exception_id: int, user) -> Tuple[bool, str]:
        """
        Mark a stock exception as resolved and restore items to pick list
        
        This will:
        1. Mark the exception as resolved
        2. Reset qty_short to 0 for all affected order items
        3. Make items available again in the pick list
        
        Args:
            exception_id: ID of the stock exception
            user: User resolving the exception
            
        Returns:
            (success: bool, message: str)
        """
        try:
            exception = StockException.objects.get(id=exception_id)
            
            # Get the SKU and affected order numbers
            sku = exception.sku
            order_numbers = exception.order_numbers
            
            # Find all affected order items and reset their qty_short
            # Include ready_to_pack status as well since order might have been moved there
            affected_items = OrderItem.objects.filter(
                sku=sku,
                order__number__in=order_numbers,
                order__status__in=['open', 'picking', 'ready_to_pack'],
                qty_short__gt=0
            ).select_related('order')
            
            items_updated = 0
            items_skipped = 0
            orders_to_revert = set()
            skipped_batches = []
            
            for item in affected_items:
                # Check if item belongs to an already-packed batch
                # If current_shipment > item's shipment_batch, that batch is already packed
                if item.order.total_shipments > 1 and item.order.current_shipment > item.shipment_batch:
                    items_skipped += 1
                    skipped_batches.append({
                        'order': item.order.number,
                        'batch': item.shipment_batch,
                        'current_batch': item.order.current_shipment
                    })
                    logger.warning(
                        f"Cannot restore SKU {sku} for order {item.order.number} - "
                        f"item is in batch {item.shipment_batch} which is already packed "
                        f"(order currently on batch {item.order.current_shipment})"
                    )
                    continue
                
                # Reset qty_short to 0 to make item available for picking again
                item.qty_short = 0
                item.save(update_fields=['qty_short', 'updated_at'])
                items_updated += 1
                
                # If order was in ready_to_pack, it needs to go back to picking
                # because this item is now available and needs to be picked
                if item.order.status == 'ready_to_pack' or item.order.ready_to_pack:
                    orders_to_revert.add(item.order)
                
                logger.info(
                    f"Reset qty_short for order {item.order.number}, SKU {sku} - "
                    f"item now available in pick list"
                )
            
            # Revert orders back to picking state
            for order in orders_to_revert:
                order.status = 'picking'
                order.ready_to_pack = False
                order.save(update_fields=['status', 'ready_to_pack', 'updated_at'])
                logger.info(
                    f"Reverted order {order.number} from ready_to_pack back to picking "
                    f"because SKU {sku} is back in stock"
                )
            
            # Mark exception as resolved
            exception.resolved = True
            exception.notes = f"{exception.notes}\nResolved by {user.username} - {items_updated} order items restored to pick list".strip()
            exception.save(update_fields=['resolved', 'notes'])
            
            revert_count = len(orders_to_revert)
            logger.info(
                f"Resolved stock exception {exception_id} for SKU {sku} - "
                f"{items_updated} items restored to pick list, "
                f"{revert_count} orders reverted to picking, "
                f"{items_skipped} items skipped (already-packed batches)"
            )
            
            # Build message
            if items_updated == 0 and items_skipped > 0:
                # All items were skipped
                message = "Cannot restore items - they belong to already-packed batches"
                for skip_info in skipped_batches:
                    message += f"\nOrder {skip_info['order']}: Batch {skip_info['batch']} is already packed (currently on batch {skip_info['current_batch']})"
                return False, message
            
            message = f"Stock exception resolved - {items_updated} items restored to pick list"
            if revert_count > 0:
                message += f", {revert_count} orders moved back to picking"
            if items_skipped > 0:
                message += f"\nWarning: {items_skipped} items could not be restored (already-packed batches)"
            
            return True, message
            
        except StockException.DoesNotExist:
            return False, f"Stock exception {exception_id} not found"
        except Exception as e:
            logger.error(f"Error resolving stock exception {exception_id}: {str(e)}")
            return False, f"Error resolving exception: {str(e)}"
    
    @staticmethod
    def get_aggregated_exceptions() -> List[Dict]:
        """
        Get aggregated stock exceptions grouped by SKU
        Useful for reporting
        """
        exceptions = StockException.objects.filter(resolved=False)
        
        # Group by SKU
        sku_dict = {}
        for exc in exceptions:
            sku = exc.sku
            if sku not in sku_dict:
                sku_dict[sku] = {
                    'sku': sku,
                    'product_title': exc.product_title,
                    'category': exc.category,
                    'total_qty_short': 0,
                    'order_numbers': set(),
                    'exception_count': 0,
                }
            
            sku_dict[sku]['total_qty_short'] += exc.qty_short
            sku_dict[sku]['order_numbers'].update(exc.order_numbers)
            sku_dict[sku]['exception_count'] += 1
        
        # Convert sets to lists
        result = []
        for sku, data in sku_dict.items():
            data['order_numbers'] = sorted(list(data['order_numbers']))
            result.append(data)
        
        # Sort by total quantity short (descending)
        result.sort(key=lambda x: x['total_qty_short'], reverse=True)
        
        return result
