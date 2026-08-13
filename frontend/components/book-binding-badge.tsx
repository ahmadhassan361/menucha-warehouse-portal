"use client"

import { BookMarked } from "lucide-react"
import { cn } from "@/lib/utils"

export interface BookBindingDetail {
  order_number: string
  qty: number
  detail: string
}

interface BookBindingBadgeProps {
  /** Binding instruction for a single order line, e.g. "1 of 1 copies" */
  detail?: string | null
  /**
   * Aggregated views (the pick list) group several orders under one SKU, and
   * only some of those units may need binding. Pass both to show "2 of 5".
   */
  qty?: number
  total?: number
  /** Per-order breakdown, shown under the badge in aggregated views */
  details?: BookBindingDetail[]
  className?: string
}

/**
 * Highlights that an item needs book binding. Used on every screen that lists
 * items so the mark looks identical wherever a picker sees it.
 */
export function BookBindingBadge({ detail, qty, total, details, className }: BookBindingBadgeProps) {
  const showCount = typeof qty === "number" && qty > 0
  // Only worth calling out "2 of 5" when part of the SKU needs binding
  const isPartial = showCount && typeof total === "number" && total > qty

  return (
    <div className={cn("space-y-1", className)}>
      <div className="inline-flex items-center gap-1.5 rounded-md border border-violet-500 bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700 dark:border-violet-400 dark:bg-violet-950/40 dark:text-violet-300">
        <BookMarked className="h-3.5 w-3.5 flex-shrink-0" />
        <span>Book Binding</span>
        {showCount && (
          <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-violet-500">
            {isPartial ? `${qty} of ${total}` : `x${qty}`}
          </span>
        )}
        {detail && <span className="font-normal">— {detail}</span>}
      </div>

      {details && details.length > 0 && (
        <ul className="ml-1 space-y-0.5 text-xs text-violet-700 dark:text-violet-300">
          {details.map((d, i) => (
            <li key={`${d.order_number}-${i}`}>
              Order #{d.order_number}: {d.qty}x{d.detail ? ` — ${d.detail}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
