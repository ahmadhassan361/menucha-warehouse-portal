from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import (
    User, Product, Order, OrderItem, PickEvent,
    StockException, APIConfiguration, EmailSMSSettings, SyncLog
)


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model"""
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone', 'is_active']
        read_only_fields = ['id']


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating users"""
    password = serializers.CharField(write_only=True, min_length=8)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'first_name', 'last_name', 'role', 'phone']
    
    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user


class LoginSerializer(serializers.Serializer):
    """Serializer for user login"""
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
    
    def validate(self, data):
        username = data.get('username')
        password = data.get('password')
        
        if username and password:
            user = authenticate(username=username, password=password)
            if user:
                if not user.is_active:
                    raise serializers.ValidationError('User account is disabled.')
                data['user'] = user
                return data
            else:
                raise serializers.ValidationError('Unable to log in with provided credentials.')
        else:
            raise serializers.ValidationError('Must include "username" and "password".')


class ProductSerializer(serializers.ModelSerializer):
    """Serializer for Product model"""
    
    class Meta:
        model = Product
        fields = [
            'id', 'sku', 'title', 'category', 'subcategory', 'vendor_name', 'variation_details',
            'image_url', 'price', 'weight', 'item_type', 
            'store_quantity_available', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class OrderItemSerializer(serializers.ModelSerializer):
    """Serializer for OrderItem model"""
    qty_remaining = serializers.IntegerField(read_only=True)
    is_complete = serializers.BooleanField(read_only=True)
    product = serializers.SerializerMethodField()
    
    class Meta:
        model = OrderItem
        fields = [
            'id', 'order', 'product', 'sku', 'title', 'category', 
            'image_url', 'qty_ordered', 'qty_picked', 'qty_short', 
            'qty_remaining', 'is_complete', 'shipment_batch',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_product(self, obj):
        """Return product info with vendor_name and variation_details"""
        if obj.product:
            return {
                'id': obj.product.id,
                'vendor_name': obj.product.vendor_name or '',
                'variation_details': obj.product.variation_details or ''
            }
        return None


class OrderSerializer(serializers.ModelSerializer):
    """Serializer for Order model"""
    items = OrderItemSerializer(many=True, read_only=True)
    items_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Order
        fields = [
            'id', 'external_order_id', 'number', 'customer_name', 
            'status', 'ready_to_pack', 'packed_at', 'packed_by',
            'total_shipments', 'current_shipment',
            'items', 'items_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_items_count(self, obj):
        return obj.items.count()


class OrderListSerializer(serializers.ModelSerializer):
    """Simplified serializer for listing orders"""
    items_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Order
        fields = [
            'id', 'external_order_id', 'number', 'customer_name', 
            'status', 'ready_to_pack', 'total_shipments', 'current_shipment',
            'items_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_items_count(self, obj):
        return obj.items.count()


class PickEventSerializer(serializers.ModelSerializer):
    """Serializer for PickEvent model"""
    user_name = serializers.CharField(source='user.username', read_only=True)
    order_number = serializers.CharField(source='order_item.order.number', read_only=True)
    
    class Meta:
        model = PickEvent
        fields = [
            'id', 'order_item', 'qty', 'user', 'user_name', 
            'order_number', 'timestamp', 'notes'
        ]
        read_only_fields = ['id', 'timestamp']


class StockExceptionSerializer(serializers.ModelSerializer):
    """Serializer for StockException model"""
    reported_by_name = serializers.CharField(source='reported_by.username', read_only=True)
    vendor_name = serializers.SerializerMethodField()
    variation_details = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = StockException
        fields = [
            'id', 'sku', 'product_title', 'category', 'qty_short', 
            'order_numbers', 'reported_by', 'reported_by_name', 
            'timestamp', 'resolved', 'ordered_from_company', 'na_cancel', 'notes',
            'vendor_name', 'variation_details', 'image_url'
        ]
        read_only_fields = ['id', 'timestamp']
    
    def get_vendor_name(self, obj):
        """Get vendor_name from related product"""
        try:
            from .models import Product
            product = Product.objects.filter(sku=obj.sku).first()
            return product.vendor_name if product else ''
        except:
            return ''
    
    def get_variation_details(self, obj):
        """Get variation_details from related product"""
        try:
            from .models import Product
            product = Product.objects.filter(sku=obj.sku).first()
            return product.variation_details if product else ''
        except:
            return ''
    
    def get_image_url(self, obj):
        """Get image_url from related product"""
        try:
            from .models import Product
            product = Product.objects.filter(sku=obj.sku).first()
            return product.image_url if product else None
        except:
            return None


class APIConfigurationSerializer(serializers.ModelSerializer):
    """Serializer for APIConfiguration model"""
    
    class Meta:
        model = APIConfiguration
        fields = [
            'id', 'api_base_url', 'sync_interval_minutes', 'auto_sync_enabled',
            'last_sync_at', 'last_sync_status', 'last_sync_message',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'last_sync_at', 'last_sync_status', 'last_sync_message', 'created_at', 'updated_at']


class EmailSMSSettingsSerializer(serializers.ModelSerializer):
    """Serializer for EmailSMSSettings model"""
    
    class Meta:
        model = EmailSMSSettings
        fields = [
            'id', 'email_enabled', 'smtp_host', 'smtp_port', 'smtp_use_tls',
            'smtp_username', 'smtp_password', 'from_email', 'notification_recipients',
            'sms_enabled', 'twilio_account_sid', 'twilio_auth_token',
            'twilio_from_number', 'sms_recipients', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'smtp_password': {'write_only': True},
            'twilio_auth_token': {'write_only': True},
        }


class SyncLogSerializer(serializers.ModelSerializer):
    """Serializer for SyncLog model"""
    triggered_by_name = serializers.CharField(source='triggered_by.username', read_only=True)
    duration = serializers.FloatField(read_only=True)
    
    class Meta:
        model = SyncLog
        fields = [
            'id', 'started_at', 'completed_at', 'status', 'orders_fetched',
            'orders_created', 'orders_updated', 'products_created', 'products_updated',
            'error_message', 'triggered_by', 'triggered_by_name', 'duration'
        ]
        read_only_fields = ['id', 'started_at', 'completed_at']


# Custom serializers for specific API endpoints

class PickListItemSerializer(serializers.Serializer):
    """
    Serializer for aggregated pick list items
    Groups by SKU across all orders
    """
    sku = serializers.CharField()
    title = serializers.CharField()
    category = serializers.CharField()
    subcategory = serializers.CharField(allow_blank=True)
    vendor_name = serializers.CharField(allow_blank=True)
    variation_details = serializers.CharField(allow_blank=True)
    image_url = serializers.URLField(allow_null=True)
    needed = serializers.IntegerField()
    picked = serializers.IntegerField()
    remaining = serializers.IntegerField()
    store_quantity_available = serializers.IntegerField()


class PickActionSerializer(serializers.Serializer):
    """Serializer for pick action"""
    sku = serializers.CharField()
    qty = serializers.IntegerField(min_value=1)
    notes = serializers.CharField(required=False, allow_blank=True)


class NotInStockAllocationSerializer(serializers.Serializer):
    """Serializer for individual order allocation in not-in-stock action"""
    order_id = serializers.IntegerField()
    qty_short = serializers.IntegerField(min_value=1)


class NotInStockActionSerializer(serializers.Serializer):
    """Serializer for not-in-stock action"""
    sku = serializers.CharField()
    allocations = NotInStockAllocationSerializer(many=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class MarkPackedSerializer(serializers.Serializer):
    """Serializer for marking order as packed"""
    notes = serializers.CharField(required=False, allow_blank=True)


class SendNotificationSerializer(serializers.Serializer):
    """Serializer for sending out-of-stock notifications"""
    channel = serializers.ChoiceField(choices=['email', 'sms'])
    recipients = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        help_text="Optional: Override default recipients"
    )
    message = serializers.CharField(required=False, allow_blank=True)


class PickListStatsSerializer(serializers.Serializer):
    """Serializer for pick list statistics"""
    total_skus = serializers.IntegerField()
    total_items_needed = serializers.IntegerField()
    total_items_picked = serializers.IntegerField()
    total_items_remaining = serializers.IntegerField()
    total_orders = serializers.IntegerField()
    categories_count = serializers.IntegerField()


class ItemBatchAssignmentSerializer(serializers.Serializer):
    """Serializer for assigning item to shipment batch"""
    item_id = serializers.IntegerField()
    batch = serializers.IntegerField(min_value=1)


class SplitOrderSerializer(serializers.Serializer):
    """Serializer for splitting order into shipments"""
    item_batches = ItemBatchAssignmentSerializer(many=True)
    
    def validate_item_batches(self, value):
        """Ensure at least one item assigned"""
        if not value:
            raise serializers.ValidationError("At least one item must be assigned")
        return value
