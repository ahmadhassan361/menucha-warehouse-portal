"use client"

import { useState, useEffect, useMemo } from "react"
import { Search, Download, Loader2, Flag, Check, X, RotateCcw, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { itemIssuesService, type ItemIssue, type ItemIssueField } from "@/services/item-issues.service"
import { BookBindingBadge } from "@/components/book-binding-badge"
import { toast } from "sonner"

export function ItemIssuesPage() {
  const [issues, setIssues] = useState<ItemIssue[]>([])
  const [fields, setFields] = useState<ItemIssueField[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("open")
  const [fieldFilter, setFieldFilter] = useState("all")
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  useEffect(() => {
    loadFields()
  }, [])

  useEffect(() => {
    loadIssues()
  }, [statusFilter, fieldFilter])

  const loadFields = async () => {
    try {
      setFields(await itemIssuesService.getFields())
    } catch (error) {
      console.error('Failed to load issue fields:', error)
    }
  }

  const loadIssues = async () => {
    try {
      setLoading(true)
      const data = await itemIssuesService.getIssues({
        status: statusFilter,
        field: fieldFilter,
      })
      setIssues(data)
    } catch (error: any) {
      console.error('Failed to load item issues:', error)
      toast.error('Failed to load reported items: ' + (error.response?.data?.error || error.message))
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      await itemIssuesService.exportCSV({
        status: statusFilter,
        field: fieldFilter,
        search: searchTerm || undefined,
      })
      toast.success('Spreadsheet downloaded')
    } catch (error: any) {
      console.error('Failed to export item issues:', error)
      toast.error('Export failed: ' + (error.response?.data?.error || error.message))
    } finally {
      setExporting(false)
    }
  }

  const handleStatusChange = async (issue: ItemIssue, newStatus: string) => {
    // Optimistic: drop it out of the list when it no longer matches the filter
    const previous = issues
    setIssues((prev) =>
      statusFilter === 'all'
        ? prev.map((i) => (i.id === issue.id ? { ...i, status: newStatus as ItemIssue['status'] } : i))
        : prev.filter((i) => i.id !== issue.id)
    )

    try {
      const result = await itemIssuesService.updateStatus(issue.id, newStatus)
      toast.success(result.message)
    } catch (error: any) {
      console.error('Failed to update issue status:', error)
      toast.error('Failed to update: ' + (error.response?.data?.error || error.message))
      setIssues(previous)
    }
  }

  // Search is applied client-side so typing stays instant; the export sends the
  // same term to the server so the spreadsheet matches what is on screen
  const filteredIssues = useMemo(() => {
    if (!searchTerm.trim()) return issues
    const term = searchTerm.toLowerCase()
    return issues.filter(
      (i) =>
        i.sku.toLowerCase().includes(term) ||
        i.title.toLowerCase().includes(term) ||
        i.vendor_name.toLowerCase().includes(term) ||
        i.note.toLowerCase().includes(term)
    )
  }, [issues, searchTerm])

  const formatDate = (value: string) =>
    new Date(value).toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const statusBadge = (status: ItemIssue['status']) => {
    if (status === 'fixed') return <Badge className="bg-green-600 hover:bg-green-600">Fixed</Badge>
    if (status === 'dismissed') return <Badge variant="secondary">Dismissed</Badge>
    return <Badge className="bg-amber-500 hover:bg-amber-500">Open</Badge>
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inaccurate Items</h1>
          <p className="text-sm text-muted-foreground">
            {filteredIssues.length} item{filteredIssues.length === 1 ? '' : 's'} reported by pickers
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadIssues} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleExport} size="sm" disabled={exporting || filteredIssues.length === 0}>
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search SKU, title, vendor or note..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="fixed">Fixed</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
          </SelectContent>
        </Select>

        <Select value={fieldFilter} onValueChange={setFieldFilter}>
          <SelectTrigger className="w-full md:w-[220px]">
            <SelectValue placeholder="Problem with" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All problem types</SelectItem>
            {fields.map((f) => (
              <SelectItem key={f.field} value={f.field}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Flag className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No reported items{statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}</p>
          <p className="text-sm mt-2">
            Pickers report these with the "Report Inaccurate Info" button on the Pick List.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIssues.map((issue) => (
            <Card key={issue.id}>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <img
                    src={issue.image_url || "/placeholder.svg"}
                    alt={issue.title}
                    onClick={() => setPreviewImage(issue.image_url || "/placeholder.svg")}
                    className="w-full md:w-20 h-40 md:h-20 rounded-md object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                  />

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">
                        {issue.field_label}
                      </Badge>
                      {statusBadge(issue.status)}
                      {issue.report_count > 1 && (
                        <Badge variant="secondary">Reported {issue.report_count}x</Badge>
                      )}
                    </div>

                    <h3 className="font-semibold text-foreground leading-tight">{issue.title}</h3>
                    {issue.book_binding && <BookBindingBadge className="pt-1" />}
                    <p className="text-sm text-muted-foreground">SKU: {issue.sku}</p>
                    {issue.vendor_name && (
                      <p className="text-xs text-muted-foreground">Vendor: {issue.vendor_name}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {issue.category}{issue.subcategory ? ` > ${issue.subcategory}` : ''}
                    </p>

                    {issue.note && (
                      <p className="text-sm bg-muted rounded-md px-3 py-2 mt-2 whitespace-pre-wrap">
                        {issue.note}
                      </p>
                    )}

                    <p className="text-xs text-muted-foreground pt-1">
                      Reported by {issue.reported_by_name || 'Unknown'} on {formatDate(issue.created_at)}
                      {issue.resolved_at && (
                        <> · closed by {issue.resolved_by_name || 'Unknown'} on {formatDate(issue.resolved_at)}</>
                      )}
                    </p>
                  </div>

                  <div className="flex md:flex-col gap-2 flex-shrink-0">
                    {issue.status === 'open' ? (
                      <>
                        <Button
                          onClick={() => handleStatusChange(issue, 'fixed')}
                          size="sm"
                          className="flex-1 md:flex-none md:min-w-[110px]"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Fixed
                        </Button>
                        <Button
                          onClick={() => handleStatusChange(issue, 'dismissed')}
                          size="sm"
                          variant="outline"
                          className="flex-1 md:flex-none md:min-w-[110px]"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Dismiss
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => handleStatusChange(issue, 'open')}
                        size="sm"
                        variant="outline"
                        className="flex-1 md:flex-none md:min-w-[110px]"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Reopen
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-[95vw] md:max-w-[90vw] max-h-[95vh] p-0 overflow-hidden">
          <div className="relative w-full h-full flex items-center justify-center bg-black/95 p-1">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              aria-label="Close preview"
            >
              <X className="h-6 w-6 text-white" />
            </button>
            <img
              src={previewImage || ""}
              alt="Reported item"
              className="max-w-full max-h-[85vh] w-auto h-auto object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
