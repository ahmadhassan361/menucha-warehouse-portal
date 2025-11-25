"use client"

import { useState, useMemo, useEffect } from "react"
import { Download, Mail, MessageSquare, Calendar, AlertTriangle, Package, Loader2, CheckCircle, X, Search, SortAsc, SortDesc } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { stockService } from "@/services/stock.service"
import { toast } from "sonner"

interface StockException {
  id: number
  sku: string
  product_title: string
  category: string
  qty_short: number
  order_numbers: string[]
  timestamp: string
  resolved: boolean
  ordered_from_company: boolean
  na_cancel: boolean
  vendor_name?: string
  variation_details?: string
  image_url?: string
}

const dateRangeOptions = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7days", label: "Last 7 Days" },
  { value: "last30days", label: "Last 30 Days" },
  { value: "all", label: "All Time" },
]

export function OutOfStockPage() {
  const [shortages, setShortages] = useState<StockException[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDateRange, setSelectedDateRange] = useState("last7days")
  const [selectedFilter, setSelectedFilter] = useState("all")
  const [minDaysOld, setMinDaysOld] = useState<string>("0")
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState<'timestamp' | 'sku' | 'qty_short' | 'vendor'>('timestamp')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [exporting, setExporting] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState<string>("")

  useEffect(() => {
    loadShortages()
  }, [])

  const loadShortages = async () => {
    try {
      setLoading(true)
      const data = await stockService.getExceptions({ resolved: false })
      setShortages(data)
    } catch (error: any) {
      console.error('Failed to load stock exceptions:', error)
      toast.error('Failed to load shortages: ' + (error.response?.data?.message || error.message))
    } finally {
      setLoading(false)
    }
  }

  // Filter, search, and sort shortages
  const filteredShortages = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000)

    // Filter by date and status
    let filtered = shortages.filter((shortage) => {
      const shortageDate = new Date(shortage.timestamp)
      
      // Date filter
      let dateMatch = true
      switch (selectedDateRange) {
        case "today":
          dateMatch = shortageDate >= startOfToday
          break
        case "yesterday":
          dateMatch = shortageDate >= startOfYesterday && shortageDate < startOfToday
          break
        case "last7days":
          dateMatch = shortageDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case "last30days":
          dateMatch = shortageDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case "all":
        default:
          dateMatch = true
      }

      // Status filter
      let statusMatch = true
      switch (selectedFilter) {
        case "ordered":
          statusMatch = shortage.ordered_from_company
          break
        case "na_cancel":
          statusMatch = shortage.na_cancel
          break
        case "remaining":
          statusMatch = !shortage.ordered_from_company && !shortage.na_cancel
          break
        case "all":
        default:
          statusMatch = true
      }

      // Minimum days old filter
      let minDaysMatch = true
      const minDays = parseInt(minDaysOld)
      if (minDays > 0) {
        const daysOld = Math.floor((now.getTime() - shortageDate.getTime()) / (1000 * 60 * 60 * 24))
        minDaysMatch = daysOld >= minDays
      }
      
      return dateMatch && statusMatch && minDaysMatch
    })

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter((shortage) => {
        const vendorMatch = shortage.vendor_name?.toLowerCase().includes(searchLower) || false
        const skuMatch = shortage.sku.toLowerCase().includes(searchLower)
        const titleMatch = shortage.product_title.toLowerCase().includes(searchLower)
        const orderMatch = shortage.order_numbers.some(order => order.toLowerCase().includes(searchLower))
        
        return vendorMatch || skuMatch || titleMatch || orderMatch
      })
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let compareValue = 0
      
      switch (sortBy) {
        case 'sku':
          compareValue = a.sku.localeCompare(b.sku)
          break
        case 'qty_short':
          compareValue = a.qty_short - b.qty_short
          break
        case 'vendor':
          const vendorA = a.vendor_name || ''
          const vendorB = b.vendor_name || ''
          compareValue = vendorA.localeCompare(vendorB)
          break
        case 'timestamp':
        default:
          compareValue = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          break
      }
      
      return sortOrder === 'asc' ? compareValue : -compareValue
    })

    return sorted
  }, [shortages, selectedDateRange, selectedFilter, minDaysOld, searchTerm, sortBy, sortOrder])

  const totalShortageQuantity = filteredShortages.reduce((sum, shortage) => sum + shortage.qty_short, 0)
  const totalAffectedOrders = new Set(filteredShortages.flatMap((shortage) => shortage.order_numbers)).size

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

  const handleExportCSV = async () => {
    try {
      setExporting(true)
      await stockService.exportCSV()
      toast.success('CSV file downloaded successfully')
    } catch (error: any) {
      console.error('Failed to export CSV:', error)
      toast.error('Failed to export: ' + (error.response?.data?.message || error.message))
    } finally {
      setExporting(false)
    }
  }

  const handleSendEmail = async () => {
    try {
      await stockService.sendNotification('email')
      toast.success('Email notification sent successfully')
    } catch (error: any) {
      console.error('Failed to send email:', error)
      toast.error('Failed to send email: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleSendSMS = async () => {
    try {
      await stockService.sendNotification('sms')
      toast.success('SMS notification sent successfully')
    } catch (error: any) {
      console.error('Failed to send SMS:', error)
      toast.error('Failed to send SMS: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleResolveException = async (exceptionId: number, sku: string) => {
    if (!confirm(`Mark ${sku} as back in stock?`)) return
    
    try {
      await stockService.resolveException(exceptionId)
      toast.success(`${sku} marked as back in stock!`)
      await loadShortages()
    } catch (error: any) {
      console.error('Failed to resolve exception:', error)
      toast.error('Failed to mark as resolved: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleToggleOrderedFromCompany = async (exceptionId: number, sku: string, currentStatus: boolean) => {
    try {
      const response = await stockService.toggleOrderedFromCompany(exceptionId)
      toast.success(response.message)
      
      // Update the local state
      setShortages(prev => prev.map(shortage => 
        shortage.id === exceptionId 
          ? { ...shortage, ordered_from_company: response.ordered_from_company }
          : shortage
      ))
    } catch (error: any) {
      console.error('Failed to toggle ordered status:', error)
      toast.error('Failed to update: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleToggleNaCancel = async (exceptionId: number, sku: string, currentStatus: boolean) => {
    try {
      const response = await stockService.toggleNaCancel(exceptionId)
      toast.success(response.message)
      
      // Update the local state
      setShortages(prev => prev.map(shortage => 
        shortage.id === exceptionId 
          ? { ...shortage, na_cancel: response.na_cancel }
          : shortage
      ))
    } catch (error: any) {
      console.error('Failed to toggle N/A - Cancel status:', error)
      toast.error('Failed to update: ' + (error.response?.data?.message || error.message))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading stock exceptions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="mb-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Out of Stock</h1>
              <p className="text-muted-foreground">Track shortages and send notifications</p>
            </div>
          </div>

          {/* Search and Sort Controls */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by vendor, SKU, product name, or order #..."
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
                <SelectItem value="timestamp">Sort by Time</SelectItem>
                <SelectItem value="sku">Sort by SKU</SelectItem>
                <SelectItem value="qty_short">Sort by Quantity</SelectItem>
                <SelectItem value="vendor">Sort by Vendor</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} variant="outline" size="icon">
              {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
            </Button>

            {searchTerm && (
              <Button 
                onClick={() => setSearchTerm("")}
                variant="outline" 
                size="sm"
              >
                <X className="h-4 w-4 mr-1" />
                Clear Search
              </Button>
            )}
          </div>

          {/* Status and Date Filters */}
          <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
            <Select value={selectedFilter} onValueChange={setSelectedFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="ordered">Ordered from Company</SelectItem>
                <SelectItem value="na_cancel">N/A - Cancel</SelectItem>
                <SelectItem value="remaining">Remaining</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
              <SelectTrigger className="w-full sm:w-40">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateRangeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={minDaysOld} onValueChange={setMinDaysOld}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Min days old" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All (No min days)</SelectItem>
                <SelectItem value="1">1+ days old</SelectItem>
                <SelectItem value="2">2+ days old</SelectItem>
                <SelectItem value="3">3+ days old</SelectItem>
                <SelectItem value="5">5+ days old</SelectItem>
                <SelectItem value="7">7+ days old</SelectItem>
                <SelectItem value="14">14+ days old</SelectItem>
                <SelectItem value="30">30+ days old</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Items Short</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-destructive">{totalShortageQuantity}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Affected Orders</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-foreground">{totalAffectedOrders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Shortage Events</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-foreground">{filteredShortages.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Shortage List */}
      <div className="space-y-3">
        {filteredShortages.map((shortage) => (
          <Card key={shortage.id}>
            <CardContent className="p-4">
              {/* Mobile Layout: Image on top */}
              <div className="md:hidden">
                <img
                  src={shortage.image_url || "/placeholder.svg"}
                  alt={shortage.product_title}
                  onClick={() => {
                    setPreviewImage(shortage.image_url || "/placeholder.svg")
                    setPreviewTitle(shortage.product_title)
                  }}
                  className="w-full h-48 rounded-md object-cover cursor-pointer hover:opacity-90 transition-opacity duration-200 mb-4"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-foreground">{shortage.sku}</h3>
                    <Badge variant="destructive" className="text-xs">
                      {shortage.qty_short} Short
                    </Badge>
                  </div>

                  <h4 className="font-medium text-foreground mb-1">{shortage.product_title}</h4>
                  <div className="text-sm text-muted-foreground space-y-0.5 mb-3">
                    <div>Category: {shortage.category}</div>
                    {shortage.vendor_name && (
                      <div>Vendor: {shortage.vendor_name}</div>
                    )}
                    {shortage.variation_details && (
                      <div className="italic">{shortage.variation_details}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm mb-3">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Package className="h-4 w-4" />
                      <span>Orders: {shortage.order_numbers.length > 0 ? shortage.order_numbers.join(", ") : 'N/A'}</span>
                    </div>
                  </div>

                  {/* Checkboxes */}
                  <div className="space-y-2 border-t border-border pt-3">
                    {/* Ordered from Company Checkbox */}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`ordered-${shortage.id}`}
                        checked={shortage.ordered_from_company}
                        onCheckedChange={() => handleToggleOrderedFromCompany(shortage.id, shortage.sku, shortage.ordered_from_company)}
                        className="h-5 w-5 border-2 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                      />
                      <label
                        htmlFor={`ordered-${shortage.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
                      >
                        Ordered from company
                      </label>
                    </div>
                    
                    {/* N/A - Cancel Checkbox */}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`na-cancel-${shortage.id}`}
                        checked={shortage.na_cancel}
                        onCheckedChange={() => handleToggleNaCancel(shortage.id, shortage.sku, shortage.na_cancel)}
                        className="h-5 w-5 border-2 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                      />
                      <label
                        htmlFor={`na-cancel-${shortage.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
                      >
                        N/A - Cancel
                      </label>
                    </div>
                  </div>
                </div>

                {/* Mobile Actions */}
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-border">
                  <div className="text-left">
                    <div className="text-xs text-muted-foreground">Reported</div>
                    <div className="text-sm font-medium">{formatTimeAgo(shortage.timestamp)}</div>
                  </div>
                  <Button 
                    onClick={() => handleResolveException(shortage.id, shortage.sku)}
                    variant="outline" 
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <CheckCircle className="h-3 w-3" />
                    Back in Stock
                  </Button>
                </div>
              </div>

              {/* Desktop Layout: Image inline */}
              <div className="hidden md:flex items-start gap-4">
                {/* Product Image */}
                <img
                  src={shortage.image_url || "/placeholder.svg"}
                  alt={shortage.product_title}
                  onClick={() => {
                    setPreviewImage(shortage.image_url || "/placeholder.svg")
                    setPreviewTitle(shortage.product_title)
                  }}
                  className="w-20 h-20 rounded-md object-cover flex-shrink-0 cursor-pointer hover:opacity-80 hover:scale-105 transition-all duration-200"
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-foreground">{shortage.sku}</h3>
                    <Badge variant="destructive" className="text-xs">
                      {shortage.qty_short} Short
                    </Badge>
                  </div>

                  <h4 className="font-medium text-foreground mb-1">{shortage.product_title}</h4>
                  <div className="text-sm text-muted-foreground space-y-0.5 mb-3">
                    <div>Category: {shortage.category}</div>
                    {shortage.vendor_name && (
                      <div>Vendor: {shortage.vendor_name}</div>
                    )}
                    {shortage.variation_details && (
                      <div className="italic">{shortage.variation_details}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm mb-3">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Package className="h-4 w-4" />
                      <span>Orders: {shortage.order_numbers.length > 0 ? shortage.order_numbers.join(", ") : 'N/A'}</span>
                    </div>
                  </div>

                  {/* Checkboxes */}
                  <div className="space-y-2 border-t border-border pt-3">
                    {/* Ordered from Company Checkbox */}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`ordered-desktop-${shortage.id}`}
                        checked={shortage.ordered_from_company}
                        onCheckedChange={() => handleToggleOrderedFromCompany(shortage.id, shortage.sku, shortage.ordered_from_company)}
                        className="h-5 w-5 border-2 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                      />
                      <label
                        htmlFor={`ordered-desktop-${shortage.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
                      >
                        Ordered from company
                      </label>
                    </div>
                    
                    {/* N/A - Cancel Checkbox */}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`na-cancel-desktop-${shortage.id}`}
                        checked={shortage.na_cancel}
                        onCheckedChange={() => handleToggleNaCancel(shortage.id, shortage.sku, shortage.na_cancel)}
                        className="h-5 w-5 border-2 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                      />
                      <label
                        htmlFor={`na-cancel-desktop-${shortage.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
                      >
                        N/A - Cancel
                      </label>
                    </div>
                  </div>
                </div>

                {/* Desktop Right Actions */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-1">Reported</div>
                    <div className="text-sm font-medium">{formatTimeAgo(shortage.timestamp)}</div>
                  </div>
                  <Button 
                    onClick={() => handleResolveException(shortage.id, shortage.sku)}
                    variant="outline" 
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <CheckCircle className="h-3 w-3" />
                    Back in Stock
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredShortages.length === 0 && (
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Shortages Found</h3>
            <p className="text-muted-foreground">
              {shortages.length === 0 ? (
                'No out-of-stock items reported. Great job!'
              ) : (
                `No shortages in the selected time period: ${
                  dateRangeOptions.find((opt) => opt.value === selectedDateRange)?.label
                }.`
              )}
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {filteredShortages.length > 0 && (
        <div className="sticky bottom-16 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border shadow-lg z-10">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex gap-3">
              <Button 
                onClick={handleExportCSV} 
                variant="outline" 
                className="flex-1"
                disabled={exporting}
              >
                {exporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </>
                )}
              </Button>
              <Button onClick={handleSendEmail} variant="outline" className="flex-1">
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </Button>
              {/* <Button onClick={handleSendSMS} variant="outline" className="flex-1">
                <MessageSquare className="h-4 w-4 mr-2" />
                Send SMS
              </Button> */}
            </div>
          </div>
        </div>
      )}

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
