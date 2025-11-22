"use client"

import { useState, useEffect } from "react"
import { PickListPage } from "@/components/pick-list-page"
import { PickedItemsPage } from "@/components/picked-items-page"
import { OrderStatusPage } from "@/components/order-status-page"
import { ReadyToPackPage } from "@/components/ready-to-pack-page"
import { PackedOrdersPage } from "@/components/packed-orders-page"
import { OutOfStockPage } from "@/components/out-of-stock-page"
import { AdminPage } from "@/components/admin-page"
import { BottomNavigation } from "@/components/bottom-navigation"
import { ProtectedRoute } from "@/components/protected-route"
import { AppHeader } from "@/components/app-header"
import { authService } from "@/services/auth.service"

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("pick-list")
  const [userRole, setUserRole] = useState("picker")

  useEffect(() => {
    const user = authService.getStoredUser()
    if (user && user.role) {
      setUserRole(user.role)
    }
  }, [])

  const renderActivePage = () => {
    switch (activeTab) {
      case "pick-list":
        return <PickListPage />
      case "picked-items":
        return <PickedItemsPage />
      case "order-status":
        return <OrderStatusPage />
      case "ready-to-pack":
        return <ReadyToPackPage />
      case "packed-orders":
        return <PackedOrdersPage />
      case "out-of-stock":
        return <OutOfStockPage />
      case "admin":
        // Allow all users to access admin page (staff can change password)
        return <AdminPage />
      default:
        return <PickListPage />
    }
  }

  const handleAdminClick = () => {
    setActiveTab("admin")
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background flex flex-col">
        <AppHeader onAdminClick={handleAdminClick} />
        <main className="flex-1 pb-16">{renderActivePage()}</main>
        <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} userRole={userRole} />
      </div>
    </ProtectedRoute>
  )
}
