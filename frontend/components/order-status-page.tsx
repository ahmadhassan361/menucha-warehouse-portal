"use client"

import { useState, useEffect } from "react"
import { Search, RefreshCw, ChevronDown, ChevronUp, Package, CheckCircle, AlertTriangle, Clock, User, Loader2, X, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { orderStatusService, OrderStatus } from "@/services/order-status.service"
import { SplitOrderDialog } from "@/components/split-order-dialog"
import { toast } from "sonner"

export function OrderStatusPage() {
  const [orders, setOrders] = useState<OrderStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<'in_progress' | 'all' | 'open' | 'picking' | 'ready_to_pack' | 'packed'>('in_progress')
  const [emailFilter, setEmailFilter] = useState<'all' | 'sent' | 'unsent'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'progress_high' | 'progress_low'>('newest')
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set())
  const [editingMessages, setEditingMessages] = useState<Record<number, string>>({})
  const [savingOrders, setSavingOrders] = useState<Set<number>>(new Set())
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState<string>("")
  const [splitDialogOpen, setSplitDialogOpen] = useState(false)
  const [selectedOrderForSplit, setSelectedOrderForSplit] = useState<OrderStatus | null>(null)

  useEffect(() => {
    loadOrders()
    
    // Poll for updates every 30 seconds
    const interval = setInterval(loadOrders, 30000)
    return () => clearInterval(interval)
  }, [statusFilter, sortBy, searchTerm])

  // Apply sorting when sortBy changes
  useEffect(() => {
    if (orders.length > 0) {
      const sortedData = sortOrders(orders, sortBy)
      setOrders(sortedData)
    }
  }, [sortBy])

  const loadOrders = async () => {
    try {
      setLoading(true)
      const data = await orderStatusService.getOrderStatus({
        status: statusFilter,
        search: searchTerm || undefined,
      })
      
      // Apply sorting
      const sortedData = sortOrders(data, sortBy)
      setOrders(sortedData)
    } catch (error: any) {
      console.error('Failed to load orders:', error)
      toast.error('Failed to load orders: ' + (error.response?.data?.message || error.message))
    } finally {
      setLoading(false)
    }
  }

  const sortOrders = (ordersToSort: OrderStatus[], sortType: typeof sortBy) => {
    const sorted = [...ordersToSort]
    
    switch (sortType) {
      case 'newest':
        return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      case 'progress_high':
        return sorted.sort((a, b) => b.progress.completion_percent - a.progress.completion_percent)
      case 'progress_low':
        return sorted.sort((a, b) => a.progress.completion_percent - b.progress.completion_percent)
      default:
        return sorted
    }
  }

  const toggleOrderExpand = (orderId: number) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) {
        newSet.delete(orderId)
      } else {
        newSet.add(orderId)
      }
      return newSet
    })
  }

  const handleMessageChange = (orderId: number, message: string) => {
    setEditingMessages(prev => ({ ...prev, [orderId]: message }))
  }

  const handleEmailSentToggle = async (order: OrderStatus) => {
    try {
      setSavingOrders(prev => new Set(prev).add(order.id))
      await orderStatusService.updateOrderMessage(order.id, {
        email_sent: !order.email_sent
      })
      
      // Update local state
      setOrders(prev => prev.map(o => 
        o.id === order.id ? { ...o, email_sent: !o.email_sent } : o
      ))
      
      toast.success('Email status updated')
    } catch (error: any) {
      console.error('Failed to update email status:', error)
      toast.error('Failed to update: ' + (error.response?.data?.message || error.message))
    } finally {
      setSavingOrders(prev => {
        const newSet = new Set(prev)
        newSet.delete(order.id)
        return newSet
      })
    }
  }

  const handleSaveMessage = async (order: OrderStatus) => {
    const message = editingMessages[order.id] ?? order.customer_message
    
    try {
      setSavingOrders(prev => new Set(prev).add(order.id))
      await orderStatusService.updateOrderMessage(order.id, {
        customer_message: message
      })
      
      // Update local state
      setOrders(prev => prev.map(o => 
        o.id === order.id ? { ...o, customer_message: message } : o
      ))
      
      // Clear editing state
      setEditingMessages(prev => {
        const newState = { ...prev }
        delete newState[order.id]
        return newState
      })
      
      toast.success('Message saved')
    } catch (error: any) {
      console.error('Failed to save message:', error)
      toast.error('Failed to save: ' + (error.response?.data?.message || error.message))
    } finally {
      setSavingOrders(prev => {
        const newSet = new Set(prev)
        newSet.delete(order.id)
        return newSet
      })
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-500'
      case 'picking':
        return 'bg-yellow-500'
      case 'ready_to_pack':
        return 'bg-green-500'
      case 'packed':
        return 'bg-gray-500'
      default:
        return 'bg-gray-400'
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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

  const handleSplitOrder = (order: OrderStatus) => {
    setSelectedOrderForSplit(order)
    setSplitDialogOpen(true)
  }

  const handleConfirmSplit = async (itemBatches: { item_id: number; batch: number }[]) => {
    if (!selectedOrderForSplit) return

    try {
      await orderStatusService.splitOrder(selectedOrderForSplit.id, { item_batches: itemBatches })
      toast.success(`Order #${selectedOrderForSplit.number} split successfully`)
      loadOrders() // Reload to show updated data
    } catch (error: any) {
      console.error('Failed to split order:', error)
      toast.error('Failed to split order: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleUnsplitOrder = async (order: OrderStatus) => {
    try {
      await orderStatusService.unsplitOrder(order.id)
      toast.success(`Order #${order.number} unsplit successfully`)
      loadOrders()
    } catch (error: any) {
      console.error('Failed to unsplit order:', error)
      toast.error('Failed to unsplit order: ' + (error.response?.data?.error || error.message))
    }
  }

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading order status...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Order Status</h1>
        <p className="text-sm text-muted-foreground">Track picking progress and manage customer communications</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by order # or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                loadOrders()
              }
            }}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="in_progress">In Progress (Default)</SelectItem>
            <SelectItem value="all">All Orders</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="picking">Picking</SelectItem>
            <SelectItem value="ready_to_pack">Ready to Pack</SelectItem>
            <SelectItem value="packed">Packed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={emailFilter} onValueChange={(v: any) => setEmailFilter(v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Emails</SelectItem>
            <SelectItem value="sent">Email Sent</SelectItem>
            <SelectItem value="unsent">Email Unsent</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="progress_high">Progress: High to Low</SelectItem>
            <SelectItem value="progress_low">Progress: Low to High</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={loadOrders} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="space-y-4">
        {orders.filter(order => {
          // Apply email filter only for non-packed orders
          if (emailFilter === 'all' || order.status === 'packed') {
            return true
          }
          
          if (emailFilter === 'sent') {
            return order.email_sent === true
          }
          
          if (emailFilter === 'unsent') {
            return order.email_sent === false
          }
          
          return true
        }).map(order => {
          const isExpanded = expandedOrders.has(order.id)
          const currentMessage = editingMessages[order.id] ?? order.customer_message
          const isSaving = savingOrders.has(order.id)
          const hasMessageChanged = editingMessages[order.id] !== undefined && editingMessages[order.id] !== order.customer_message

          return (
            <Card key={order.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3">
                  {/* Order Number and Expand Button Row */}
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-lg">Order #{order.number}</CardTitle>
                    <Button
                      onClick={() => toggleOrderExpand(order.id)}
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* Status Badges Row - Wrap on Mobile */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={getStatusBadgeColor(order.status)}>
                      {order.status.replace('_', ' ')}
                    </Badge>
                    {order.total_shipments > 1 && (
                      <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-300 text-xs">
                        📦 Shipment {order.current_shipment} of {order.total_shipments}
                      </Badge>
                    )}
                    {order.email_sent && (
                      <Badge variant="outline" className="text-xs">
                        ✉️ Email Sent
                      </Badge>
                    )}
                  </div>

                  {/* Customer Info */}
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Customer: {order.customer_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created: {formatTime(order.created_at)}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{order.progress.completion_percent}%</span>
                  </div>
                  <Progress value={order.progress.completion_percent} className="h-2" />
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      <CheckCircle className="h-3 w-3 inline mr-1" />
                      {order.progress.fully_picked_items}/{order.progress.total_items} complete
                    </span>
                    {order.progress.items_with_shorts > 0 && (
                      <span className="text-destructive">
                        <AlertTriangle className="h-3 w-3 inline mr-1" />
                        {order.progress.items_with_shorts} out of stock
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0 space-y-4">
                  {/* Split Order Controls */}
                  {!order.ready_to_pack && order.status !== 'packed' && (
                    <div className="flex items-center gap-2 pb-4 border-b">
                      {order.total_shipments === 1 ? (
                        <Button
                          onClick={() => handleSplitOrder(order)}
                          variant="outline"
                          size="sm"
                        >
                          <Package className="h-4 w-4 mr-2" />
                          Split Order
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleUnsplitOrder(order)}
                          variant="outline"
                          size="sm"
                        >
                          <Package className="h-4 w-4 mr-2" />
                          Unsplit Order
                        </Button>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {order.total_shipments === 1 
                          ? 'Split this order into multiple shipments'
                          : `Order split into ${order.total_shipments} shipments`
                        }
                      </p>
                    </div>
                  )}

                  {/* Order Items */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Items:</h4>
                    {order.items.map(item => (
                      <div key={item.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex gap-3">
                          <img
                            src={item.image_url || "/placeholder.svg"}
                            alt={item.title}
                            onClick={() => {
                              setPreviewImage(item.image_url || "/placeholder.svg")
                              setPreviewTitle(item.title)
                            }}
                            className="w-16 h-16 rounded object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                          />

                          <div className="flex-1 min-w-0">
                            <h5 className="font-medium text-sm leading-tight">{item.title}</h5>
                            <p className="text-xs text-muted-foreground mt-1">
                              SKU: {item.sku} • {item.category}
                              {item.subcategory && ` > ${item.subcategory}`}
                            </p>
                            {item.vendor_name && (
                              <p className="text-xs text-muted-foreground">
                                Vendor: {item.vendor_name}
                              </p>
                            )}
                            {item.variation_details && (
                              <p className="text-xs text-muted-foreground italic">
                                {item.variation_details}
                              </p>
                            )}

                            <div className="flex items-center gap-4 mt-2">
                              <div className="flex items-center gap-2 text-sm">
                                <Package className="h-4 w-4 text-muted-foreground" />
                                <span>
                                  {item.qty_picked}/{item.qty_ordered}
                                </span>
                              </div>
                              
                              {item.qty_remaining > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {item.qty_remaining} remaining
                                </Badge>
                              )}
                              
                              {item.qty_short > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {item.qty_short} short
                                </Badge>
                              )}
                              
                              {item.qty_picked > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Picked
                                </Badge>
                              )}

                              {order.total_shipments > 1 && (
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${
                                    item.shipment_batch === order.current_shipment 
                                      ? 'bg-purple-50 border-purple-300 text-purple-700' 
                                      : 'bg-gray-50'
                                  }`}
                                >
                                  Batch {item.shipment_batch}
                                </Badge>
                              )}
                            </div>

                            {item.picked_by && item.picked_at && (
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                <User className="h-3 w-3" />
                                <span>{item.picked_by}</span>
                                <Clock className="h-3 w-3 ml-2" />
                                <span>{formatTimeAgo(item.picked_at)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Customer Message Section */}
                  <div className="border-t pt-4 space-y-3">
                    <h4 className="font-semibold text-sm">Customer Communication:</h4>
                    
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground">
                        Message/Note (e.g., delay notification, cancellation info):
                      </label>
                      <Textarea
                        value={currentMessage}
                        onChange={(e) => handleMessageChange(order.id, e.target.value)}
                        placeholder="Enter message or note about this order..."
                        className="min-h-[80px]"
                        disabled={isSaving}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 p-2 rounded-md border border-border hover:bg-muted/50 transition-colors">
                        <Checkbox
                          id={`email-sent-${order.id}`}
                          checked={order.email_sent}
                          onCheckedChange={() => handleEmailSentToggle(order)}
                          disabled={isSaving}
                          className="border-2 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                        />
                        <label
                          htmlFor={`email-sent-${order.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          Email sent to customer
                        </label>
                      </div>

                      {hasMessageChanged && (
                        <Button
                          onClick={() => handleSaveMessage(order)}
                          size="sm"
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Save Message
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}

        {orders.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Orders Found</h3>
            <p className="text-muted-foreground">
              {searchTerm
                ? "No orders match your search criteria"
                : statusFilter === 'in_progress'
                ? "No orders in progress"
                : "No orders found with the selected filter"}
            </p>
          </div>
        )}
      </div>

      {/* Split Order Dialog */}
      <SplitOrderDialog
        order={selectedOrderForSplit}
        open={splitDialogOpen}
        onOpenChange={setSplitDialogOpen}
        onConfirm={handleConfirmSplit}
      />

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-[95vw] md:max-w-[90vw] max-h-[95vh] md:max-h-[90vh] p-0 overflow-hidden">
          <DialogTitle className="sr-only">Product Image Preview</DialogTitle>
          <DialogDescription className="sr-only">
            Full size preview of {previewTitle || 'product image'}
          </DialogDescription>
          <div className="relative w-full h-full flex flex-col items-center justify-center bg-black/95 p-1">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              aria-label="Close preview"
            >
              <X className="h-6 w-6 text-white" />
            </button>

            {previewTitle && (
              <div className="absolute bottom-4 md:top-4 left-4 right-4 md:right-auto z-50 bg-black/50 px-4 py-2 rounded-md md:max-w-[calc(100%-80px)]">
                <p className="text-white text-sm md:text-base font-medium truncate">{previewTitle}</p>
              </div>
            )}

            <div className="w-full h-full flex items-center justify-center">
              <img
                src={previewImage || ""}
                alt={previewTitle}
                className="max-w-full max-h-[85vh] md:max-h-[80vh] w-auto h-auto object-contain"
                style={{ objectFit: 'contain' }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
