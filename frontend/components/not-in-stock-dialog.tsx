"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { pickListService } from "@/services/picklist.service"
import { toast } from "sonner"

interface OrderForSku {
  order_id: number
  order_number: string
  customer_name: string
  qty_ordered: number
  qty_picked: number
  qty_short: number
  qty_remaining: number
}

interface NotInStockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sku: string
  itemTitle: string
  onSuccess: () => void
}

export function NotInStockDialog({ open, onOpenChange, sku, itemTitle, onSuccess }: NotInStockDialogProps) {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [orders, setOrders] = useState<OrderForSku[]>([])
  const [totalRemaining, setTotalRemaining] = useState(0)
  const [shortages, setShortages] = useState<Record<number, number>>({})
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (open && sku) {
      loadOrders()
    } else {
      // Reset state when dialog closes
      setOrders([])
      setShortages({})
      setNotes("")
    }
  }, [open, sku])

  const loadOrders = async () => {
    try {
      setLoading(true)
      const data = await pickListService.getOrdersForSku(sku)
      setOrders(data.orders)
      setTotalRemaining(data.total_remaining)
    } catch (error: any) {
      console.error('Failed to load orders for SKU:', error)
      toast.error('Failed to load orders: ' + (error.response?.data?.error || error.message))
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  const handleShortageChange = (orderId: number, value: string) => {
    const qty = parseInt(value) || 0
    const order = orders.find(o => o.order_id === orderId)
    
    if (order && qty > order.qty_remaining) {
      toast.warning(`Cannot mark more than ${order.qty_remaining} units short for this order`)
      return
    }
    
    setShortages(prev => ({
      ...prev,
      [orderId]: qty > 0 ? qty : 0
    }))
  }

  const totalShort = Object.values(shortages).reduce((sum, qty) => sum + qty, 0)

  const handleSubmit = async () => {
    if (totalShort === 0) {
      toast.warning('Please enter at least one shortage quantity')
      return
    }

    if (totalShort > totalRemaining) {
      toast.error(`Total short (${totalShort}) cannot exceed total remaining (${totalRemaining})`)
      return
    }

    // Build allocations array from shortages
    const allocations = Object.entries(shortages)
      .filter(([_, qty]) => qty > 0)
      .map(([orderId, qty]) => ({
        order_id: parseInt(orderId),
        qty_short: qty
      }))

    if (allocations.length === 0) {
      toast.warning('Please select at least one order to mark as short')
      return
    }

    try {
      setSubmitting(true)
      await pickListService.markNotInStock(
        sku,
        allocations,
        notes || `Marked ${totalShort} units as not in stock`
      )
      toast.success(`Marked ${totalShort} units as not in stock!`)
      onOpenChange(false)
      onSuccess()
    } catch (error: any) {
      console.error('Failed to mark as not in stock:', error)
      toast.error('Failed to mark as not in stock: ' + (error.response?.data?.error || error.message))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mark as Not in Stock</DialogTitle>
          <DialogDescription>
            <strong>{sku}</strong> - {itemTitle}
            <br />
            Total Remaining: <strong>{totalRemaining}</strong> units
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2">Loading orders...</span>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <Label className="text-base font-semibold">Orders needing this item:</Label>
              
              {orders.map((order) => (
                <div key={order.order_id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">Order #{order.order_number}</div>
                      <div className="text-sm text-muted-foreground">{order.customer_name}</div>
                    </div>
                    <div className="text-right text-sm">
                      <div>Ordered: {order.qty_ordered}</div>
                      <div>Picked: {order.qty_picked}</div>
                      <div className="font-semibold text-primary">Remaining: {order.qty_remaining}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`short-${order.order_id}`} className="text-sm min-w-[80px]">
                      Mark Short:
                    </Label>
                    <Input
                      id={`short-${order.order_id}`}
                      type="number"
                      min="0"
                      max={order.qty_remaining}
                      value={shortages[order.order_id] || ''}
                      onChange={(e) => handleShortageChange(order.order_id, e.target.value)}
                      placeholder="0"
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">
                      of {order.qty_remaining} available
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for shortage..."
                rows={3}
              />
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <div className="flex items-center justify-between font-semibold">
                <span>Total Short:</span>
                <span className={totalShort > totalRemaining ? 'text-destructive' : 'text-primary'}>
                  {totalShort} / {totalRemaining} units
                </span>
              </div>
              {totalShort > totalRemaining && (
                <p className="text-sm text-destructive mt-2">
                  Cannot mark more units than available!
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || submitting || totalShort === 0 || totalShort > totalRemaining}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Marking...
              </>
            ) : (
              `Mark ${totalShort} as Short`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
