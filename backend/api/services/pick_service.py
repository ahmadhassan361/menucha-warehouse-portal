import logging
from django.db import transaction
from django.db.models import F, Q, Sum
from typing import Dict, List, Tuple, Any
from ..models import OrderItem, PickEvent, Order

logger = logging.getLogger(__name__)


class PickService:
    """
    Service to handle pick operations with FIFO (First In First Out) allocation
    When picking at SKU level, allocates to oldest outstanding orders first
    """
    
    @staticmethod
    def get_pick_list() -> List[Dict[str, Any]]:
        """
        Get aggregated pick list grouped by SKU
        Returns list of items with needed, picked, and remaining quantities
        Only shows items for current shipment batch
        """
        # Get all order items from open orders (not ready to pack)
        # Only items in current shipment batch
        order_items = OrderItem.objects.filter(
            order__status__in=['open', 'picking'],
            order__ready_to_pack=False,
            shipment_batch=F('order__current_shipment')
        ).select_related('product')
        
        # Group by SKU and aggregate
        sku_dict = {}
        
        for item in order_items:
            sku = item.sku
            
            if sku not in sku_dict:
                sku_dict[sku] = {
                    'sku': sku,
                    'title': item.title,
                    'category': item.category,
                    'subcategory': item.product.subcategory if item.product else '',
                    'vendor_name': item.product.vendor_name if item.product else '',
                    'variation_details': item.product.variation_details if item.product else '',
                    'image_url': item.image_url,
                    'price': item.product.price if item.product else None,
                    'needed': 0,
                    'picked': 0,
                    'remaining': 0,
                    'store_quantity_available': item.product.store_quantity_available if item.product else 0,
                }
            
            # Aggregate quantities
            sku_dict[sku]['needed'] += item.qty_ordered
            sku_dict[sku]['picked'] += item.qty_picked
            sku_dict[sku]['remaining'] += item.qty_remaining
        
        # Convert to list and sort by category and SKU
        pick_list = list(sku_dict.values())
        pick_list.sort(key=lambda x: (x['category'], x['sku']))
        
        return pick_list
    
    @staticmethod
    def get_pick_list_stats() -> Dict[str, int]:
        """Get statistics for the pick list"""
        pick_list = PickService.get_pick_list()
        
        categories = set(item['category'] for item in pick_list)
        
        stats = {
            'total_skus': len(pick_list),
            'total_items_needed': sum(item['needed'] for item in pick_list),
            'total_items_picked': sum(item['picked'] for item in pick_list),
            'total_items_remaining': sum(item['remaining'] for item in pick_list),
            'total_orders': Order.objects.filter(status__in=['open', 'picking'], ready_to_pack=False).count(),
            'categories_count': len(categories),
        }
        
        return stats
    
    @staticmethod
    @transaction.atomic
    def pick_items(sku: str, qty: int, user, notes: str = '') -> Tuple[bool, str, List[int]]:
        """
        Pick items for a given SKU with FIFO allocation
        Only picks items for current shipment batch
        
        Args:
            sku: The SKU to pick
            qty: Quantity to pick
            user: User performing the pick
            notes: Optional notes
            
        Returns:
            (success: bool, message: str, affected_order_ids: List[int])
        """
        if qty <= 0:
            return False, "Quantity must be greater than 0", []
        
        # Get all outstanding order items for this SKU, ordered by FIFO (oldest first)
        # Only items in current shipment batch
        order_items = OrderItem.objects.filter(
            sku=sku,
            order__status__in=['open', 'picking'],
            order__ready_to_pack=False,
            shipment_batch=F('order__current_shipment')
        ).select_related('order').order_by('order__created_at', 'id')
        
        # Filter to only items with remaining quantity
        order_items = [item for item in order_items if item.qty_remaining > 0]
        
        if not order_items:
            return False, f"No outstanding items found for SKU: {sku}", []
        
        # Calculate total remaining
        total_remaining = sum(item.qty_remaining for item in order_items)
        
        if qty > total_remaining:
            return False, f"Cannot pick {qty} units. Only {total_remaining} units remaining for SKU: {sku}", []
        
        # Allocate picks to order items (FIFO)
        remaining_to_pick = qty
        affected_order_ids = []
        pick_events = []
        
        for item in order_items:
            if remaining_to_pick <= 0:
                break
            
            # Calculate how much to pick from this order item
            qty_to_pick = min(remaining_to_pick, item.qty_remaining)
            
            # Update picked quantity
            item.qty_picked = F('qty_picked') + qty_to_pick
            item.save(update_fields=['qty_picked', 'updated_at'])
            
            # Refresh to get updated value
            item.refresh_from_db()
            
            # Create pick event (audit log)
            pick_event = PickEvent.objects.create(
                order_item=item,
                qty=qty_to_pick,
                user=user,
                notes=notes
            )
            pick_events.append(pick_event)
            
            # Track affected order
            if item.order_id not in affected_order_ids:
                affected_order_ids.append(item.order_id)
            
            remaining_to_pick -= qty_to_pick
            
            logger.info(f"Picked {qty_to_pick}x {sku} for order {item.order.number} by {user.username}")
        
        # Check if any affected orders are now ready to pack
        orders_ready = []
        for order_id in affected_order_ids:
            order = Order.objects.get(id=order_id)
            
            # Update order status to 'picking' if it was 'open'
            if order.status == 'open':
                order.status = 'picking'
                order.save(update_fields=['status', 'updated_at'])
            
            # Check if order is now complete
            if order.check_ready_to_pack() and not order.ready_to_pack:
                order.mark_as_ready()
                orders_ready.append(order.number)
                logger.info(f"Order {order.number} is now ready to pack")
        
        message = f"Successfully picked {qty}x {sku}"
        if orders_ready:
            message += f". Orders ready to pack: {', '.join(orders_ready)}"
        
        return True, message, affected_order_ids
    
    @staticmethod
    def get_order_items_by_sku(sku: str) -> List[OrderItem]:
        """
        Get all outstanding order items for a specific SKU
        Ordered by FIFO (oldest orders first)
        Only items in current shipment batch
        """
        return OrderItem.objects.filter(
            sku=sku,
            order__status__in=['open', 'picking'],
            order__ready_to_pack=False,
            shipment_batch=F('order__current_shipment')
        ).select_related('order').order_by('order__created_at', 'id')
    
    @staticmethod
    def get_pickable_quantity(sku: str) -> int:
        """Get total pickable (remaining) quantity for a SKU in current shipment batches"""
        order_items = OrderItem.objects.filter(
            sku=sku,
            order__status__in=['open', 'picking'],
            order__ready_to_pack=False,
            shipment_batch=F('order__current_shipment')
        )
        
        total = 0
        for item in order_items:
            total += item.qty_remaining
        
        return total
