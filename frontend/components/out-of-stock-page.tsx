"use client"

import { useState, useMemo, useEffect } from "react"
import { Download, Mail, MessageSquare, Calendar, AlertTriangle, Package, Loader2, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
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
  const [exporting, setExporting] = useState(false)

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

  // Filter shortages based on date range
  const filteredShortages = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000)

    return shortages.filter((shortage) => {
      const shortageDate = new Date(shortage.timestamp)
      
      switch (selectedDateRange) {
        case "today":
          return shortageDate >= startOfToday
        case "yesterday":
          return shortageDate >= startOfYesterday && shortageDate < startOfToday
        case "last7days":
          return shortageDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        case "last30days":
          return shortageDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        case "all":
        default:
          return true
      }
    })
  }, [shortages, selectedDateRange])

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Out of Stock</h1>
          <p className="text-muted-foreground">Track shortages and send notifications</p>
        </div>

        <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
          <SelectTrigger className="w-40">
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
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-foreground">{shortage.sku}</h3>
                    <Badge variant="destructive" className="text-xs">
                      {shortage.qty_short} Short
                    </Badge>
                  </div>

                  <h4 className="font-medium text-foreground mb-1">{shortage.product_title}</h4>
                  <p className="text-sm text-muted-foreground mb-3">{shortage.category}</p>

                  <div className="flex items-center gap-4 text-sm mb-3">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Package className="h-4 w-4" />
                      <span>Orders: {shortage.order_numbers.length > 0 ? shortage.order_numbers.join(", ") : 'N/A'}</span>
                    </div>
                  </div>

                  {/* Ordered from Company Checkbox */}
                  <div className="flex items-center space-x-2 border-t border-border pt-3">
                    <Checkbox
                      id={`ordered-${shortage.id}`}
                      checked={shortage.ordered_from_company}
                      onCheckedChange={() => handleToggleOrderedFromCompany(shortage.id, shortage.sku, shortage.ordered_from_company)}
                      className="h-4 w-4"
                    />
                    <label
                      htmlFor={`ordered-${shortage.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Ordered from company
                    </label>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
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
                    <span className="hidden sm:inline">Back in Stock</span>
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
        <div className="sticky bottom-20 bg-background border-t border-border pt-4 mt-6">
          <div className="flex gap-3">
            <Button 
              onClick={handleExportCSV} 
              variant="outline" 
              className="flex-1 bg-transparent"
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
            <Button onClick={handleSendEmail} variant="outline" className="flex-1 bg-transparent">
              <Mail className="h-4 w-4 mr-2" />
              Send Email
            </Button>
            <Button onClick={handleSendSMS} variant="outline" className="flex-1 bg-transparent">
              <MessageSquare className="h-4 w-4 mr-2" />
              Send SMS
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
