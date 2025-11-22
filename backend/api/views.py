from rest_framework import viewsets, status, generics
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.http import HttpResponse
from django.utils import timezone
from django.db.models import Q, F
from drf_spectacular.utils import extend_schema, OpenApiParameter
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

from .models import (
    User, Product, Order, OrderItem, PickEvent,
    StockException, APIConfiguration, EmailSMSSettings, SyncLog
)
from .serializers import (
    UserSerializer, UserCreateSerializer, LoginSerializer,
    ProductSerializer, OrderSerializer, OrderListSerializer,
    OrderItemSerializer, PickEventSerializer, StockExceptionSerializer,
    APIConfigurationSerializer, EmailSMSSettingsSerializer, SyncLogSerializer,
    PickListItemSerializer, PickActionSerializer, NotInStockActionSerializer,
    MarkPackedSerializer, SendNotificationSerializer, PickListStatsSerializer,
    SplitOrderSerializer
)
from .permissions import (
    IsAdmin, IsPicker, IsPacker, IsPickerOrPacker,
    IsAdminOrReadOnly, IsAdminOrPicker, IsAdminOrPacker,
    IsSuperadmin, IsAdminOrSuperadmin, IsStaffOrAbove
)
from .services import (
    OrderImportService, PickService,
    StockExceptionService, NotificationService
)


# ============================================================================
# Authentication Views
# ============================================================================

