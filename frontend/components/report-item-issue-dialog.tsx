"use client"

import { useState, useEffect } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { itemIssuesService, type ItemIssueField } from "@/services/item-issues.service"
import { toast } from "sonner"

interface ReportItemIssueDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sku: string
  itemTitle: string
  imageUrl?: string
  /** Called with how many issues are now open for this SKU as a result of the report */
  onSuccess?: (reportedFields: number) => void
}

// What the picker selected for one field: which ready-made notes are ticked,
// plus anything they typed themselves.
interface FieldSelection {
  presets: string[]
  custom: string
}

export function ReportItemIssueDialog({
  open,
  onOpenChange,
  sku,
  itemTitle,
  imageUrl,
  onSuccess,
}: ReportItemIssueDialogProps) {
  const [fields, setFields] = useState<ItemIssueField[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selections, setSelections] = useState<Record<string, FieldSelection>>({})

  useEffect(() => {
    if (open) {
      loadFields()
    } else {
      setSelections({})
    }
  }, [open])

  const loadFields = async () => {
    // The field list rarely changes, so only fetch it the first time
    if (fields.length > 0) return
    try {
      setLoading(true)
      setFields(await itemIssuesService.getFields())
    } catch (error: any) {
      console.error('Failed to load issue fields:', error)
      toast.error('Failed to load issue types: ' + (error.response?.data?.error || error.message))
    } finally {
      setLoading(false)
    }
  }

  const getSelection = (field: string): FieldSelection =>
    selections[field] || { presets: [], custom: "" }

  const isFieldActive = (field: string) => {
    const sel = getSelection(field)
    return sel.presets.length > 0 || sel.custom.trim() !== ""
  }

  const togglePreset = (field: string, note: string) => {
    setSelections((prev) => {
      const sel = prev[field] || { presets: [], custom: "" }
      const presets = sel.presets.includes(note)
        ? sel.presets.filter((n) => n !== note)
        : [...sel.presets, note]
      return { ...prev, [field]: { ...sel, presets } }
    })
  }

  const setCustom = (field: string, custom: string) => {
    setSelections((prev) => ({
      ...prev,
      [field]: { ...(prev[field] || { presets: [], custom: "" }), custom },
    }))
  }

  const activeFields = fields.filter((f) => isFieldActive(f.field))

  const handleSubmit = async () => {
    if (activeFields.length === 0) {
      toast.warning('Tick at least one problem, or type your own note')
      return
    }

    // Ready-made notes and the typed note are merged into one line per field
    const issues = activeFields.map((f) => {
      const sel = getSelection(f.field)
      const parts = [...sel.presets]
      if (sel.custom.trim()) parts.push(sel.custom.trim())
      return { field: f.field, note: parts.join('; ') }
    })

    try {
      setSubmitting(true)
      const result = await itemIssuesService.report(sku, issues)
      toast.success(result.message || 'Reported as inaccurate')
      onOpenChange(false)
      onSuccess?.(result.created ?? issues.length)
    } catch (error: any) {
      console.error('Failed to report item issue:', error)
      toast.error('Failed to report: ' + (error.response?.data?.error || error.message))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Report Inaccurate Info
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-start gap-3 pt-2">
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={itemTitle}
                  className="w-14 h-14 rounded-md object-cover flex-shrink-0"
                />
              )}
              <span className="text-left">
                <strong className="text-foreground">{itemTitle}</strong>
                <br />
                SKU: {sku}
                <br />
                Tick what is wrong, or type your own note.
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2">Loading...</span>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {fields.map((f) => {
              const sel = getSelection(f.field)
              const active = isFieldActive(f.field)

              return (
                <div
                  key={f.field}
                  className={`border rounded-lg p-3 transition-colors ${
                    active ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20' : 'border-border'
                  }`}
                >
                  <Label className="text-sm font-semibold">{f.label}</Label>

                  <div className="mt-2 space-y-2">
                    {f.preset_notes.map((note) => (
                      <div key={note} className="flex items-start gap-2">
                        <Checkbox
                          id={`${f.field}-${note}`}
                          checked={sel.presets.includes(note)}
                          onCheckedChange={() => togglePreset(f.field, note)}
                          className="mt-0.5"
                        />
                        <label
                          htmlFor={`${f.field}-${note}`}
                          className="text-sm leading-snug cursor-pointer select-none"
                        >
                          {note}
                        </label>
                      </div>
                    ))}
                  </div>

                  <Textarea
                    value={sel.custom}
                    onChange={(e) => setCustom(f.field, e.target.value)}
                    placeholder={`Something else about the ${f.label.toLowerCase()}...`}
                    rows={2}
                    className="mt-2 text-sm"
                  />
                </div>
              )
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || submitting || activeFields.length === 0}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Reporting...
              </>
            ) : (
              `Report${activeFields.length > 0 ? ` (${activeFields.length})` : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
