"use client"

import { useState, useEffect } from "react"
import { Package, User, Clock, ChevronDown, ChevronUp, CheckCircle, Loader2, RotateCcw } from "lucide-react"
import { authService } from "@/services/auth.service"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ordersService } from "@/services/orders.service"
import { toast } from "sonner"

interface OrderItem {
  sku: string
  title: string
  qty_ordered: number
  qty_picked: number
  qty_short: number
}

interface ReadyOrder {
  id: number
  number: string
  customer_name: string
  created_at: string
  items?: OrderItem[]
  items_count?: number
  notes?: string
}

export function ReadyToPackPage() {
  const [orders, setOrders] = useState<ReadyOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set())
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [revertDialogOpen, setRevertDialogOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [packingOrder, setPackingOrder] = useState(false)
  const [revertingOrder, setRevertingOrder] = useState(false)
  const [userRole, setUserRole] = useState('')

  useEffect(() => {
    loadOrders()
    const user = authService.getStoredUser()
    if (user && user.role) {
      setUserRole(user.role)
    }
  }, [])

  const isAdminOrSuperadmin = userRole === 'admin' || userRole === 'superadmin'

  const loadOrders = async () => {
    try {
      setLoading(true)
      const data = await ordersService.getReadyToPack()
      setOrders(data)
    } catch (error: any) {
      console.error('Failed to load ready to pack orders:', error)
      toast.error('Failed to load orders: ' + (error.response?.data?.message || error.message))
    } finally {
      setLoading(false)
    }
  }

  const toggleOrderExpanded = (orderId: number) => {
    const newExpanded = new Set(expandedOrders)
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId)
    } else {
      newExpanded.add(orderId)
    }
    setExpandedOrders(newExpanded)
  }

  const handleMarkPackedClick = (orderId: number) => {
    setSelectedOrderId(orderId)
    setConfirmDialogOpen(true)
  }

  const handleConfirmMarkPacked = async () => {
    if (!selectedOrderId) return

    try {
      setPackingOrder(true)
      await ordersService.markPacked(selectedOrderId, 'Marked as packed from web app')
      toast.success('Order marked as packed successfully!')
      setConfirmDialogOpen(false)
      setSelectedOrderId(null)
      await loadOrders() // Reload list
    } catch (error: any) {
      console.error('Failed to mark as packed:', error)
      toast.error('Failed to mark as packed: ' + (error.response?.data?.message || error.message))
    } finally {
      setPackingOrder(false)
    }
  }

  const handleRevertClick = (orderId: number) => {
    setSelectedOrderId(orderId)
    setRevertDialogOpen(true)
  }

  const handleConfirmRevert = async () => {
    if (!selectedOrderId) return

    try {
      setRevertingOrder(true)
      await ordersService.revertToPicking(selectedOrderId)
      toast.success('Order reverted to picking state!')
      setRevertDialogOpen(false)
      setSelectedOrderId(null)
      await loadOrders()
    } catch (error: any) {
      console.error('Failed to revert order:', error)
      toast.error('Failed to revert: ' + (error.response?.data?.message || error.message))
    } finally {
      setRevertingOrder(false)
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`
    } else if (diffInMinutes < 1440) {
      const diffInHours = Math.floor(diffInMinutes / 60)
      return `${diffInHours}h ago`
    } else {
      const diffInDays = Math.floor(diffInMinutes / 1440)
      return `${diffInDays}d ago`
    }
  }

  const getOrderStatus = (order: ReadyOrder) => {
    if (!order.items || order.items.length === 0) return "complete"
    const hasShortages = order.items.some((item) => item.qty_short > 0)
    return hasShortages ? "partial" : "complete"
  }

  const getItemCount = (order: ReadyOrder) => {
    return order.items_count ?? order.items?.length ?? 0
  }

  const getShortageCount = (order: ReadyOrder) => {
    if (!order.items) return 0
    return order.items.reduce((sum, item) => sum + item.qty_short, 0)
  }

  const selectedOrder = orders.find(o => o.id === selectedOrderId)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading orders...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Ready to Pack</h1>
        <p className="text-muted-foreground">Orders ready for packing and shipping ({orders.length})</p>
      </div>

      <div className="space-y-3">
        {orders.map((order) => {
          const status = getOrderStatus(order)
          const shortageCount = getShortageCount(order)
          const itemCount = getItemCount(order)
          const isExpanded = expandedOrders.has(order.id)

          return (
            <Card key={order.id} className="overflow-hidden">
              <CardContent className="p-4">
                {/* Order Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-foreground">#{order.number}</h3>
                      {status === "partial" && (
                        <Badge variant="destructive" className="text-xs">
                          {shortageCount} Short
                        </Badge>
                      )}
                      {status === "complete" && (
                        <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                          Complete
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        <span>{order.customer_name || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Package className="h-4 w-4" />
                        <span>{itemCount} items</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{formatTimeAgo(order.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Collapsible Items */}
                {order.items && order.items.length > 0 && (
                  <Collapsible open={isExpanded} onOpenChange={() => toggleOrderExpanded(order.id)}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                        <span className="text-sm font-medium">
                          {isExpanded ? 'Hide' : 'Show'} Items ({itemCount})
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <div className="space-y-2 border-t border-border pt-3">
                        {order.items.map((item, index) => (
                          <div
                            key={index}
                            className="bg-muted/30 rounded-md p-3 text-sm"
                          >
                            <div className="font-medium mb-1">{item.title}</div>
                            <div className="text-xs text-muted-foreground mb-2">SKU: {item.sku}</div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs">Ordered: {item.qty_ordered}</span>
                              <span className="text-xs">Picked: {item.qty_picked}</span>
                              {item.qty_short > 0 && (
                                <span className="text-xs text-destructive font-medium">
                                  Short: {item.qty_short}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Action Buttons */}
                <div className="mt-4 pt-3 border-t border-border space-y-2">
                  <Button
                    onClick={() => handleMarkPackedClick(order.id)}
                    className="w-full"
                    size="lg"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as Packed
                  </Button>
                  
                  {isAdminOrSuperadmin && (
                    <Button
                      onClick={() => handleRevertClick(order.id)}
                      variant="outline"
                      className="w-full"
                      size="lg"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Revert to Picking
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}

        {orders.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Orders Ready</h3>
            <p className="text-muted-foreground">All orders have been packed and shipped!</p>
            <p className="text-sm text-muted-foreground mt-2">Orders will appear here when all items are picked</p>
          </div>
        )}
      </div>

      {/* Pack Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Pack Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark order <strong>#{selectedOrder?.number}</strong> as packed?
              {selectedOrder && (
                <div className="mt-2 text-sm">
                  <div>Customer: {selectedOrder.customer_name}</div>
                  <div>Items: {getItemCount(selectedOrder)}</div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={packingOrder}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmMarkPacked} disabled={packingOrder}>
              {packingOrder ? 'Processing...' : 'Yes, Mark as Packed'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revert Confirmation Dialog */}
      <AlertDialog open={revertDialogOpen} onOpenChange={setRevertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert to Picking</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revert order <strong>#{selectedOrder?.number}</strong> back to picking state?
              <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm">
                <strong>Warning:</strong> This will reset all items to unpicked state and move the order back to the pick list.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revertingOrder}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRevert} disabled={revertingOrder}>
              {revertingOrder ? 'Reverting...' : 'Yes, Revert to Picking'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
