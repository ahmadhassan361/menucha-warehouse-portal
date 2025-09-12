"use client"

import { useState, useMemo } from "react"
import { Search, RefreshCw, Plus, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

// Mock data for demonstration
const mockPickListItems = [
  {
    id: "1",
    sku: "WH-001",
    title: "Wireless Headphones Premium",
    category: "Electronics",
    needed: 5,
    picked: 2,
    image: "/wireless-headphones.png",
  },
  {
    id: "2",
    sku: "SH-002",
    title: "Running Shoes Size 10",
    category: "Footwear",
    needed: 3,
    picked: 0,
    image: "/running-shoes-on-track.png",
  },
  {
    id: "3",
    sku: "BK-003",
    title: "Programming Book Advanced",
    category: "Books",
    needed: 8,
    picked: 6,
    image: "/programming-book.png",
  },
  {
    id: "4",
    sku: "EL-004",
    title: "LED Desk Lamp Adjustable",
    category: "Electronics",
    needed: 2,
    picked: 2,
    image: "/modern-desk-lamp.png",
  },
  {
    id: "5",
    sku: "CL-005",
    title: "Cotton T-Shirt Blue XL",
    category: "Clothing",
    needed: 10,
    picked: 4,
    image: "/blue-t-shirt.png",
  },
]

export function PickListPage() {
  const [items, setItems] = useState(mockPickListItems)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [lastSyncTime, setLastSyncTime] = useState(new Date())
  const [isAutoSync, setIsAutoSync] = useState(true)
  const [pickQuantities, setPickQuantities] = useState<Record<string, number>>({})

  // Get unique categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(items.map((item) => item.category)))
    return ["all", ...cats]
  }, [items])

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = selectedCategory === "all" || item.category === selectedCategory
      const hasRemaining = item.needed > item.picked
      return matchesSearch && matchesCategory && hasRemaining
    })
  }, [items, searchTerm, selectedCategory])

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, typeof filteredItems> = {}
    filteredItems.forEach((item) => {
      if (!groups[item.category]) {
        groups[item.category] = []
      }
      groups[item.category].push(item)
    })
    return groups
  }, [filteredItems])

  const handleSync = () => {
    setLastSyncTime(new Date())
    // In real app, this would sync with API
  }

  const handlePickOne = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, picked: Math.min(item.picked + 1, item.needed) } : item)),
    )
  }

  const handlePickQuantity = (itemId: string) => {
    const quantity = pickQuantities[itemId] || 0
    if (quantity > 0) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, picked: Math.min(item.picked + quantity, item.needed) } : item,
        ),
      )
      setPickQuantities((prev) => ({ ...prev, [itemId]: 0 }))
    }
  }

  const handleNotInStock = (itemId: string) => {
    // In real app, this would mark item as out of stock and move to shortage tracking
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, picked: item.needed } // Mark as "completed" but track as shortage
          : item,
      ),
    )
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pick List</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Last sync: {formatTime(lastSyncTime)}</span>
              {isAutoSync && (
                <Badge variant="secondary" className="text-xs">
                  Auto-sync ON
                </Badge>
              )}
            </div>
          </div>
          <Button onClick={handleSync} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync Now
          </Button>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search SKU or title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category === "all" ? "All Categories" : category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedItems).map(([category, categoryItems]) => (
          <div key={category} className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground border-b border-border pb-2">{category}</h2>
            <div className="space-y-3">
              {categoryItems.map((item) => {
                const remaining = item.needed - item.picked
                const pickQty = pickQuantities[item.id] || 0

                return (
                  <Card key={item.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <img
                          src={item.image || "/placeholder.svg"}
                          alt={item.title}
                          className="w-15 h-15 rounded-md object-cover flex-shrink-0"
                        />

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground leading-tight">{item.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">SKU: {item.sku}</p>
                          <p className="text-xs text-muted-foreground">{item.category}</p>

                          <div className="flex items-center gap-4 mt-3">
                            <div className="text-center">
                              <div className="text-lg font-bold text-foreground">{item.needed}</div>
                              <div className="text-xs text-muted-foreground">Needed</div>
                            </div>
                            <div className="text-center">
                              <div className="text-sm text-muted-foreground">{item.picked}</div>
                              <div className="text-xs text-muted-foreground">Picked</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-primary">{remaining}</div>
                              <div className="text-xs text-muted-foreground">Remaining</div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <Button
                            onClick={() => handlePickOne(item.id)}
                            size="sm"
                            disabled={remaining === 0}
                            className="min-w-[80px]"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Pick 1
                          </Button>

                          <div className="flex gap-1">
                            <Input
                              type="number"
                              min="0"
                              max={remaining}
                              value={pickQty}
                              onChange={(e) =>
                                setPickQuantities((prev) => ({
                                  ...prev,
                                  [item.id]: Number.parseInt(e.target.value) || 0,
                                }))
                              }
                              className="w-16 h-8 text-xs"
                              placeholder="Qty"
                            />
                            <Button
                              onClick={() => handlePickQuantity(item.id)}
                              size="sm"
                              variant="outline"
                              disabled={pickQty === 0 || remaining === 0}
                              className="h-8 px-2"
                            >
                              Pick
                            </Button>
                          </div>

                          <Button
                            onClick={() => handleNotInStock(item.id)}
                            size="sm"
                            variant="destructive"
                            className="min-w-[80px]"
                          >
                            <AlertCircle className="h-3 w-3 mr-1" />
                            No Stock
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <div className="text-muted-foreground">
              {searchTerm || selectedCategory !== "all"
                ? "No items match your search criteria"
                : "All items have been picked!"}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
