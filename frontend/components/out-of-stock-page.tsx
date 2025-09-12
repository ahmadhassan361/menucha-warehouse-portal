"use client"

import { useState, useMemo } from "react"
import { Download, Mail, MessageSquare, Calendar, AlertTriangle, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

// Mock data for demonstration
const mockShortageData = [
  {
    id: "1",
    sku: "SH-002",
    title: "Running Shoes Size 10",
    category: "Footwear",
    quantityShort: 3,
    relatedOrders: ["ORD-1002", "ORD-1005", "ORD-1008"],
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
  },
  {
    id: "2",
    sku: "WH-003",
    title: "Bluetooth Speaker Portable",
    category: "Electronics",
    quantityShort: 5,
    relatedOrders: ["ORD-1003", "ORD-1007"],
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
  },
  {
    id: "3",
    sku: "CL-008",
    title: "Winter Jacket Medium",
    category: "Clothing",
    quantityShort: 2,
    relatedOrders: ["ORD-1001"],
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
  },
  {
    id: "4",
    sku: "BK-005",
    title: "Science Fiction Novel",
    category: "Books",
    quantityShort: 1,
    relatedOrders: ["ORD-1004", "ORD-1006"],
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
  },
  {
    id: "5",
    sku: "EL-007",
    title: "Wireless Mouse Gaming",
    category: "Electronics",
    quantityShort: 8,
    relatedOrders: ["ORD-1009", "ORD-1010", "ORD-1011"],
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
  },
]

const dateRangeOptions = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7days", label: "Last 7 Days" },
  { value: "last30days", label: "Last 30 Days" },
  { value: "all", label: "All Time" },
]

export function OutOfStockPage() {
  const [shortages, setShortages] = useState(mockShortageData)
  const [selectedDateRange, setSelectedDateRange] = useState("last7days")
  const { toast } = useToast()

  // Filter shortages based on date range
  const filteredShortages = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000)

    return shortages.filter((shortage) => {
      switch (selectedDateRange) {
        case "today":
          return shortage.timestamp >= startOfToday
        case "yesterday":
          return shortage.timestamp >= startOfYesterday && shortage.timestamp < startOfToday
        case "last7days":
          return shortage.timestamp >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        case "last30days":
          return shortage.timestamp >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        case "all":
        default:
          return true
      }
    })
  }, [shortages, selectedDateRange])

  const totalShortageQuantity = filteredShortages.reduce((sum, shortage) => sum + shortage.quantityShort, 0)
  const totalAffectedOrders = new Set(filteredShortages.flatMap((shortage) => shortage.relatedOrders)).size

  const formatTimeAgo = (date: Date) => {
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

  const handleExportCSV = () => {
    // In real app, this would generate and download a CSV file
    const csvContent = [
      ["SKU", "Product Title", "Category", "Quantity Short", "Related Orders", "Timestamp"],
      ...filteredShortages.map((shortage) => [
        shortage.sku,
        shortage.title,
        shortage.category,
        shortage.quantityShort.toString(),
        shortage.relatedOrders.join("; "),
        shortage.timestamp.toISOString(),
      ]),
    ]
      .map((row) => row.map((field) => `"${field}"`).join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `out-of-stock-${selectedDateRange}-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)

    toast({
      title: "Export Complete",
      description: "Out-of-stock report has been downloaded as CSV.",
    })
  }

  const handleSendEmail = () => {
    // In real app, this would send an email with the shortage report
    toast({
      title: "Email Sent",
      description: "Out-of-stock report has been sent to the configured email addresses.",
    })
  }

  const handleSendSMS = () => {
    // In real app, this would send SMS notifications
    toast({
      title: "SMS Sent",
      description: "Out-of-stock alerts have been sent via SMS.",
    })
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
                      {shortage.quantityShort} Short
                    </Badge>
                  </div>

                  <h4 className="font-medium text-foreground mb-1">{shortage.title}</h4>
                  <p className="text-sm text-muted-foreground mb-3">{shortage.category}</p>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Package className="h-4 w-4" />
                      <span>Orders: {shortage.relatedOrders.join(", ")}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-muted-foreground mb-1">Reported</div>
                  <div className="text-sm font-medium">{formatTimeAgo(shortage.timestamp)}</div>
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
              {selectedDateRange === "all"
                ? "No out-of-stock items reported."
                : `No shortages in the selected time period: ${
                    dateRangeOptions.find((opt) => opt.value === selectedDateRange)?.label
                  }.`}
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {filteredShortages.length > 0 && (
        <div className="sticky bottom-20 bg-background border-t border-border pt-4 mt-6">
          <div className="flex gap-3">
            <Button onClick={handleExportCSV} variant="outline" className="flex-1 bg-transparent">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
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
