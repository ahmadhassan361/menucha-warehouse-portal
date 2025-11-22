'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { OrderStatus, OrderItemStatus } from '@/services/order-status.service'
import { Package, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface SplitOrderDialogProps {
  order: OrderStatus | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (itemBatches: { item_id: number; batch: number }[]) => void
}

export function SplitOrderDialog({ order, open, onOpenChange, onConfirm }: SplitOrderDialogProps) {
  const [itemBatches, setItemBatches] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(false)

  // Initialize batches when dialog opens or order changes
  useEffect(() => {
    if (open && order) {
      const initial: Record<number, number> = {}
      order.items.forEach(item => {
        // Default assignment: all items start in batch 1
        initial[item.id] = 1
      })
      setItemBatches(initial)
    }
  }, [open, order])

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen)
  }

  const handleBatchChange = (itemId: number, batch: number) => {
    setItemBatches(prev => ({
      ...prev,
      [itemId]: batch
    }))
  }

  const handleConfirm = async () => {
    if (!order) return

    const batches = order.items.map(item => ({
      item_id: item.id,
      batch: itemBatches[item.id] || 1
    }))

    setLoading(true)
    try {
      await onConfirm(batches)
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  if (!order) return null

  // Calculate statistics
  const maxBatch = Math.max(...Object.values(itemBatches), 1)
  const batchCounts = Object.values(itemBatches).reduce((acc, batch) => {
    acc[batch] = (acc[batch] || 0) + 1
    return acc
  }, {} as Record<number, number>)

  // Check if split is valid (at least one item per batch)
  const isValidSplit = maxBatch > 1 && Object.keys(batchCounts).length > 1

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] w-[95vw] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Package className="h-4 w-4 sm:h-5 sm:w-5" />
            Split Order #{order.number}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Assign each item to a shipment batch. Items in Batch 1 will be picked and packed first.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4">
          {/* Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 bg-muted rounded-lg">
            <div>
              <p className="text-xs sm:text-sm font-medium">Total Shipments</p>
              <p className="text-xl sm:text-2xl font-bold">{maxBatch}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: maxBatch }, (_, i) => i + 1).map(batch => (
                <Badge key={batch} variant="secondary" className="text-xs sm:text-sm md:text-base px-2 sm:px-3 py-0.5 sm:py-1">
                  Batch {batch}: {batchCounts[batch] || 0}
                </Badge>
              ))}
            </div>
          </div>

          {!isValidSplit && maxBatch > 1 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please ensure items are distributed across multiple batches
              </AlertDescription>
            </Alert>
          )}

          {/* Items list */}
          <div className="space-y-2">
            <h4 className="font-medium text-xs sm:text-sm text-muted-foreground">Assign Items to Shipments</h4>
            <div className="border rounded-lg divide-y">
              {order.items.map(item => (
                <div key={item.id} className="p-2 sm:p-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm sm:text-base mb-1 break-words">{item.title}</p>
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-1">
                      {item.qty_picked > 0 && (
                        <Badge variant="default" className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0 sm:py-0.5">
                          {item.qty_picked} picked
                        </Badge>
                      )}
                      {item.qty_remaining > 0 && (
                        <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0 sm:py-0.5">
                          {item.qty_remaining} left
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground break-words">
                      {item.sku} • Qty: {item.qty_ordered}
                    </p>
                  </div>
                  
                  <div className="w-full sm:w-28 flex-shrink-0">
                    <Select
                      value={itemBatches[item.id]?.toString() || '1'}
                      onValueChange={(value) => handleBatchChange(item.id, parseInt(value))}
                    >
                      <SelectTrigger className="w-full h-8 sm:h-10 text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map(batch => (
                          <SelectItem key={batch} value={batch.toString()} className="text-xs sm:text-sm">
                            Batch {batch}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Help text */}
          <Alert className="text-xs sm:text-sm">
            <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" />
            <AlertDescription className="text-xs sm:text-sm">
              <strong>How it works:</strong> After splitting, only Batch 1 items will appear in the pick list. 
              Once Batch 1 is packed, the order will automatically advance to Batch 2, and so on.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            disabled={loading}
            className="w-full sm:w-auto text-sm"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!isValidSplit || loading}
            className="w-full sm:w-auto text-sm"
          >
            {loading ? 'Splitting...' : `Split into ${maxBatch}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
