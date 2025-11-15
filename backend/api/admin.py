from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
    User, Product, Order, OrderItem, PickEvent,
    StockException, APIConfiguration, EmailSMSSettings, SyncLog
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['username', 'email', 'role', 'is_staff', 'is_active']
    list_filter = ['role', 'is_staff', 'is_active']
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Additional Info', {'fields': ('role', 'phone')}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Additional Info', {'fields': ('role', 'phone')}),
    )


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['sku', 'title', 'category', 'subcategory', 'price', 'store_quantity_available']
    list_filter = ['category', 'subcategory']
    search_fields = ['sku', 'title']
    ordering = ['category', 'sku']


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['number', 'customer_name', 'status', 'ready_to_pack', 'created_at']
    list_filter = ['status', 'ready_to_pack', 'created_at']
    search_fields = ['number', 'external_order_id', 'customer_name']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ['order', 'sku', 'qty_ordered', 'qty_picked', 'qty_short', 'qty_remaining']
    list_filter = ['category', 'order__status']
    search_fields = ['sku', 'title', 'order__number']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(PickEvent)
class PickEventAdmin(admin.ModelAdmin):
    list_display = ['order_item', 'qty', 'user', 'timestamp']
    list_filter = ['timestamp', 'user']
    search_fields = ['order_item__sku', 'order_item__order__number']
    readonly_fields = ['timestamp']
    ordering = ['-timestamp']


@admin.register(StockException)
class StockExceptionAdmin(admin.ModelAdmin):
    list_display = ['sku', 'product_title', 'qty_short', 'resolved', 'timestamp']
    list_filter = ['resolved', 'category', 'timestamp']
    search_fields = ['sku', 'product_title']
    readonly_fields = ['timestamp']
    ordering = ['-timestamp']


@admin.register(APIConfiguration)
class APIConfigurationAdmin(admin.ModelAdmin):
    list_display = ['api_base_url', 'sync_interval_minutes', 'auto_sync_enabled', 'last_sync_status']
    readonly_fields = ['last_sync_at', 'created_at', 'updated_at']
    
    def has_add_permission(self, request):
        # Only allow one configuration
        return not APIConfiguration.objects.exists()
    
    def has_delete_permission(self, request, obj=None):
        # Don't allow deletion
        return False


@admin.register(EmailSMSSettings)
class EmailSMSSettingsAdmin(admin.ModelAdmin):
    list_display = ['email_enabled', 'sms_enabled', 'updated_at']
    readonly_fields = ['created_at', 'updated_at']
    
    def has_add_permission(self, request):
        # Only allow one settings record
        return not EmailSMSSettings.objects.exists()
    
    def has_delete_permission(self, request, obj=None):
        # Don't allow deletion
        return False


@admin.register(SyncLog)
class SyncLogAdmin(admin.ModelAdmin):
    list_display = ['started_at', 'status', 'orders_fetched', 'orders_created', 'duration', 'triggered_by']
    list_filter = ['status', 'started_at']
    search_fields = ['error_message']
    readonly_fields = ['started_at', 'completed_at', 'duration']
    ordering = ['-started_at']
    
    def duration(self, obj):
        if obj.duration:
            return f"{obj.duration:.2f}s"
        return "In progress"
    duration.short_description = 'Duration'
