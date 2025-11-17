"use client"

import { useState, useMemo, useEffect } from "react"
import { Search, RefreshCw, Plus, AlertCircle, Loader2, X, ChevronDown, ChevronUp } from "lucide-react"
import { NotInStockDialog } from "@/components/not-in-stock-dialog"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { pickListService } from "@/services/picklist.service"
import { adminService } from "@/services/admin.service"
import { toast } from "sonner"

interface PickListItem {
  sku: string
  title: string
  category: string
  vendor_name?: string
  image_url: string
  needed: number
  picked: number
  remaining: number
}

export function PickListPage() {
  const [items, setItems] = useState<PickListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [pickQuantities, setPickQuantities] = useState<Record<string, number>>({})
  const [notInStockDialogOpen, setNotInStockDialogOpen] = useState(false)
  const [selectedSku, setSelectedSku] = useState("")
  const [selectedItemTitle, setSelectedItemTitle] = useState("")
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState<string>("")
  const [categoryNavExpanded, setCategoryNavExpanded] = useState(false)

  // Load pick list on mount
  useEffect(() => {
    loadPickList()
    loadSyncStatus()
  }, [])

  const loadPickList = async () => {
    try {
      setLoading(true)
      const data = await pickListService.getPickList()
      setItems(data)
    } catch (error: any) {
      console.error('Failed to load pick list:', error)
      toast.error('Failed to load pick list: ' + (error.response?.data?.message || error.message))
    } finally {
      setLoading(false)
    }
  }

  const loadSyncStatus = async () => {
    try {
      const status = await adminService.getSyncStatus()
      if (status.last_sync_at) {
        setLastSyncTime(new Date(status.last_sync_at))
      }
    } catch (error) {
      console.error('Failed to load sync status:', error)
    }
  }

  const handleSync = async () => {
    try {
      setSyncing(true)
      toast.info('Starting sync...')
      const result = await adminService.syncNow()
      toast.success(result.message || 'Sync completed successfully')
      setLastSyncTime(new Date())
      await loadPickList() // Reload data after sync
    } catch (error: any) {
      console.error('Sync failed:', error)
      toast.error('Sync failed: ' + (error.response?.data?.message || error.message))
    } finally {
      setSyncing(false)
    }
  }

  const handlePickOne = async (sku: string) => {
    // Optimistic update - update UI immediately without reload
    setItems((prev) =>
      prev.map((item) =>
        item.sku === sku
          ? {
              ...item,
              picked: item.picked + 1,
              remaining: Math.max(0, item.remaining - 1),
            }
          : item
      )
    )
    
    toast.success('Item picked')
    
    // Call API in background
    try {
      await pickListService.pickItems(sku, 1)
    } catch (error: any) {
      console.error('Failed to pick item:', error)
      toast.error('Failed to save: ' + (error.response?.data?.message || error.message))
      // Revert on error
      await loadPickList()
    }
  }

  const handlePickQuantity = async (sku: string) => {
    const quantity = pickQuantities[sku] || 0
    if (quantity > 0) {
      // Optimistic update
      setItems((prev) =>
        prev.map((item) =>
          item.sku === sku
            ? {
                ...item,
                picked: item.picked + quantity,
                remaining: Math.max(0, item.remaining - quantity),
              }
            : item
        )
      )
      
      setPickQuantities((prev) => ({ ...prev, [sku]: 0 }))
      toast.success(`${quantity} items picked`)
      
      // Call API in background
      try {
        await pickListService.pickItems(sku, quantity)
      } catch (error: any) {
        console.error('Failed to pick items:', error)
        toast.error('Failed to save: ' + (error.response?.data?.message || error.message))
        // Revert on error
        await loadPickList()
      }
    }
  }

  const handleNotInStock = (sku: string) => {
    const item = items.find(i => i.sku === sku)
    if (!item || item.remaining === 0) return
    
    setSelectedSku(sku)
    setSelectedItemTitle(item.title)
    setNotInStockDialogOpen(true)
  }

  const handleNotInStockSuccess = () => {
    loadPickList()
  }

  // Get unique categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(items.map((item) => item.category || 'Uncategorized')))
    return ["all", ...cats.filter(c => c).sort()]
  }, [items])

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = selectedCategory === "all" || item.category === selectedCategory
      const hasRemaining = item.remaining > 0
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

  const formatTime = (date: Date | null) => {
    if (!date) return 'Never'
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading pick list...</p>
        </div>
      </div>
    )
  }

  const scrollToCategory = (category: string) => {
    const element = document.getElementById(`category-${category}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="sticky top-0 z-10 bg-background pb-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pick List</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Last sync: {formatTime(lastSyncTime)}</span>
              <span>•</span>
              <span className="font-medium text-foreground">{filteredItems.length} items</span>
            </div>
          </div>
          <Button onClick={handleSync} variant="outline" size="sm" disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
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

        {/* Category Quick Navigation */}
        {selectedCategory === "all" && Object.keys(groupedItems).length > 1 && (
          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground font-medium">Quick Jump to Category:</p>
              {/* Collapse/Expand button for mobile only */}
              <button
                onClick={() => setCategoryNavExpanded(!categoryNavExpanded)}
                className="md:hidden text-xs text-primary flex items-center gap-1 hover:underline"
              >
                {categoryNavExpanded ? (
                  <>
                    <span>Collapse</span>
                    <ChevronUp className="h-3 w-3" />
                  </>
                ) : (
                  <>
                    <span>Expand</span>
                    <ChevronDown className="h-3 w-3" />
                  </>
                )}
              </button>
            </div>
            
            {/* Desktop: Normal flex-wrap */}
            <div className="hidden md:flex flex-wrap gap-2">
              {Object.entries(groupedItems).map(([category, items]) => (
                <Badge
                  key={category}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => scrollToCategory(category)}
                >
                  {category} ({items.length})
                </Badge>
              ))}
            </div>

            {/* Mobile: Collapseable with horizontal scroll or wrapped */}
            <div className="md:hidden">
              {categoryNavExpanded ? (
                /* Expanded: Show all with wrap */
                <div className="flex flex-wrap gap-2">
                  {Object.entries(groupedItems).map(([category, items]) => (
                    <Badge
                      key={category}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs"
                      onClick={() => scrollToCategory(category)}
                    >
                      {category} ({items.length})
                    </Badge>
                  ))}
                </div>
              ) : (
                /* Collapsed: Horizontal scroll */
                <div className="overflow-x-auto pb-2 -mx-1 px-1">
                  <div className="flex gap-2 min-w-max">
                    {Object.entries(groupedItems).map(([category, items]) => (
                      <Badge
                        key={category}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors whitespace-nowrap text-xs flex-shrink-0"
                        onClick={() => scrollToCategory(category)}
                      >
                        {category} ({items.length})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {Object.entries(groupedItems).map(([category, categoryItems]) => (
          <div key={category} id={`category-${category}`} className="space-y-3 scroll-mt-4">
            <h2 className="text-lg font-semibold text-foreground border-b border-border pb-2">
              {category} <span className="text-sm text-muted-foreground font-normal">({categoryItems.length} items)</span>
            </h2>
            <div className="space-y-3">
              {categoryItems.map((item) => {
                const pickQty = pickQuantities[item.sku] || 0

                return (
                  <Card key={item.sku} className="overflow-hidden">
                    <CardContent className="p-4">
                      {/* Desktop Layout (hidden on mobile) */}
                      <div className="hidden md:flex gap-4">
                        <img
                          src={item.image_url || "/placeholder.svg"}
                          alt={item.title}
                          onClick={() => {
                            setPreviewImage(item.image_url || "/placeholder.svg")
                            setPreviewTitle(item.title)
                          }}
                          className="w-20 h-20 rounded-md object-cover flex-shrink-0 cursor-pointer hover:opacity-80 hover:scale-105 transition-all duration-200"
                        />

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground leading-tight">{item.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">SKU: {item.sku}</p>
                          {item.vendor_name && (
                            <p className="text-xs text-muted-foreground">Vendor: {item.vendor_name}</p>
                          )}
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
                              <div className="text-lg font-bold text-primary">{item.remaining}</div>
                              <div className="text-xs text-muted-foreground">Remaining</div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <Button
                            onClick={() => handlePickOne(item.sku)}
                            size="sm"
                            disabled={item.remaining === 0}
                            className="min-w-[80px]"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Pick 1
                          </Button>

                          <div className="flex gap-1">
                            <Button
                              onClick={() => {
                                const newQty = Math.max(0, pickQty - 1)
                                setPickQuantities((prev) => ({ ...prev, [item.sku]: newQty }))
                              }}
                              size="sm"
                              variant="outline"
                              disabled={pickQty === 0}
                              className="h-8 w-8 p-0"
                            >
                              -
                            </Button>
                            <Input
                              type="number"
                              min="0"
                              max={item.remaining}
                              value={pickQty}
                              onChange={(e) =>
                                setPickQuantities((prev) => ({
                                  ...prev,
                                  [item.sku]: Number.parseInt(e.target.value) || 0,
                                }))
                              }
                              className="w-16 h-8 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <Button
                              onClick={() => {
                                const newQty = Math.min(item.remaining, pickQty + 1)
                                setPickQuantities((prev) => ({ ...prev, [item.sku]: newQty }))
                              }}
                              size="sm"
                              variant="outline"
                              disabled={pickQty >= item.remaining}
                              className="h-8 w-8 p-0"
                            >
                              +
                            </Button>
                            <Button
                              onClick={() => handlePickQuantity(item.sku)}
                              size="sm"
                              variant="outline"
                              disabled={pickQty === 0 || item.remaining === 0}
                              className="h-8 px-2"
                            >
                              Pick
                            </Button>
                          </div>

                          <Button
                            onClick={() => handleNotInStock(item.sku)}
                            size="sm"
                            variant="destructive"
                            className="min-w-[80px]"
                          >
                            <AlertCircle className="h-3 w-3 mr-1" />
                            No Stock
                          </Button>
                        </div>
                      </div>

                      {/* Mobile Layout (visible only on mobile) */}
                      <div className="md:hidden flex flex-col space-y-3">
                        {/* Image */}
                        <img
                          src={item.image_url || "/placeholder.svg"}
                          alt={item.title}
                          onClick={() => {
                            setPreviewImage(item.image_url || "/placeholder.svg")
                            setPreviewTitle(item.title)
                          }}
                          className="w-full h-48 rounded-md object-cover cursor-pointer hover:opacity-90 transition-opacity duration-200"
                        />

                        {/* Title & SKU */}
                        <div>
                          <h3 className="font-semibold text-foreground text-lg leading-tight">{item.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">SKU: {item.sku}</p>
                          {item.vendor_name && (
                            <p className="text-xs text-muted-foreground">Vendor: {item.vendor_name}</p>
                          )}
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-2 py-3 border-y border-border">
                          <div className="text-center">
                            <div className="text-xl font-bold text-foreground">{item.needed}</div>
                            <div className="text-xs text-muted-foreground">Needed</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xl font-bold text-primary">{item.remaining}</div>
                            <div className="text-xs text-muted-foreground">Remaining</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg text-muted-foreground">{item.picked}</div>
                            <div className="text-xs text-muted-foreground">Picked</div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-2">
                          {/* Pick 1 Button */}
                          <Button
                            onClick={() => handlePickOne(item.sku)}
                            className="w-full"
                            disabled={item.remaining === 0}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Pick 1
                          </Button>

                          {/* Quantity Picker with +/- */}
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => {
                                const newQty = Math.max(0, pickQty - 1)
                                setPickQuantities((prev) => ({ ...prev, [item.sku]: newQty }))
                              }}
                              size="lg"
                              variant="outline"
                              disabled={pickQty === 0}
                              className="w-12 h-12 p-0 text-lg"
                            >
                              -
                            </Button>
                            <Input
                              type="number"
                              min="0"
                              max={item.remaining}
                              value={pickQty}
                              onChange={(e) =>
                                setPickQuantities((prev) => ({
                                  ...prev,
                                  [item.sku]: Number.parseInt(e.target.value) || 0,
                                }))
                              }
                              className="flex-1 h-12 text-center text-lg font-semibold"
                            />
                            <Button
                              onClick={() => {
                                const newQty = Math.min(item.remaining, pickQty + 1)
                                setPickQuantities((prev) => ({ ...prev, [item.sku]: newQty }))
                              }}
                              size="lg"
                              variant="outline"
                              disabled={pickQty >= item.remaining}
                              className="w-12 h-12 p-0 text-lg"
                            >
                              +
                            </Button>
                          </div>

                          {/* Pick Button */}
                          <Button
                            onClick={() => handlePickQuantity(item.sku)}
                            variant="outline"
                            className="w-full h-12"
                            disabled={pickQty === 0 || item.remaining === 0}
                          >
                            Pick {pickQty > 0 && `(${pickQty})`}
                          </Button>

                          {/* No Stock Button */}
                          <Button
                            onClick={() => handleNotInStock(item.sku)}
                            variant="destructive"
                            className="w-full"
                          >
                            <AlertCircle className="h-4 w-4 mr-2" />
                            Not in Stock
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
              {items.length === 0 ? (
                <>
                  <p>No items in pick list</p>
                  <p className="text-sm mt-2">Click "Sync Now" to import orders from the API</p>
                </>
              ) : (
                searchTerm || selectedCategory !== "all"
                  ? "No items match your search criteria"
                  : "All items have been picked!"
              )}
            </div>
          </div>
        )}
      </div>

      <NotInStockDialog
        open={notInStockDialogOpen}
        onOpenChange={setNotInStockDialogOpen}
        sku={selectedSku}
        itemTitle={selectedItemTitle}
        onSuccess={handleNotInStockSuccess}
      />

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-[95vw] md:max-w-[90vw] max-h-[95vh] md:max-h-[90vh] p-0 overflow-hidden">
          <div className="relative w-full h-full flex flex-col items-center justify-center bg-black/95 p-1">
            {/* Close Button */}
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              aria-label="Close preview"
            >
              <X className="h-6 w-6 text-white" />
            </button>

            {/* Image Title - Bottom on mobile, Top on desktop */}
            {previewTitle && (
              <div className="absolute bottom-4 md:top-4 left-4 right-4 md:right-auto z-50 bg-black/50 px-4 py-2 rounded-md md:max-w-[calc(100%-80px)]">
                <p className="text-white text-sm md:text-base font-medium truncate">{previewTitle}</p>
              </div>
            )}

            {/* Responsive Image Container */}
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
