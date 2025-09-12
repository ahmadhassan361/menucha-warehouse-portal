"use client"

import { Package, CheckCircle, AlertTriangle, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

interface BottomNavigationProps {
  activeTab: string
  onTabChange: (tab: string) => void
  userRole: string
}

export function BottomNavigation({ activeTab, onTabChange, userRole }: BottomNavigationProps) {
  const tabs = [
    {
      id: "pick-list",
      label: "Pick List",
      icon: Package,
    },
    {
      id: "ready-to-pack",
      label: "Ready to Pack",
      icon: CheckCircle,
    },
    {
      id: "out-of-stock",
      label: "Out of Stock",
      icon: AlertTriangle,
    },
    ...(userRole === "admin"
      ? [
          {
            id: "admin",
            label: "Admin",
            icon: Settings,
          },
        ]
      : []),
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
      <div className="flex">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-2 px-1 min-h-[60px] transition-colors",
                isActive ? "text-primary-foreground bg-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5 mb-1", isActive && "text-primary-foreground")} />
              <span className="text-xs font-medium leading-none">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
