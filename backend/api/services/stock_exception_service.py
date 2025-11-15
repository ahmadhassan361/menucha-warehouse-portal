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
        
        # Check if any affected orders are now ready to pack
        orders_ready = []
        for order_id in affected_order_ids:
            order = Order.objects.get(id=order_id)
            
            # Check if order is now complete (all items picked or marked short)
            if order.check_ready_to_pack() and not order.ready_to_pack:
                order.mark_as_ready()
                orders_ready.append(order.number)
                logger.info(f"Order {order.number} is now ready to pack (with shortages)")
        
        message = f"Marked {total_qty_short}x {sku} as not in stock across {len(order_numbers)} order(s)"
        if orders_ready:
            message += f". Orders ready to pack: {', '.join(orders_ready)}"
        
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
    def resolve_exception(exception_id: int, user) -> Tuple[bool, str]:
        """
        Mark a stock exception as resolved
        
        Args:
            exception_id: ID of the stock exception
            user: User resolving the exception
            
        Returns:
            (success: bool, message: str)
        """
        try:
            exception = StockException.objects.get(id=exception_id)
            exception.resolved = True
            exception.notes = f"{exception.notes}\nResolved by {user.username}".strip()
            exception.save(update_fields=['resolved', 'notes'])
            
            return True, f"Stock exception {exception_id} marked as resolved"
            
        except StockException.DoesNotExist:
            return False, f"Stock exception {exception_id} not found"
    
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
