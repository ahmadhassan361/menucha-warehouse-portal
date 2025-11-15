"use client"

import { useState } from "react"
import { Package, User, Clock, FileText, X, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"

// Mock data for demonstration
const mockReadyOrders = [
  {
    id: "ORD-1001",
    customerName: "John Smith",
    customerEmail: "john.smith@email.com",
    itemCount: 3,
    notes: "Handle with care - fragile items",
    timestampReady: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    items: [
      {
        sku: "WH-001",
        title: "Wireless Headphones Premium",
        qtyOrdered: 2,
        qtyPicked: 2,
        qtyShort: 0,
      },
      {
        sku: "EL-004",
        title: "LED Desk Lamp Adjustable",
        qtyOrdered: 1,
        qtyPicked: 1,
        qtyShort: 0,
      },
    ],
  },
  {
    id: "ORD-1002",
    customerName: "Sarah Johnson",
    customerEmail: "sarah.j@email.com",
    itemCount: 2,
    notes: "",
    timestampReady: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    items: [
      {
        sku: "SH-002",
        title: "Running Shoes Size 10",
        qtyOrdered: 1,
        qtyPicked: 0,
        qtyShort: 1,
      },
      {
        sku: "CL-005",
        title: "Cotton T-Shirt Blue XL",
        qtyOrdered: 3,
        qtyPicked: 3,
        qtyShort: 0,
      },
    ],
  },
  {
    id: "ORD-1003",
    customerName: "Mike Davis",
    customerEmail: "mike.davis@email.com",
    itemCount: 1,
    notes: "Express shipping requested",
    timestampReady: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    items: [
      {
        sku: "BK-003",
        title: "Programming Book Advanced",
        qtyOrdered: 2,
        qtyPicked: 2,
        qtyShort: 0,
      },
    ],
  },
]

export function ReadyToPackPage() {
  const [orders, setOrders] = useState(mockReadyOrders)
  const [selectedOrder, setSelectedOrder] = useState<(typeof mockReadyOrders)[0] | null>(null)

  const handleMarkPacked = (orderId: string) => {
    setOrders((prev) => prev.filter((order) => order.id !== orderId))
    setSelectedOrder(null)
    // In real app, this would update the order status in the backend
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`
    } else {
      const diffInHours = Math.floor(diffInMinutes / 60)
      return `${diffInHours}h ago`
    }
  }

  const getOrderStatus = (order: (typeof mockReadyOrders)[0]) => {
    const hasShortages = order.items.some((item) => item.qtyShort > 0)
    return hasShortages ? "partial" : "complete"
  }

  return (
    <div className="p-4 space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Ready to Pack</h1>
        <p className="text-muted-foreground">Orders ready for packing and shipping</p>
      </div>

      <div className="space-y-3">
        {orders.map((order) => {
          const status = getOrderStatus(order)
          const shortageCount = order.items.reduce((sum, item) => sum + item.qtyShort, 0)

          return (
            <Sheet key={order.id}>
              <SheetTrigger asChild>
                <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-foreground">{order.id}</h3>
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

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>{order.customerName}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Package className="h-4 w-4" />
                            <span>{order.itemCount} items</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{formatTimeAgo(order.timestampReady)}</span>
                          </div>
                        </div>

                        {order.notes && (
                          <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                            <FileText className="h-4 w-4" />
                            <span className="italic">{order.notes}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-muted-foreground mb-1">Ready</div>
                        <div className="text-sm font-medium">{formatTimeAgo(order.timestampReady)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </SheetTrigger>

              <SheetContent className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle className="flex items-center justify-between">
                    <span>{order.id}</span>
                    {status === "partial" && (
                      <Badge variant="destructive" className="text-xs">
                        Partial
                      </Badge>
                    )}
                  </SheetTitle>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Customer Information</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{order.customerName}</span>
                      </div>
                      <div className="text-muted-foreground ml-6">{order.customerEmail}</div>
                    </div>
                  </div>

                  {order.notes && (
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">Notes</h4>
                      <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">{order.notes}</div>
                    </div>
                  )}

                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Order Items</h4>
                    <div className="space-y-3">
                      {order.items.map((item, index) => (
                        <div key={index} className="border border-border rounded-md p-3">
                          <div className="font-medium text-sm mb-1">{item.title}</div>
                          <div className="text-xs text-muted-foreground mb-2">SKU: {item.sku}</div>
                          <div className="flex justify-between text-sm">
                            <span>Ordered: {item.qtyOrdered}</span>
                            <span>Picked: {item.qtyPicked}</span>
                            {item.qtyShort > 0 && (
                              <span className="text-destructive font-medium">Short: {item.qtyShort}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {shortageCount > 0 && (
                    <div>
                      <h4 className="font-semibold text-destructive mb-3 flex items-center gap-2">
                        <X className="h-4 w-4" />
                        Out of Stock Items
                      </h4>
                      <div className="space-y-2">
                        {order.items
                          .filter((item) => item.qtyShort > 0)
                          .map((item, index) => (
                            <div key={index} className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                              <div className="font-medium text-sm text-destructive">{item.title}</div>
                              <div className="text-xs text-muted-foreground">SKU: {item.sku}</div>
                              <div className="text-sm text-destructive mt-1">
                                Short: {item.qtyShort} of {item.qtyOrdered}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  <Button onClick={() => handleMarkPacked(order.id)} className="w-full" size="lg">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as Packed
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          )
        })}

        {orders.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Orders Ready</h3>
            <p className="text-muted-foreground">All orders have been packed and shipped!</p>
          </div>
        )}
      </div>
    </div>
  )
}
