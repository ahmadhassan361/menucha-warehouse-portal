"use client"

import { useState, useEffect, useMemo } from "react"
import { Search, Filter, SortAsc, SortDesc, Package, User, Clock, Loader2, X, ChevronDown, ChevronUp, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { pickedItemsService, PickedItem } from "@/services/picked-items.service"
import { toast } from "sonner"

export function PickedItemsPage() {
  const [items, setItems] = useState<PickedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'picked_at' | 'sku' | 'order_number' | 'category'>('picked_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState<string>("")
  const [showHeader, setShowHeader] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  useEffect(() => {
    loadPickedItems()
    
    // Poll for updates every 30 seconds
    const interval = setInterval(loadPickedItems, 30000)
    return () => clearInterval(interval)
  }, [])

  // Handle scroll to show/hide header
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      if (currentScrollY < lastScrollY) {
        setShowHeader(true)
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setShowHeader(false)
      }
      
      if (currentScrollY < 10) {
        setShowHeader(true)
      }
      
      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  const loadPickedItems = async () => {
    try {
      setLoading(true)
      const data = await pickedItemsService.getPickedItems({
        sort_by: sortBy,
        order: sortOrder,
      })
      setItems(data)
    } catch (error: any) {
      console.error('Failed to load picked items:', error)
      toast.error('Failed to load picked items: ' + (error.response?.data?.message || error.message))
    } finally {
      setLoading(false)
    }
  }

  const handleRevertItem = async (item: PickedItem) => {
    if (!confirm(`Revert ${item.qty_picked}x ${item.sku} back to pick list?`)) {
      return
    }

    try {
      const result = await pickedItemsService.revertPickedItem(item.id)
      toast.success(result.message)
      await loadPickedItems()
    } catch (error: any) {
      console.error('Failed to revert item:', error)
      toast.error('Failed to revert: ' + (error.response?.data?.error || error.message))
    }
  }

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    )
  }

  const toggleSubcategory = (subcategory: string) => {
    setSelectedSubcategories(prev => 
      prev.includes(subcategory) ? prev.filter(s => s !== subcategory) : [...prev, subcategory]
    )
  }

  const clearAllFilters = () => {
    setSelectedCategories([])
    setSelectedSubcategories([])
    setSearchTerm("")
  }

  const toggleSort = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
  }

  // Get unique categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(items.map(item => item.category || 'Uncategorized')))
    return cats.filter(c => c).sort()
  }, [items])

  // Get unique subcategories
  const subcategories = useMemo(() => {
    let itemsToConsider = items
    
    if (selectedCategories.length > 0) {
      itemsToConsider = items.filter(item => selectedCategories.includes(item.category))
    }
    
    const subs = Array.from(new Set(
      itemsToConsider
        .map(item => item.subcategory || '')
        .filter(s => s.trim() !== '')
    ))
    return subs.sort()
  }, [items, selectedCategories])

  // Filter and sort items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = 
        searchTerm === '' ||
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.order_number.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(item.category)
      const matchesSubcategory = selectedSubcategories.length === 0 || selectedSubcategories.includes(item.subcategory || '')
      
      return matchesSearch && matchesCategory && matchesSubcategory
    })
  }, [items, searchTerm, selectedCategories, selectedSubcategories])

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

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading picked items...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div 
        className={`sticky top-0 z-10 bg-background pb-4 space-y-4 transition-transform duration-300 ease-in-out ${
          showHeader ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Picked Items</h1>
            <p className="text-sm text-muted-foreground">
              Items picked but not yet ready to pack • {filteredItems.length} items
            </p>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by SKU, title, or order..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="picked_at">Sort by Time</SelectItem>
              <SelectItem value="sku">Sort by SKU</SelectItem>
              <SelectItem value="order_number">Sort by Order</SelectItem>
              <SelectItem value="category">Sort by Category</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={toggleSort} variant="outline" size="icon">
            {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
          </Button>

          {(selectedCategories.length > 0 || selectedSubcategories.length > 0 || searchTerm) && (
            <Button 
              onClick={clearAllFilters}
              variant="outline" 
              size="sm"
            >
              <X className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>

        {/* Category Filters */}
        {categories.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground font-medium mb-2">
              Categories {selectedCategories.length > 0 && `(${selectedCategories.length} selected)`}:
            </p>
            <div className="flex flex-wrap gap-2">
              {categories.map(category => {
                const isSelected = selectedCategories.includes(category)
                const count = items.filter(item => item.category === category).length
                return (
                  <Badge
                    key={category}
                    variant={isSelected ? "default" : "outline"}
                    className="cursor-pointer transition-colors"
                    onClick={() => toggleCategory(category)}
                  >
                    {category} ({count})
                  </Badge>
                )
              })}
            </div>
          </div>
        )}

        {/* Subcategory Filters */}
        {subcategories.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground font-medium mb-2">
              Subcategories {selectedSubcategories.length > 0 && `(${selectedSubcategories.length} selected)`}:
            </p>
            <div className="flex flex-wrap gap-2">
              {subcategories.map(subcategory => {
                const isSelected = selectedSubcategories.includes(subcategory)
                const count = items.filter(item => 
                  (item.subcategory || '') === subcategory &&
                  (selectedCategories.length === 0 || selectedCategories.includes(item.category))
                ).length
                return (
                  <Badge
                    key={subcategory}
                    variant={isSelected ? "default" : "outline"}
                    className="cursor-pointer transition-colors"
                    onClick={() => toggleSubcategory(subcategory)}
                  >
                    {subcategory} ({count})
                  </Badge>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {filteredItems.map(item => (
          <Card key={item.id} className="overflow-hidden">
            <CardContent className="p-4">
              {/* Desktop Layout */}
              <div className="hidden md:flex gap-4">
                <img
                  src={item.image_url || "/placeholder.svg"}
                  alt={item.title}
                  onClick={() => {
                    setPreviewImage(item.image_url || "/placeholder.svg")
                    setPreviewTitle(item.title)
                  }}
                  className="w-20 h-20 rounded-md object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                />

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground leading-tight">{item.title}</h3>
                  
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                    <div>
                      <span className="font-medium">SKU:</span> {item.sku}
                    </div>
                    <div>
                      <span className="font-medium">Order:</span> #{item.order_number}
                    </div>
                    <div>
                      <span className="font-medium">Customer:</span> {item.customer_name}
                    </div>
                    <div>
                      <span className="font-medium">Category:</span> {item.category}{item.subcategory && ` > ${item.subcategory}`}
                    </div>
                    {item.vendor_name && (
                      <div className="col-span-2">
                        <span className="font-medium">Vendor:</span> {item.vendor_name}
                      </div>
                    )}
                    {item.variation_details && (
                      <div className="col-span-2 italic">
                        {item.variation_details}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{item.picked_by}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{formatTimeAgo(item.picked_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 items-end justify-center flex-shrink-0">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{item.qty_picked}</div>
                    <div className="text-xs text-muted-foreground">Picked</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    of {item.qty_ordered} ordered
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
                  <Button
                    onClick={() => handleRevertItem(item)}
                    variant="outline"
                    size="sm"
                    className="mt-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                  >
                    <Undo2 className="h-3 w-3 mr-1" />
                    Revert
                  </Button>
                </div>
              </div>

              {/* Mobile Layout */}
              <div className="md:hidden flex flex-col space-y-3">
                <img
                  src={item.image_url || "/placeholder.svg"}
                  alt={item.title}
                  onClick={() => {
                    setPreviewImage(item.image_url || "/placeholder.svg")
                    setPreviewTitle(item.title)
                  }}
                  className="w-full h-48 rounded-md object-cover cursor-pointer"
                />

                <div>
                  <h3 className="font-semibold text-foreground text-lg leading-tight">{item.title}</h3>
                  
                  <div className="space-y-1 mt-2 text-sm">
                    <div className="text-muted-foreground">
                      <span className="font-medium">SKU:</span> {item.sku}
                    </div>
                    <div className="text-muted-foreground">
                      <span className="font-medium">Order:</span> #{item.order_number}
                    </div>
                    <div className="text-muted-foreground">
                      <span className="font-medium">Customer:</span> {item.customer_name}
                    </div>
                    <div className="text-muted-foreground">
                      {item.category}{item.subcategory && ` > ${item.subcategory}`}
                    </div>
                    {item.vendor_name && (
                      <div className="text-xs text-muted-foreground">
                        Vendor: {item.vendor_name}
                      </div>
                    )}
                    {item.variation_details && (
                      <div className="text-xs text-muted-foreground italic">
                        {item.variation_details}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 py-3 border-y border-border">
                  <div className="text-center">
                    <div className="text-xl font-bold text-primary">{item.qty_picked}</div>
                    <div className="text-xs text-muted-foreground">Picked</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-foreground">{item.qty_ordered}</div>
                    <div className="text-xs text-muted-foreground">Ordered</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-muted-foreground">{item.qty_remaining}</div>
                    <div className="text-xs text-muted-foreground">Remaining</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{item.picked_by}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{formatTimeAgo(item.picked_at)}</span>
                  </div>
                </div>

                {item.qty_short > 0 && (
                  <Badge variant="destructive" className="w-fit">
                    {item.qty_short} marked as short
                  </Badge>
                )}

                <Button
                  onClick={() => handleRevertItem(item)}
                  variant="outline"
                  size="sm"
                  className="w-full text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                >
                  <Undo2 className="h-4 w-4 mr-2" />
                  Revert to Pick List
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Picked Items</h3>
            <p className="text-muted-foreground">
              {items.length === 0
                ? "No items have been picked yet"
                : "No items match your search criteria"}
            </p>
          </div>
        )}
      </div>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-[95vw] md:max-w-[90vw] max-h-[95vh] md:max-h-[90vh] p-0 overflow-hidden">
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
