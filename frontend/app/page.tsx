"use client"

import { useState } from "react"
import { PickListPage } from "@/components/pick-list-page"
import { ReadyToPackPage } from "@/components/ready-to-pack-page"
import { OutOfStockPage } from "@/components/out-of-stock-page"
import { AdminPage } from "@/components/admin-page"
import { BottomNavigation } from "@/components/bottom-navigation"

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("pick-list")
  const [userRole] = useState("admin") // This would come from auth context

  const renderActivePage = () => {
    switch (activeTab) {
      case "pick-list":
        return <PickListPage />
      case "ready-to-pack":
        return <ReadyToPackPage />
      case "out-of-stock":
        return <OutOfStockPage />
      case "admin":
        return userRole === "admin" ? <AdminPage /> : <PickListPage />
      default:
        return <PickListPage />
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 pb-16">{renderActivePage()}</main>
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} userRole={userRole} />
    </div>
  )
}
