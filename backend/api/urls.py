from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

# Create router for ViewSets
router = DefaultRouter()
router.register(r'users', views.UserViewSet, basename='user')
router.register(r'sync-logs', views.SyncLogViewSet, basename='synclog')
router.register(r'pick-events', views.PickEventViewSet, basename='pickevent')

urlpatterns = [
    # ============================================================================
    # Authentication
    # ============================================================================
    path('auth/login', views.login_view, name='login'),
    path('auth/logout', views.logout_view, name='logout'),
    path('auth/refresh', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me', views.current_user_view, name='current_user'),
    path('auth/change-password', views.change_password_view, name='change-password'),
    
    # ============================================================================
    # Pick List
    # ============================================================================
    path('picklist', views.pick_list_view, name='picklist'),
    path('picklist/stats', views.pick_list_stats_view, name='picklist-stats'),
    path('picklist/<str:sku>/orders', views.get_orders_for_sku_view, name='get-orders-for-sku'),
    path('pick', views.pick_action_view, name='pick'),
    path('not-in-stock', views.not_in_stock_action_view, name='not-in-stock'),
    
    # ============================================================================
    # Ready to Pack / Orders
    # ============================================================================
    path('orders/ready-to-pack', views.ready_to_pack_list_view, name='ready-to-pack'),
    path('orders/packed', views.packed_orders_list_view, name='packed-orders'),
    path('orders/<int:order_id>', views.order_detail_view, name='order-detail'),
    path('orders/<int:order_id>/mark-packed', views.mark_packed_view, name='mark-packed'),
    path('orders/<int:order_id>/revert-to-picking', views.revert_to_picking_view, name='revert-to-picking'),
    path('orders/<int:order_id>/change-state', views.change_order_state_view, name='change-order-state'),
    
    # ============================================================================
    # Out of Stock
    # ============================================================================
    path('out-of-stock', views.stock_exceptions_list_view, name='out-of-stock'),
    path('out-of-stock/export', views.stock_exceptions_export_view, name='out-of-stock-export'),
    path('out-of-stock/send', views.send_notification_view, name='out-of-stock-send'),
    path('out-of-stock/<int:exception_id>/resolve', views.resolve_stock_exception_view, name='resolve-stock-exception'),
    path('out-of-stock/<int:exception_id>/toggle-ordered', views.toggle_ordered_from_company_view, name='toggle-ordered-from-company'),
    path('out-of-stock/<int:exception_id>/toggle-na-cancel', views.toggle_na_cancel_view, name='toggle-na-cancel'),
    
    # ============================================================================
    # Admin
    # ============================================================================
    path('admin/sync', views.sync_now_view, name='sync-now'),
    path('admin/sync-status', views.sync_status_view, name='sync-status'),
    path('admin/settings', views.api_configuration_view, name='api-configuration'),
    path('admin/email-sms-settings', views.email_sms_settings_view, name='email-sms-settings'),
    path('admin/test-email', views.test_email_view, name='test-email'),
    path('admin/test-sms', views.test_sms_view, name='test-sms'),
    
    # ============================================================================
    # Router URLs (ViewSets)
    # ============================================================================
    path('', include(router.urls)),
]
