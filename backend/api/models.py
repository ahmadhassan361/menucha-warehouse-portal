from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator
from django.utils import timezone


class User(AbstractUser):
    """
    Custom User model with role-based permissions
    Roles: Staff, Admin, Superadmin
    """
    ROLE_CHOICES = [
        ('staff', 'Staff'),
        ('admin', 'Admin'),
        ('superadmin', 'Superadmin'),
    ]
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='staff')
    phone = models.CharField(max_length=20, blank=True, null=True)
    
    class Meta:
        db_table = 'users'
        ordering = ['username']
    
    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"


class Product(models.Model):
    """
    Product/Item master data
    """
    sku = models.CharField(max_length=100, unique=True, db_index=True)
    title = models.CharField(max_length=500)
    category = models.CharField(max_length=100, db_index=True)
    subcategory = models.CharField(max_length=100, blank=True)
    vendor_name = models.CharField(max_length=255, blank=True, null=True)
    variation_details = models.CharField(max_length=255, blank=True, null=True)
    image_url = models.URLField(max_length=1000, blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    weight = models.CharField(max_length=50, blank=True)
    item_type = models.CharField(max_length=50, default='product')
    store_quantity_available = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'products'
        ordering = ['category', 'sku']
        indexes = [
            models.Index(fields=['sku']),
            models.Index(fields=['category']),
        ]
    
    def __str__(self):
        return f"{self.sku} - {self.title}"


class Order(models.Model):
    """
    Order header information
    """
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('picking', 'Picking in Progress'),
        ('ready_to_pack', 'Ready to Pack'),
        ('packed', 'Packed'),
        ('cancelled', 'Cancelled'),
    ]
    
    external_order_id = models.CharField(max_length=100, unique=True, db_index=True)
    number = models.CharField(max_length=100, db_index=True)
    customer_name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open', db_index=True)
    ready_to_pack = models.BooleanField(default=False, db_index=True)
    
    packed_at = models.DateTimeField(null=True, blank=True)
    packed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='packed_orders')
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'orders'
        ordering = ['created_at']  # FIFO: oldest first
        indexes = [
            models.Index(fields=['external_order_id']),
            models.Index(fields=['status']),
            models.Index(fields=['ready_to_pack']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"Order #{self.number} - {self.customer_name}"
    
    def check_ready_to_pack(self):
        """
        Check if all items in this order are fully picked or marked as short
        Returns True if ready to pack
        """
        items = self.items.all()
        if not items.exists():
            return False
        
        for item in items:
            if item.qty_picked + item.qty_short < item.qty_ordered:
                return False
        
        return True
    
    def mark_as_ready(self):
        """Mark order as ready to pack"""
        self.ready_to_pack = True
        self.status = 'ready_to_pack'
        self.save(update_fields=['ready_to_pack', 'status', 'updated_at'])


class OrderItem(models.Model):
    """
    Line items within an order
    """
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='order_items')
    
    sku = models.CharField(max_length=100, db_index=True)
    title = models.CharField(max_length=500)
    category = models.CharField(max_length=100)
    image_url = models.URLField(max_length=1000, blank=True, null=True)
    
    qty_ordered = models.IntegerField(validators=[MinValueValidator(1)])
    qty_picked = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    qty_short = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'order_items'
        ordering = ['order__created_at', 'id']
        indexes = [
            models.Index(fields=['sku']),
            models.Index(fields=['order', 'sku']),
        ]
        unique_together = ['order', 'product']
    
    def __str__(self):
        return f"{self.order.number} - {self.sku} (x{self.qty_ordered})"
    
    @property
    def qty_remaining(self):
        """Calculate remaining quantity to pick"""
        return max(0, self.qty_ordered - self.qty_picked - self.qty_short)
    
    @property
    def is_complete(self):
        """Check if this item is fully picked or accounted for"""
        return self.qty_picked + self.qty_short >= self.qty_ordered


class PickEvent(models.Model):
    """
    Audit log for pick actions
    """
    order_item = models.ForeignKey(OrderItem, on_delete=models.CASCADE, related_name='pick_events')
    qty = models.IntegerField(validators=[MinValueValidator(1)])
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='pick_events')
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        db_table = 'pick_events'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['timestamp']),
            models.Index(fields=['order_item']),
        ]
    
    def __str__(self):
        return f"{self.user.username if self.user else 'Unknown'} picked {self.qty}x {self.order_item.sku} at {self.timestamp}"


