"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { LogOut, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authService } from "@/services/auth.service"
import { toast } from "sonner"

interface AppHeaderProps {
  onAdminClick?: () => void
}

export function AppHeader({ onAdminClick }: AppHeaderProps) {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const storedUser = authService.getStoredUser()
    if (storedUser) {
      setUser(storedUser)
    }
  }, [])

  const handleLogout = async () => {
    try {
      await authService.logout()
      toast.success('Logged out successfully')
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('Logout failed')
    }
  }

  const handleUsernameClick = () => {
    // Allow all users to access admin page (staff can change password)
    if (onAdminClick && user) {
      onAdminClick()
    }
  }

  if (!user) return null

  // All users can access admin page now (staff will only see Change Password section)
  const canAccessAdmin = true

  return (
    <header className=" top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Warehouse Portal</h1>
        </div>

        <div className="flex items-center gap-3">
          <div 
            className={`flex flex-col items-end ${canAccessAdmin ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            onClick={handleUsernameClick}
          >
            <span className="text-sm font-medium">{user.username}</span>
            <span className="text-xs text-muted-foreground capitalize">
              {user.role}
              {' • Click for Settings'}
            </span>
          </div>
          <Button 
            onClick={handleLogout} 
            variant="outline" 
            size="sm"
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
