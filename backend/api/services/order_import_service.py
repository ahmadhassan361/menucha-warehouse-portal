import requests
import logging
from django.db import transaction
from django.utils import timezone
from typing import Dict, List, Any, Tuple
from ..models import Product, Order, OrderItem, APIConfiguration, SyncLog

logger = logging.getLogger(__name__)


class OrderImportService:
    """
    Service to import orders from external API
    Parses nested JSON structure: categories → subcategories → items → orders
    """
    
    def __init__(self, triggered_by=None):
        self.triggered_by = triggered_by
        self.sync_log = None
        self.stats = {
            'orders_fetched': 0,
            'orders_created': 0,
            'orders_updated': 0,
            'products_created': 0,
            'products_updated': 0,
            'order_items_created': 0,
            'order_items_updated': 0,
            'errors': [],
        }
    
    def sync_orders(self) -> Tuple[bool, str, Dict[str, int]]:
        """
        Main method to sync orders from external API
        Returns: (success: bool, message: str, stats: dict)
        """
        # Create sync log
        self.sync_log = SyncLog.objects.create(
            triggered_by=self.triggered_by,
            status='in_progress'
        )
        
        try:
            # Get API configuration
            config = APIConfiguration.get_config()
            api_url = config.api_base_url
            
            logger.info(f"Starting order sync from {api_url}")
            
            # Fetch data from external API
            response = requests.get(api_url, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            # Validate response structure
            if not data.get('success', False):
                raise ValueError("API response indicates failure")
            
            # Parse and import orders
            self._parse_and_import(data)
            
            # Update sync log
            self.sync_log.status = 'success'
            self.sync_log.completed_at = timezone.now()
            self.sync_log.orders_fetched = self.stats['orders_fetched']
            self.sync_log.orders_created = self.stats['orders_created']
            self.sync_log.orders_updated = self.stats['orders_updated']
            self.sync_log.products_created = self.stats['products_created']
            self.sync_log.products_updated = self.stats['products_updated']
            self.sync_log.detailed_errors = self.stats.get('errors', [])
            self.sync_log.save()
            
            # Update API configuration
            config.last_sync_at = timezone.now()
            config.last_sync_status = 'success'
            
            # Build message with auto-packed info if applicable
            message_parts = [f"Synced {self.stats['orders_fetched']} orders"]
            if self.stats.get('orders_auto_packed', 0) > 0:
                message_parts.append(f"{self.stats['orders_auto_packed']} auto-packed")
            
            config.last_sync_message = ", ".join(message_parts)
            config.save()
            
            message = f"Sync completed successfully. Orders: {self.stats['orders_created']} created, {self.stats['orders_updated']} updated"
            if self.stats.get('orders_auto_packed', 0) > 0:
                message += f", {self.stats['orders_auto_packed']} auto-packed (no longer open on website)"
            logger.info(message)
            
            return True, message, self.stats
            
        except requests.RequestException as e:
            error_msg = f"API request failed: {str(e)}"
            logger.error(error_msg)
            self._handle_sync_error(error_msg)
            return False, error_msg, self.stats
            
        except Exception as e:
            error_msg = f"Sync failed: {str(e)}"
            logger.error(error_msg, exc_info=True)
            self._handle_sync_error(error_msg)
            return False, error_msg, self.stats
    
    def _handle_sync_error(self, error_msg: str):
        """Handle sync error by updating logs and configuration"""
        if self.sync_log:
            self.sync_log.status = 'error'
            self.sync_log.completed_at = timezone.now()
            self.sync_log.error_message = error_msg
            self.sync_log.save()
        
        config = APIConfiguration.get_config()
        config.last_sync_status = 'error'
        config.last_sync_message = error_msg
        config.save()
    
    @transaction.atomic
    def _parse_and_import(self, data: Dict[str, Any]):
        """
        Parse nested JSON structure and import to database
        Structure: categories → subcategories → items → orders
        
        Also marks orders as packed if they're no longer in the API response
        """
        items_by_category = data.get('items_by_category', [])
        
        # Track all order IDs we've seen in this sync
        synced_order_ids = set()
        
        for category in items_by_category:
            category_name = category.get('category_name', 'Uncategorized')
            subcategories = category.get('subcategories', [])
            
            for subcategory in subcategories:
                subcategory_name = subcategory.get('subcategory_name', '')
                items = subcategory.get('items', [])
                
                for item in items:
                    try:
                        # Process product/item
                        product = self._upsert_product(item, category_name, subcategory_name)
                        
                        # Process orders for this item
                        orders_data = item.get('orders', [])
                        for order_data in orders_data:
                            try:
                                order = self._upsert_order(order_data)
                                synced_order_ids.add(order.external_order_id)
                                
                                # Create/update order item
                                self._upsert_order_item(
                                    order=order,
                                    product=product,
                                    item=item,
                                    quantity=order_data.get('quantity', 1)
                                )
                            except Exception as e:
                                error_msg = f"Failed to process order {order_data.get('order_id')}: {str(e)}"
                                logger.error(error_msg)
                                self.stats['errors'].append(error_msg)
                    except Exception as e:
                        error_msg = f"Failed to process product {item.get('sku', 'UNKNOWN')}: {str(e)}"
                        logger.error(error_msg)
                        self.stats['errors'].append(error_msg)
        
        # Update orders_fetched to be accurate count of unique orders
        self.stats['orders_fetched'] = len(synced_order_ids)
        logger.info(f"Parsed {len(synced_order_ids)} unique orders from API")
        logger.info(f"Stats: Created {self.stats['orders_created']} orders, Updated {self.stats['orders_updated']} orders")
        logger.info(f"Stats: Created {self.stats['order_items_created']} order items, Updated {self.stats['order_items_updated']} order items")
        if self.stats['errors']:
            logger.warning(f"Encountered {len(self.stats['errors'])} errors during sync")
        
        # Auto-mark orders as packed if they're no longer in the API response
        # This ensures pick list only shows currently open orders from the website
        orders_to_pack = Order.objects.filter(
            status__in=['open', 'picking', 'ready_to_pack']
        ).exclude(
            external_order_id__in=synced_order_ids
        )
        
        packed_count = 0
        for order in orders_to_pack:
            order.status = 'packed'
            order.packed_at = timezone.now()
            order.ready_to_pack = False
            order.save(update_fields=['status', 'packed_at', 'ready_to_pack', 'updated_at'])
            packed_count += 1
            logger.info(f"Auto-packed order {order.number} (not in latest API response)")
        
        if packed_count > 0:
            logger.info(f"Auto-packed {packed_count} orders that are no longer open on website")
        
        self.stats['orders_auto_packed'] = packed_count
    
    def _upsert_product(self, item: Dict[str, Any], category: str, subcategory: str) -> Product:
        """Create or update product"""
        # Handle SKU - can be int, string, or missing
        raw_sku = item.get('sku')
        
        if raw_sku is None or raw_sku == '':
            # Generate a SKU from title if missing
            title = item.get('title', 'Unknown')
            sku = f"NO_SKU_{title[:20].replace(' ', '_').upper()}"
            logger.warning(f"Item missing SKU, generated: {sku} for '{title}'")
        else:
            sku = str(raw_sku).strip()
        
        if not sku:
            raise ValueError("Product SKU is required and could not be generated")
        
        product, created = Product.objects.update_or_create(
            sku=sku,
            defaults={
                'title': item.get('title', ''),
                'category': category,
                'subcategory': subcategory,
                'vendor_name': item.get('vendor_name', ''),
                'variation_details': item.get('variation_details', ''),
                'image_url': item.get('image_url'),
                'price': item.get('price'),
                'weight': str(item.get('weight', '')),
                'item_type': item.get('item_type', 'product'),
                'store_quantity_available': item.get('store_quantity_available', 0),
            }
        )
        
        if created:
            self.stats['products_created'] += 1
            logger.debug(f"Created product: {sku}")
        else:
            self.stats['products_updated'] += 1
            logger.debug(f"Updated product: {sku}")
        
        return product
    
    def _upsert_order(self, order_data: Dict[str, Any]) -> Order:
        """Create or update order"""
        order_id = str(order_data.get('order_id', ''))
        customer_name = order_data.get('customer_name', 'Unknown')
        
        if not order_id:
            raise ValueError("Order ID is required")
        
        # Check if order exists
        order, created = Order.objects.get_or_create(
            external_order_id=order_id,
            defaults={
                'number': order_id,  # Use order_id as number if not provided separately
                'customer_name': customer_name,
                'status': 'open',
            }
        )
        
        if created:
            self.stats['orders_created'] += 1
            logger.debug(f"Created order: {order_id} for {customer_name}")
        else:
            # Only update if order is still open (not packed yet)
            if order.status in ['open', 'picking']:
                order.customer_name = customer_name
                order.save(update_fields=['customer_name', 'updated_at'])
                self.stats['orders_updated'] += 1
            logger.debug(f"Found existing order: {order_id}")
        
        return order
    
    def _upsert_order_item(self, order: Order, product: Product, item: Dict[str, Any], quantity: int):
        """Create or update order item"""
        # Check if this order item already exists
        order_item, created = OrderItem.objects.get_or_create(
            order=order,
            product=product,
            defaults={
                'sku': product.sku,
                'title': item.get('title', product.title),
                'category': product.category,
                'image_url': item.get('image_url', product.image_url),
                'qty_ordered': quantity,
                'qty_picked': 0,
                'qty_short': 0,
            }
        )
        
        if created:
            self.stats['order_items_created'] += 1
            logger.debug(f"Created order item: {order.number} - {product.sku} x{quantity}")
        else:
            # Update quantity if different (but preserve picked/short quantities)
            if order_item.qty_ordered != quantity:
                order_item.qty_ordered = quantity
                order_item.save(update_fields=['qty_ordered', 'updated_at'])
                self.stats['order_items_updated'] += 1
                logger.debug(f"Updated order item quantity: {order.number} - {product.sku}")