class StockException(models.Model):
    """
    Out-of-stock / shortage tracking
    """
    sku = models.CharField(max_length=100, db_index=True)
    product_title = models.CharField(max_length=500)
    category = models.CharField(max_length=100)
    qty_short = models.IntegerField(validators=[MinValueValidator(1)])
    order_numbers = models.JSONField(default=list)  # List of order numbers affected
    
    reported_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='stock_exceptions')
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    resolved = models.BooleanField(default=False)
    ordered_from_company = models.BooleanField(default=False)  # Track if item ordered from supplier
    notes = models.TextField(blank=True)
    
    class Meta:
        db_table = 'stock_exceptions'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['sku']),
            models.Index(fields=['timestamp']),
            models.Index(fields=['resolved']),
        ]
    
    def __str__(self):
        return f"{self.sku} - Short {self.qty_short} units (Orders: {', '.join(map(str, self.order_numbers))})"


class APIConfiguration(models.Model):
    """
    Configuration for external API and sync settings
    Single row configuration
    """
    api_base_url = models.URLField(max_length=500)
    sync_interval_minutes = models.IntegerField(default=10, validators=[MinValueValidator(1)])
    auto_sync_enabled = models.BooleanField(default=True)
    
    last_sync_at = models.DateTimeField(null=True, blank=True)
    last_sync_status = models.CharField(max_length=20, default='never')  # success, error, never
    last_sync_message = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'api_configuration'
        verbose_name = 'API Configuration'
        verbose_name_plural = 'API Configuration'
    
    def __str__(self):
        return f"API Config - Sync every {self.sync_interval_minutes} min"
    
    def save(self, *args, **kwargs):
        # Ensure only one configuration exists
        if not self.pk and APIConfiguration.objects.exists():
            raise ValueError("Only one API configuration can exist")
        return super().save(*args, **kwargs)
    
    @classmethod
    def get_config(cls):
        """Get or create the single configuration instance"""
        config, created = cls.objects.get_or_create(
            id=1,
            defaults={
                'api_base_url': 'https://www.1800eichlers.com/api/picking/items/f8e2a1c9-4b7d-4e3f-9a2c-8d5e6f7a8b9c',
                'sync_interval_minutes': 10,
            }
        )
        return config


class EmailSMSSettings(models.Model):
    """
    Email and SMS configuration for notifications
    Single row configuration
    """
    # Email Settings
    email_enabled = models.BooleanField(default=False)
    smtp_host = models.CharField(max_length=255, blank=True)
    smtp_port = models.IntegerField(default=587, blank=True)
    smtp_use_tls = models.BooleanField(default=True)
    smtp_use_ssl = models.BooleanField(default=False)  # For port 465
    smtp_username = models.CharField(max_length=255, blank=True)
    smtp_password = models.CharField(max_length=255, blank=True)
    from_email = models.EmailField(blank=True)
    notification_recipients = models.JSONField(default=list)  # List of email addresses
    
    # SMS Settings
    sms_enabled = models.BooleanField(default=False)
    twilio_account_sid = models.CharField(max_length=255, blank=True)
    twilio_auth_token = models.CharField(max_length=255, blank=True)
    twilio_from_number = models.CharField(max_length=20, blank=True)
    sms_recipients = models.JSONField(default=list)  # List of phone numbers
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'email_sms_settings'
        verbose_name = 'Email/SMS Settings'
        verbose_name_plural = 'Email/SMS Settings'
    
    def __str__(self):
        return "Email/SMS Settings"
    
    def save(self, *args, **kwargs):
        # Ensure only one settings record exists
        if not self.pk and EmailSMSSettings.objects.exists():
            raise ValueError("Only one Email/SMS settings record can exist")
        return super().save(*args, **kwargs)
    
    @classmethod
    def get_settings(cls):
        """Get or create the single settings instance"""
        settings, created = cls.objects.get_or_create(id=1)
        return settings


class SyncLog(models.Model):
    """
    Log of sync operations with external API
    """
    STATUS_CHOICES = [
        ('success', 'Success'),
        ('error', 'Error'),
        ('in_progress', 'In Progress'),
    ]
    
    started_at = models.DateTimeField(auto_now_add=True, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='in_progress')
    
    orders_fetched = models.IntegerField(default=0)
    orders_created = models.IntegerField(default=0)
    orders_updated = models.IntegerField(default=0)
    products_created = models.IntegerField(default=0)
    products_updated = models.IntegerField(default=0)
    
    error_message = models.TextField(blank=True)
    detailed_errors = models.JSONField(default=list, blank=True)  # List of detailed error objects
    triggered_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    class Meta:
        db_table = 'sync_logs'
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['started_at']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"Sync at {self.started_at} - {self.status}"
    
    @property
    def duration(self):
        """Calculate sync duration"""
        if self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None