@extend_schema(
    request=LoginSerializer,
    responses={200: UserSerializer}
)
@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """Login with username and password, returns JWT tokens"""
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data['user']
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        })
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """Logout (client should discard tokens)"""
    return Response({'message': 'Logged out successfully'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user_view(request):
    """Get current authenticated user info"""
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


# ============================================================================
# Pick List Views
# ============================================================================

@extend_schema(
    responses={200: PickListItemSerializer(many=True)}
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pick_list_view(request):
    """
    Get aggregated pick list grouped by SKU
    Shows needed, picked, and remaining quantities
    """
    pick_list = PickService.get_pick_list()
    serializer = PickListItemSerializer(pick_list, many=True)
    return Response(serializer.data)


@extend_schema(
    responses={200: PickListStatsSerializer}
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pick_list_stats_view(request):
    """Get statistics for the pick list"""
    stats = PickService.get_pick_list_stats()
    serializer = PickListStatsSerializer(stats)
    return Response(serializer.data)


@extend_schema(
    parameters=[
        OpenApiParameter('sort_by', str, description='Sort by field (picked_at, sku, order_number, category)'),
        OpenApiParameter('order', str, description='Sort order (asc, desc)'),
        OpenApiParameter('search', str, description='Search by SKU, order number, or title'),
        OpenApiParameter('category', str, description='Filter by category'),
        OpenApiParameter('subcategory', str, description='Filter by subcategory'),
    ],
    responses={200: OrderItemSerializer(many=True)}
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def picked_items_view(request):
    """
    Get all picked items that are not yet ready to pack
    Shows items with qty_picked > 0 from orders that are still in picking
    """
    # Get order items with picks but order not ready
    picked_items = OrderItem.objects.filter(
        qty_picked__gt=0,
        order__ready_to_pack=False,
        order__status__in=['open', 'picking']
    ).select_related(
        'order', 
        'product'
    ).prefetch_related(
        'pick_events__user'
    ).order_by('-pick_events__timestamp')
    
    # Apply search filter
    search = request.query_params.get('search', '').strip()
    if search:
        picked_items = picked_items.filter(
            Q(sku__icontains=search) |
            Q(title__icontains=search) |
            Q(order__number__icontains=search)
        )
    
    # Apply category filter
    category = request.query_params.get('category', '').strip()
    if category:
        picked_items = picked_items.filter(category=category)
    
    # Apply subcategory filter
    subcategory = request.query_params.get('subcategory', '').strip()
    if subcategory:
        picked_items = picked_items.filter(product__subcategory=subcategory)
    
    # Get unique items (in case of multiple pick events)
    seen_items = {}
    unique_items = []
    for item in picked_items:
        if item.id not in seen_items:
            seen_items[item.id] = True
            unique_items.append(item)
    
    # Apply sorting
    sort_by = request.query_params.get('sort_by', 'picked_at')
    sort_order = request.query_params.get('order', 'desc')
    
    if sort_by == 'sku':
        unique_items.sort(key=lambda x: x.sku, reverse=(sort_order == 'desc'))
    elif sort_by == 'order_number':
        unique_items.sort(key=lambda x: x.order.number, reverse=(sort_order == 'desc'))
    elif sort_by == 'category':
        unique_items.sort(key=lambda x: x.category, reverse=(sort_order == 'desc'))
    else:  # picked_at (default)
        unique_items.sort(
            key=lambda x: x.pick_events.latest('timestamp').timestamp if x.pick_events.exists() else x.updated_at,
            reverse=(sort_order == 'desc')
        )
    
    # Build response with pick event details
    result = []
    for item in unique_items:
        # Get latest pick event for user info
        latest_pick = item.pick_events.order_by('-timestamp').first()
        
        item_data = {
            'id': item.id,
            'order_id': item.order.id,
            'order_number': item.order.number,
            'customer_name': item.order.customer_name,
            'sku': item.sku,
            'title': item.title,
            'category': item.category,
            'subcategory': item.product.subcategory if item.product else '',
            'vendor_name': item.product.vendor_name if item.product else '',
            'variation_details': item.product.variation_details if item.product else '',
            'image_url': item.image_url,
            'qty_ordered': item.qty_ordered,
            'qty_picked': item.qty_picked,
            'qty_short': item.qty_short,
            'qty_remaining': item.qty_remaining,
            'picked_by': latest_pick.user.username if latest_pick and latest_pick.user else 'Unknown',
            'picked_by_id': latest_pick.user.id if latest_pick and latest_pick.user else None,
            'picked_at': latest_pick.timestamp if latest_pick else item.updated_at,
            'created_at': item.created_at,
        }
        result.append(item_data)
    
    return Response(result)


@extend_schema(
    request=PickActionSerializer,
    responses={200: {'message': 'string', 'affected_orders': 'array'}}
)
@api_view(['POST'])
@permission_classes([IsAdminOrPicker])
def pick_action_view(request):
    """
    Pick items for a given SKU with FIFO allocation
    Allocates to oldest outstanding orders first
    """
    serializer = PickActionSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    sku = serializer.validated_data['sku']
    qty = serializer.validated_data['qty']
    notes = serializer.validated_data.get('notes', '')
    
    success, message, affected_order_ids = PickService.pick_items(
        sku=sku,
        qty=qty,
        user=request.user,
        notes=notes
    )
    
    if success:
        return Response({
            'message': message,
            'affected_orders': affected_order_ids
        })
    else:
        return Response(
            {'error': message},
            status=status.HTTP_400_BAD_REQUEST
        )


@extend_schema(
    request=NotInStockActionSerializer,
    responses={200: {'message': 'string', 'affected_orders': 'array'}}
)
@api_view(['POST'])
@permission_classes([IsAdminOrPicker])
def not_in_stock_action_view(request):
    """
    Mark items as not in stock for specific orders
    Creates stock exception records
    """
    serializer = NotInStockActionSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    sku = serializer.validated_data['sku']
    allocations = serializer.validated_data['allocations']
    notes = serializer.validated_data.get('notes', '')
    
    success, message, affected_order_ids = StockExceptionService.mark_not_in_stock(
        sku=sku,
        allocations=allocations,
        user=request.user,
        notes=notes
    )
    
    if success:
        return Response({
            'message': message,
            'affected_orders': affected_order_ids
        })
    else:
        return Response(
            {'error': message},
            status=status.HTTP_400_BAD_REQUEST
        )


# ============================================================================
# Ready to Pack Views
# ============================================================================

@extend_schema(
    responses={200: OrderSerializer(many=True)}
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ready_to_pack_list_view(request):
    """Get list of orders ready to pack with items"""
    orders = Order.objects.filter(
        ready_to_pack=True,
        status='ready_to_pack'
    ).prefetch_related('items').order_by('created_at')
    
    serializer = OrderSerializer(orders, many=True)
    return Response(serializer.data)


@extend_schema(
    responses={200: OrderSerializer}
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def order_detail_view(request, order_id):
    """Get detailed order information including all items"""
    try:
        order = Order.objects.prefetch_related('items').get(id=order_id)
        serializer = OrderSerializer(order)
        return Response(serializer.data)
    except Order.DoesNotExist:
        return Response(
            {'error': 'Order not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@extend_schema(
    request=MarkPackedSerializer,
    responses={200: {'message': 'string'}}
)
@api_view(['POST'])
@permission_classes([IsAdminOrPacker])
def mark_packed_view(request, order_id):
    """Mark an order shipment as packed and advance to next shipment if applicable"""
    try:
        order = Order.objects.get(id=order_id)
        
        if not order.ready_to_pack:
            return Response(
                {'error': 'Order is not ready to pack'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if this is the last shipment
        if order.current_shipment >= order.total_shipments:
            # Last shipment - mark order as fully packed
            order.status = 'packed'
            order.packed_at = timezone.now()
            order.packed_by = request.user
            order.save(update_fields=['status', 'packed_at', 'packed_by', 'updated_at'])
            
            logger.info(f"Order {order.number} fully packed (shipment {order.current_shipment} of {order.total_shipments})")
            
            return Response({
                'message': f'Order {order.number} marked as packed (all {order.total_shipments} shipments complete)'
            })
        else:
            # Not the last shipment - advance to next shipment
            current_shipment = order.current_shipment
            order.current_shipment += 1
            order.status = 'picking'  # Back to picking for next shipment
            order.ready_to_pack = False
            order.save(update_fields=['current_shipment', 'status', 'ready_to_pack', 'updated_at'])
            
            logger.info(
                f"Order {order.number} shipment {current_shipment} of {order.total_shipments} packed. "
                f"Advanced to shipment {order.current_shipment}"
            )
            
            return Response({
                'message': f'Shipment {current_shipment} of {order.total_shipments} packed. Order advanced to shipment {order.current_shipment}',
                'next_shipment': order.current_shipment,
                'total_shipments': order.total_shipments
            })
        
    except Order.DoesNotExist:
        return Response(
            {'error': 'Order not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@extend_schema(
    parameters=[
        OpenApiParameter('from_date', str, description='Filter from date (YYYY-MM-DD)'),
        OpenApiParameter('to_date', str, description='Filter to date (YYYY-MM-DD)'),
        OpenApiParameter('search', str, description='Search by order number'),
    ],
    responses={200: OrderListSerializer(many=True)}
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def packed_orders_list_view(request):
    """Get list of packed orders with optional filters"""
    from_date = request.query_params.get('from_date')
    to_date = request.query_params.get('to_date')
    search = request.query_params.get('search', '').strip()
    
    # Start with packed orders
    orders = Order.objects.filter(status='packed').order_by('-packed_at')
    
    # Apply date filters
    if from_date:
        try:
            from_date_obj = datetime.strptime(from_date, '%Y-%m-%d')
            orders = orders.filter(packed_at__gte=from_date_obj)
        except ValueError:
            pass
    
    if to_date:
        try:
            to_date_obj = datetime.strptime(to_date, '%Y-%m-%d') + timedelta(days=1)
            orders = orders.filter(packed_at__lt=to_date_obj)
        except ValueError:
            pass
    
    # Apply search filter
    if search:
        orders = orders.filter(
            Q(number__icontains=search) |
            Q(external_order_id__icontains=search) |
            Q(customer_name__icontains=search)
        )
    
    serializer = OrderListSerializer(orders, many=True)
    return Response(serializer.data)


# ============================================================================
# Out of Stock Views
# ============================================================================

@extend_schema(
    parameters=[
        OpenApiParameter('resolved', bool, description='Filter by resolved status'),
        OpenApiParameter('from_date', str, description='Filter from date (YYYY-MM-DD)'),
        OpenApiParameter('to_date', str, description='Filter to date (YYYY-MM-DD)'),
    ],
    responses={200: StockExceptionSerializer(many=True)}
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stock_exceptions_list_view(request):
    """Get list of stock exceptions with optional filters"""
    resolved = request.query_params.get('resolved')
    from_date = request.query_params.get('from_date')
    to_date = request.query_params.get('to_date')
    
    # Convert string to boolean
    if resolved is not None:
        resolved = resolved.lower() == 'true'
    
    # Parse dates
    from_date_obj = None
    to_date_obj = None
    
    if from_date:
        try:
            from_date_obj = datetime.strptime(from_date, '%Y-%m-%d')
        except ValueError:
            pass
    
    if to_date:
        try:
            to_date_obj = datetime.strptime(to_date, '%Y-%m-%d') + timedelta(days=1)
        except ValueError:
            pass
    
    exceptions = StockExceptionService.get_stock_exceptions(
        resolved=resolved,
        from_date=from_date_obj,
        to_date=to_date_obj
    )
    
    serializer = StockExceptionSerializer(exceptions, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stock_exceptions_export_view(request):
    """Export stock exceptions to CSV"""
    resolved = request.query_params.get('resolved')
    if resolved is not None:
        resolved = resolved.lower() == 'true'
        exceptions = StockException.objects.filter(resolved=resolved).order_by('-timestamp')
    else:
        exceptions = StockException.objects.all().order_by('-timestamp')
    
    csv_content = NotificationService.export_exceptions_to_csv(exceptions)
    
    response = HttpResponse(csv_content, content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="stock_exceptions.csv"'
    return response


@extend_schema(
    request=SendNotificationSerializer,
    responses={200: {'message': 'string'}}
)
@api_view(['POST'])
@permission_classes([IsAdmin])
def send_notification_view(request):
    """Send out-of-stock notification via email or SMS"""
    serializer = SendNotificationSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    channel = serializer.validated_data['channel']
    recipients = serializer.validated_data.get('recipients')
    custom_message = serializer.validated_data.get('message')
    
    # Get unresolved exceptions
    exceptions = StockException.objects.filter(resolved=False)
    
    if channel == 'email':
        success, message = NotificationService.send_email_notification(
            recipients=recipients,
            message=custom_message,
            exceptions=exceptions
        )
    else:  # SMS
        success, message = NotificationService.send_sms_notification(
            recipients=recipients,
            message=custom_message,
            exceptions=exceptions
        )
    
    if success:
        return Response({'message': message})
    else:
        return Response(
            {'error': message},
            status=status.HTTP_400_BAD_REQUEST
        )


# ============================================================================
# Admin Views
# ============================================================================

@api_view(['POST'])
@permission_classes([IsAdmin])
def sync_now_view(request):
    """Manually trigger order sync from external API"""
    service = OrderImportService(triggered_by=request.user)
    success, message, stats = service.sync_orders()
    
    if success:
        return Response({
            'message': message,
            'stats': stats
        })
    else:
        return Response(
            {'error': message, 'stats': stats},
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sync_status_view(request):
    """Get last sync status"""
    config = APIConfiguration.get_config()
    
    return Response({
        'last_sync_at': config.last_sync_at,
        'last_sync_status': config.last_sync_status,
        'last_sync_message': config.last_sync_message,
        'auto_sync_enabled': config.auto_sync_enabled,
        'sync_interval_minutes': config.sync_interval_minutes,
    })


@api_view(['GET', 'PUT'])
@permission_classes([IsSuperadmin])
def api_configuration_view(request):
    """Get or update API configuration (Superadmin only)"""
    config = APIConfiguration.get_config()
    
    if request.method == 'GET':
        serializer = APIConfigurationSerializer(config)
        return Response(serializer.data)
    
    elif request.method == 'PUT':
        serializer = APIConfigurationSerializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT'])
@permission_classes([IsSuperadmin])
def email_sms_settings_view(request):
    """Get or update email/SMS settings (Superadmin only)"""
    settings_obj = EmailSMSSettings.get_settings()
    
    if request.method == 'GET':
        serializer = EmailSMSSettingsSerializer(settings_obj)
        return Response(serializer.data)
    
    elif request.method == 'PUT':
        serializer = EmailSMSSettingsSerializer(settings_obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsSuperadmin])
def test_email_view(request):
    """Test email configuration (Superadmin only)"""
    success, message = NotificationService.test_email_settings()
    if success:
        return Response({'message': message})
    else:
        return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsSuperadmin])
def test_sms_view(request):
    """Test SMS configuration (Superadmin only)"""
    success, message = NotificationService.test_sms_settings()
    if success:
        return Response({'message': message})
    else:
        return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)


# ============================================================================
# User Management Views (Admin only)
# ============================================================================

class UserViewSet(viewsets.ModelViewSet):
    """ViewSet for user management (Admin or Superadmin only)"""
    queryset = User.objects.all()
    permission_classes = [IsAdminOrSuperadmin]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer
    
    def perform_create(self, serializer):
        serializer.save()
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrSuperadmin])
    def reset_password(self, request, pk=None):
        """Reset user password (Admin/Superadmin only)"""
        user = self.get_object()
        new_password = request.data.get('new_password')
        
        if not new_password:
            return Response(
                {'error': 'new_password is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(new_password) < 8:
            return Response(
                {'error': 'Password must be at least 8 characters'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.set_password(new_password)
        user.save()
        
        return Response({
            'message': f'Password reset successfully for user {user.username}'
        })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    """Change own password (All authenticated users)"""
    current_password = request.data.get('current_password')
    new_password = request.data.get('new_password')
    
    if not current_password or not new_password:
        return Response(
            {'error': 'current_password and new_password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not request.user.check_password(current_password):
        return Response(
            {'error': 'Current password is incorrect'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if len(new_password) < 8:
        return Response(
            {'error': 'Password must be at least 8 characters'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    request.user.set_password(new_password)
    request.user.save()
    
    return Response({
        'message': 'Password changed successfully'
    })


@api_view(['POST'])
@permission_classes([IsAdminOrSuperadmin])
def revert_to_picking_view(request, order_id):
    """Revert order from ready-to-pack to picking (Admin/Superadmin only)"""
    try:
        order = Order.objects.prefetch_related('items').get(id=order_id)
        
        if order.status not in ['ready_to_pack', 'packed']:
            return Response(
                {'error': 'Order must be in ready-to-pack or packed status'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Reset order status
        order.status = 'open'
        order.ready_to_pack = False
        order.packed_at = None
        order.packed_by = None
        
        # Reset all items to unpicked state
        for item in order.items.all():
            item.qty_picked = 0
            item.save(update_fields=['qty_picked', 'updated_at'])
        
        order.save(update_fields=['status', 'ready_to_pack', 'packed_at', 'packed_by', 'updated_at'])
        
        return Response({
            'message': f'Order {order.number} reverted to picking state'
        })
        
    except Order.DoesNotExist:
        return Response(
            {'error': 'Order not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([IsAdminOrSuperadmin])
def change_order_state_view(request, order_id):
    """Change order state (Admin/Superadmin only)"""
    try:
        order = Order.objects.get(id=order_id)
        new_state = request.data.get('state')
        
        if not new_state:
            return Response(
                {'error': 'state parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if new_state not in ['open', 'ready_to_pack', 'packed']:
            return Response(
                {'error': 'Invalid state. Must be: open, ready_to_pack, or packed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update order state
        order.status = new_state
        
        if new_state == 'ready_to_pack':
            order.ready_to_pack = True
            order.packed_at = None
            order.packed_by = None
        elif new_state == 'packed':
            order.ready_to_pack = True
            if not order.packed_at:
                order.packed_at = timezone.now()
            if not order.packed_by:
                order.packed_by = request.user
        else:  # open
            order.ready_to_pack = False
            order.packed_at = None
            order.packed_by = None
        
        order.save(update_fields=['status', 'ready_to_pack', 'packed_at', 'packed_by', 'updated_at'])
        
        return Response({
            'message': f'Order {order.number} state changed to {new_state}'
        })
        
    except Order.DoesNotExist:
        return Response(
            {'error': 'Order not found'},
            status=status.HTTP_404_NOT_FOUND
        )


# ============================================================================
# Additional ViewSets
# ============================================================================

class SyncLogViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing sync logs"""
    queryset = SyncLog.objects.all().order_by('-started_at')
    serializer_class = SyncLogSerializer
    permission_classes = [IsAuthenticated]


class PickEventViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing pick events (audit log)"""
    queryset = PickEvent.objects.all().order_by('-timestamp')
    serializer_class = PickEventSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by date range if provided
        from_date = self.request.query_params.get('from_date')
        to_date = self.request.query_params.get('to_date')
        
        if from_date:
            try:
                from_date_obj = datetime.strptime(from_date, '%Y-%m-%d')
                queryset = queryset.filter(timestamp__gte=from_date_obj)
            except ValueError:
                pass
        
        if to_date:
            try:
                to_date_obj = datetime.strptime(to_date, '%Y-%m-%d') + timedelta(days=1)
                queryset = queryset.filter(timestamp__lt=to_date_obj)
            except ValueError:
                pass
        
        return queryset


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def resolve_stock_exception_view(request, exception_id):
    """Mark a stock exception as resolved (back in stock)"""
    success, message = StockExceptionService.resolve_exception(exception_id, request.user)
    
    if success:
        return Response({'message': message}, status=status.HTTP_200_OK)
    else:
        return Response({'error': message}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def toggle_ordered_from_company_view(request, exception_id):
    """Toggle the ordered_from_company status for a stock exception"""
    try:
        exception = StockException.objects.get(id=exception_id)
        exception.ordered_from_company = not exception.ordered_from_company
        exception.save(update_fields=['ordered_from_company'])
        
        status_text = "ordered from company" if exception.ordered_from_company else "not ordered yet"
        return Response({
            'message': f'{exception.sku} marked as {status_text}',
            'ordered_from_company': exception.ordered_from_company
        }, status=status.HTTP_200_OK)
    except StockException.DoesNotExist:
        return Response(
            {'error': 'Stock exception not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def toggle_na_cancel_view(request, exception_id):
    """Toggle the na_cancel status for a stock exception"""
    try:
        exception = StockException.objects.get(id=exception_id)
        exception.na_cancel = not exception.na_cancel
        exception.save(update_fields=['na_cancel'])
        
        status_text = "N/A - Cancel" if exception.na_cancel else "active"
        
        # If marking as cancelled, check if affected orders are now ready to pack
        orders_made_ready = []
        if exception.na_cancel:
            # Get all affected orders
            affected_orders = Order.objects.filter(
                number__in=exception.order_numbers,
                ready_to_pack=False,
                status__in=['open', 'picking']
            )
            
            for order in affected_orders:
                # Check if order is now ready to pack
                if order.check_ready_to_pack():
                    order.mark_as_ready()
                    orders_made_ready.append(order.number)
                    logger.info(f"Order {order.number} is now ready to pack after marking {exception.sku} as cancelled")
        
        message = f'{exception.sku} marked as {status_text}'
        if orders_made_ready:
            message += f'. Orders now ready to pack: {", ".join(orders_made_ready)}'
        
        return Response({
            'message': message,
            'na_cancel': exception.na_cancel,
            'orders_made_ready': orders_made_ready
        }, status=status.HTTP_200_OK)
    except StockException.DoesNotExist:
        return Response(
            {'error': 'Stock exception not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_orders_for_sku_view(request, sku):
    """Get all orders that need a specific SKU (for not-in-stock dialog)"""
    try:
        # Get all open/picking orders (not packed) that have this SKU
        order_items = OrderItem.objects.filter(
            sku=sku,
            order__status__in=['open', 'picking'],
            order__ready_to_pack=False
        ).select_related('order').order_by('order__created_at')
        
        if not order_items.exists():
            return Response({'error': f'No open orders found for SKU: {sku}'}, status=status.HTTP_404_NOT_FOUND)
        
        orders_data = []
        for item in order_items:
            if item.qty_remaining > 0:  # Only show orders with remaining qty
                orders_data.append({
                    'order_id': item.order.id,
                    'order_number': item.order.number,
                    'customer_name': item.order.customer_name,
                    'qty_ordered': item.qty_ordered,
                    'qty_picked': item.qty_picked,
                    'qty_short': item.qty_short,
                    'qty_remaining': item.qty_remaining,
                    'created_at': item.order.created_at
                })
        
        if not orders_data:
            return Response({'error': f'All orders for SKU {sku} are already picked or marked short'}, status=status.HTTP_404_NOT_FOUND)
        
        return Response({
            'sku': sku,
            'total_remaining': sum(o['qty_remaining'] for o in orders_data),
            'orders': orders_data
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error getting orders for SKU {sku}: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================================================
# Order Status Views
# ============================================================================

@extend_schema(
    parameters=[
        OpenApiParameter('status', str, description='Filter by status (open, picking, ready_to_pack, packed)'),
        OpenApiParameter('search', str, description='Search by order number or customer name'),
    ],
    responses={200: OrderSerializer(many=True)}
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def order_status_list_view(request):
    """
    Get detailed order status with picking progress
    By default shows orders before ready-to-pack (open, picking)
    """
    status_filter = request.query_params.get('status', 'in_progress')
    search = request.query_params.get('search', '').strip()
    
    # Filter orders based on status
    if status_filter == 'in_progress':
        # Default: show all orders not yet ready to pack
        orders = Order.objects.filter(
            status__in=['open', 'picking'],
            ready_to_pack=False
        )
    elif status_filter == 'all':
        orders = Order.objects.all()
    else:
        orders = Order.objects.filter(status=status_filter)
    
    # Apply search filter
    if search:
        orders = orders.filter(
            Q(number__icontains=search) |
            Q(customer_name__icontains=search)
        )
    
    # Get orders with related items and pick events
    orders = orders.prefetch_related(
        'items__product',
        'items__pick_events__user'
    ).order_by('created_at')
    
    # Build detailed response
    result = []
    for order in orders:
        items_data = []
        for item in order.items.all():
            # Get latest pick event for this item
            latest_pick = item.pick_events.order_by('-timestamp').first()
            
            items_data.append({
                'id': item.id,
                'sku': item.sku,
                'title': item.title,
                'category': item.category,
                'subcategory': item.product.subcategory if item.product else '',
                'vendor_name': item.product.vendor_name if item.product else '',
                'variation_details': item.product.variation_details if item.product else '',
                'image_url': item.image_url,
                'qty_ordered': item.qty_ordered,
                'qty_picked': item.qty_picked,
                'qty_short': item.qty_short,
                'qty_remaining': item.qty_remaining,
                'shipment_batch': item.shipment_batch,
                'picked_by': latest_pick.user.username if latest_pick and latest_pick.user else None,
                'picked_at': latest_pick.timestamp if latest_pick else None,
            })
        
        # Calculate order progress
        total_items = order.items.count()
        items_with_picks = order.items.filter(qty_picked__gt=0).count()
        items_with_shorts = order.items.filter(qty_short__gt=0).count()
        fully_picked_items = order.items.filter(qty_picked=F('qty_ordered')).count()
        
        result.append({
            'id': order.id,
            'number': order.number,
            'customer_name': order.customer_name,
            'status': order.status,
            'ready_to_pack': order.ready_to_pack,
            'total_shipments': order.total_shipments,
            'current_shipment': order.current_shipment,
            'created_at': order.created_at,
            'updated_at': order.updated_at,
            'customer_message': order.customer_message,
            'email_sent': order.email_sent,
            'items': items_data,
            'progress': {
                'total_items': total_items,
                'items_with_picks': items_with_picks,
                'items_with_shorts': items_with_shorts,
                'fully_picked_items': fully_picked_items,
                'completion_percent': int((fully_picked_items / total_items * 100)) if total_items > 0 else 0,
            }
        })
    
    return Response(result)


@extend_schema(
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'customer_message': {'type': 'string'},
                'email_sent': {'type': 'boolean'},
            }
        }
    },
    responses={200: {'message': 'string'}}
)
@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_order_message_view(request, order_id):
    """Update customer message and email sent status for an order"""
    try:
        order = Order.objects.get(id=order_id)
        
        customer_message = request.data.get('customer_message')
        email_sent = request.data.get('email_sent')
        
        if customer_message is not None:
            order.customer_message = customer_message
        
        if email_sent is not None:
            order.email_sent = email_sent
        
        order.save(update_fields=['customer_message', 'email_sent', 'updated_at'])
        
        return Response({
            'message': 'Order updated successfully',
            'customer_message': order.customer_message,
            'email_sent': order.email_sent
        })
        
    except Order.DoesNotExist:
        return Response(
            {'error': 'Order not found'},
            status=status.HTTP_404_NOT_FOUND
        )


# ============================================================================
# Order Splitting Views
# ============================================================================

@extend_schema(
    request=SplitOrderSerializer,
    responses={200: {'message': 'string', 'total_shipments': 'integer'}}
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def split_order_view(request, order_id):
    """
    Split order into multiple shipments by assigning items to batches
    """
    try:
        order = Order.objects.prefetch_related('items').get(id=order_id)
        
        # Validate order can be split
        if order.ready_to_pack or order.status == 'packed':
            return Response(
                {'error': 'Cannot split order that is already ready to pack or packed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = SplitOrderSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        item_batches = serializer.validated_data['item_batches']
        
        # Validate all items belong to this order
        item_ids = [ib['item_id'] for ib in item_batches]
        order_item_ids = list(order.items.values_list('id', flat=True))
        
        invalid_items = set(item_ids) - set(order_item_ids)
        if invalid_items:
            return Response(
                {'error': f'Invalid item IDs: {invalid_items}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update item batch assignments
        max_batch = 1
        for item_batch in item_batches:
            item = OrderItem.objects.get(id=item_batch['item_id'])
            item.shipment_batch = item_batch['batch']
            item.save(update_fields=['shipment_batch', 'updated_at'])
            max_batch = max(max_batch, item_batch['batch'])
        
        # Update order shipment info
        order.total_shipments = max_batch
        order.current_shipment = 1
        order.save(update_fields=['total_shipments', 'current_shipment', 'updated_at'])
        
        logger.info(
            f"Order {order.number} split into {max_batch} shipments by {request.user.username}"
        )
        
        return Response({
            'message': f'Order split into {max_batch} shipments',
            'total_shipments': max_batch,
            'current_shipment': 1
        })
        
    except Order.DoesNotExist:
        return Response(
            {'error': 'Order not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error splitting order {order_id}: {str(e)}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def unsplit_order_view(request, order_id):
    """
    Revert order split - reset all items to batch 1
    """
    try:
        order = Order.objects.prefetch_related('items').get(id=order_id)
        
        # Validate order can be unsplit
        if order.ready_to_pack or order.status == 'packed':
            return Response(
                {'error': 'Cannot unsplit order that is already ready to pack or packed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Reset all items to batch 1
        order.items.all().update(shipment_batch=1)
        
        # Reset order shipment info
        order.total_shipments = 1
        order.current_shipment = 1
        order.save(update_fields=['total_shipments', 'current_shipment', 'updated_at'])
        
        logger.info(f"Order {order.number} unsplit by {request.user.username}")
        
        return Response({
            'message': 'Order split reverted - all items reset to single shipment'
        })
        
    except Order.DoesNotExist:
        return Response(
            {'error': 'Order not found'},
            status=status.HTTP_404_NOT_FOUND
        )
