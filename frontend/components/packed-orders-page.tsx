"use client"

import { useState, useEffect } from "react"
import { Package, User, Clock, Search, Calendar, Loader2, MoreVertical, RotateCcw } from "lucide-react"
import { authService } from "@/services/auth.service"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { ordersService } from "@/services/orders.service"
import { toast } from "sonner"

interface PackedOrder {
  id: number
  number: string
  customer_name: string
  items_count?: number
  packed_at?: string
  created_at: string
  updated_at: string
}

export function PackedOrdersPage() {
  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  const [orders, setOrders] = useState<PackedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState(getTodayDate())
  const [toDate, setToDate] = useState(getTodayDate())
  const [searchTerm, setSearchTerm] = useState("")
  const [userRole, setUserRole] = useState('')
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [selectedAction, setSelectedAction] = useState<'ready_to_pack' | 'open' | null>(null)
  const [changingState, setChangingState] = useState(false)

  useEffect(() => {
    // Load with today's date filters
    loadOrders({
      from_date: getTodayDate(),
      to_date: getTodayDate()
    })
    
    const user = authService.getStoredUser()
    if (user && user.role) {
      setUserRole(user.role)
      console.log('Packed Orders - User role:', user.role)
    }
  }, [])

  const isAdminOrSuperadmin = userRole === 'admin' || userRole === 'superadmin'
  console.log('Packed Orders - isAdminOrSuperadmin:', isAdminOrSuperadmin, 'userRole:', userRole)

  const loadOrders = async (filters?: { from_date?: string; to_date?: string; search?: string }) => {
    try {
      setLoading(true)
      const data = await ordersService.getPackedOrders(filters)
      setOrders(data)
    } catch (error: any) {
      console.error('Failed to load packed orders:', error)
      toast.error('Failed to load orders: ' + (error.response?.data?.message || error.message))
    } finally {
      setLoading(false)
    }
  }

  const handleFilter = () => {
    const filters: any = {}
    if (fromDate) filters.from_date = fromDate
    if (toDate) filters.to_date = toDate
    if (searchTerm) filters.search = searchTerm
    
    loadOrders(filters)
  }

  const handleClearFilters = () => {
    setFromDate("")
    setToDate("")
    setSearchTerm("")
    loadOrders()
  }

  const handleActionClick = (orderId: number, action: 'ready_to_pack' | 'open') => {
    setSelectedOrderId(orderId)
    setSelectedAction(action)
    setConfirmDialogOpen(true)
  }

  const handleConfirmStateChange = async () => {
    if (!selectedOrderId || !selectedAction) return

    try {
      setChangingState(true)
      await ordersService.changeOrderState(selectedOrderId, selectedAction)
      const actionText = selectedAction === 'ready_to_pack' ? 'Ready to Pack' : 'Picking'
      toast.success(`Order reverted to ${actionText} state!`)
      setConfirmDialogOpen(false)
      setSelectedOrderId(null)
      setSelectedAction(null)
      await loadOrders({ from_date: fromDate, to_date: toDate, search: searchTerm })
    } catch (error: any) {
      console.error('Failed to change order state:', error)
      toast.error('Failed to change state: ' + (error.response?.data?.message || error.message))
    } finally {
      setChangingState(false)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString([], { 
      year: 'numeric', 
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

  if (loading && orders.length === 0) {
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
        <h1 className="text-2xl font-bold text-foreground mb-2">Packed Orders</h1>
        <p className="text-muted-foreground">History of packed orders ({orders.length})</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* From Date */}
              <div className="space-y-2">
                <Label htmlFor="from-date" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  From Date
                </Label>
                <Input
                  id="from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>

              {/* To Date */}
              <div className="space-y-2">
                <Label htmlFor="to-date" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  To Date
                </Label>
                <Input
                  id="to-date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>

              {/* Search */}
              <div className="space-y-2">
                <Label htmlFor="search" className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Search Order
                </Label>
                <Input
                  id="search"
                  type="text"
                  placeholder="Order number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
                />
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2">
              <Button onClick={handleFilter} disabled={loading}>
                {loading ? 'Loading...' : 'Apply Filters'}
              </Button>
              <Button onClick={handleClearFilters} variant="outline" disabled={loading}>
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <div className="space-y-3">
        {orders.map((order) => (
          <Card key={order.id}>
            <CardContent className="p-4">
              {/* Desktop Layout */}
              <div className="hidden sm:flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-foreground">#{order.number}</h3>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      Packed
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      <span>{order.customer_name || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Package className="h-4 w-4" />
                      <span>{order.items_count || 0} items</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>Packed {formatTimeAgo(order.packed_at || order.updated_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-1">Packed At</div>
                    <div className="text-sm font-medium">
                      {formatDate(order.packed_at || order.updated_at)}
                    </div>
                  </div>

                  {isAdminOrSuperadmin && (
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => handleActionClick(order.id, 'ready_to_pack')}
                        variant="outline" 
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Ready</span>
                      </Button>
                      <Button 
                        onClick={() => handleActionClick(order.id, 'open')}
                        variant="outline" 
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Picking</span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile Layout */}
              <div className="sm:hidden space-y-3">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-bold text-foreground">#{order.number}</h3>
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                    Packed
                  </span>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <span>{order.customer_name || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Package className="h-4 w-4" />
                    <span>{order.items_count || 0} items</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>Packed {formatTimeAgo(order.packed_at || order.updated_at)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground pt-1">
                    Packed At: {formatDate(order.packed_at || order.updated_at)}
                  </div>
                </div>

                {isAdminOrSuperadmin && (
                  <div className="flex gap-2 pt-3 border-t border-border">
                    <Button 
                      onClick={() => handleActionClick(order.id, 'ready_to_pack')}
                      variant="outline" 
                      className="flex-1 flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span>Ready to Pack</span>
                    </Button>
                    <Button 
                      onClick={() => handleActionClick(order.id, 'open')}
                      variant="outline" 
                      className="flex-1 flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span>Picking</span>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {orders.length === 0 && !loading && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Packed Orders</h3>
            <p className="text-muted-foreground">
              {fromDate || toDate || searchTerm
                ? 'No orders match your filters'
                : 'No orders have been packed yet'}
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm State Change</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedAction === 'ready_to_pack' ? (
                <>
                  Are you sure you want to revert order <strong>#{orders.find(o => o.id === selectedOrderId)?.number}</strong> to Ready to Pack state?
                  <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm">
                    <strong>Note:</strong> The order will move back to Ready to Pack page.
                  </div>
                </>
              ) : (
                <>
                  Are you sure you want to revert order <strong>#{orders.find(o => o.id === selectedOrderId)?.number}</strong> to Picking state?
                  <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm">
                    <strong>Warning:</strong> All items will be reset to unpicked state and the order will return to the pick list.
                  </div>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={changingState}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmStateChange} disabled={changingState}>
              {changingState ? 'Processing...' : 'Yes, Change State'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
