"use client"

import { useState, useEffect } from "react"
import { Save, TestTube, Plus, Edit, Trash2, User, Settings, Mail, MessageSquare, RefreshCw, Loader2, Key } from "lucide-react"
import { authService } from "@/services/auth.service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { adminService } from "@/services/admin.service"
import { toast } from "sonner"

interface User {
  id: number
  username: string
  email: string
  role: string
}

export function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userRole, setUserRole] = useState('')
  
  // API Settings
  const [apiBaseUrl, setApiBaseUrl] = useState("")
  const [apiKey, setApiKey] = useState("")

  // Sync Settings
  const [autoSyncInterval, setAutoSyncInterval] = useState("10")
  const [lastSync, setLastSync] = useState<string | null>(null)

  // Email/SMS Settings
  const [smtpHost, setSmtpHost] = useState("")
  const [smtpPort, setSmtpPort] = useState("")
  const [smtpUser, setSmtpUser] = useState("")
  const [smtpPassword, setSmtpPassword] = useState("")
  const [twilioSid, setTwilioSid] = useState("")
  const [twilioAuthToken, setTwilioAuthToken] = useState("")
  const [twilioFromNumber, setTwilioFromNumber] = useState("")

  // User Management
  const [users, setUsers] = useState<User[]>([])
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userFormData, setUserFormData] = useState({ username: '', email: '', password: '', role: 'staff' })
  const [resetPassword, setResetPassword] = useState('')

  // Change Password
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    const user = authService.getStoredUser()
    if (user) {
      setCurrentUser(user)
      setUserRole(user.role || '')
    }
    
    // Only load settings if user has permission
    if (user && user.role === 'superadmin') {
      loadSettings()
    } else {
      setLoading(false)
    }
    
    // Load users if admin or superadmin
    if (user && (user.role === 'admin' || user.role === 'superadmin')) {
      loadUsers()
    }
    
    loadSyncStatus()
  }, [])

  const isSuperadmin = userRole === 'superadmin'
  const isAdminOrSuperadmin = userRole === 'admin' || userRole === 'superadmin'
  const isStaff = userRole === 'staff'

  const loadSettings = async () => {
    try {
      const [apiSettings, emailSmsSettings] = await Promise.all([
        adminService.getSettings(),
        adminService.getEmailSMSSettings()
      ])
      
      setApiBaseUrl(apiSettings.api_base_url || '')
      setApiKey(apiSettings.api_key || '')
      setAutoSyncInterval(apiSettings.sync_interval?.toString() || '10')
      
      setSmtpHost(emailSmsSettings.smtp_host || '')
      setSmtpPort(emailSmsSettings.smtp_port?.toString() || '')
      setSmtpUser(emailSmsSettings.smtp_user || '')
      setTwilioSid(emailSmsSettings.twilio_account_sid || '')
      setTwilioFromNumber(emailSmsSettings.twilio_from_number || '')
    } catch (error: any) {
      console.error('Failed to load settings:', error)
      toast.error('Failed to load settings: ' + (error.response?.data?.message || error.message))
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      const data = await adminService.getUsers()
      console.log('Users API response:', data)
      
      // Handle different response formats
      if (Array.isArray(data)) {
        setUsers(data)
      } else if (data && Array.isArray(data.results)) {
        // Django REST Framework pagination format
        setUsers(data.results)
      } else if (data && Array.isArray(data.users)) {
        // Custom users array
        setUsers(data.users)
      } else {
        console.warn('Unexpected user data format:', data)
        setUsers([])
      }
    } catch (error: any) {
      console.error('Failed to load users:', error)
      toast.error('Failed to load users: ' + (error.response?.data?.message || error.message))
      setUsers([])
    }
  }

  const loadSyncStatus = async () => {
    try {
      const status = await adminService.getSyncStatus()
      setLastSync(status.last_sync_at)
    } catch (error) {
      console.error('Failed to load sync status:', error)
    }
  }

  const handleSyncNow = async () => {
    try {
      setSyncing(true)
      toast.info('Starting sync...')
      const result = await adminService.syncNow()
      toast.success(result.message || 'Sync completed successfully')
      await loadSyncStatus()
    } catch (error: any) {
      console.error('Sync failed:', error)
      toast.error('Sync failed: ' + (error.response?.data?.message || error.message))
    } finally {
      setSyncing(false)
    }
  }

  const handleSaveApiSettings = async () => {
    try {
      await adminService.updateSettings({
        api_base_url: apiBaseUrl,
        api_key: apiKey,
        sync_interval: parseInt(autoSyncInterval)
      })
      toast.success('API settings saved successfully')
    } catch (error: any) {
      console.error('Failed to save API settings:', error)
      toast.error('Failed to save: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleSaveEmailSmsSettings = async () => {
    try {
      await adminService.updateEmailSMSSettings({
        smtp_host: smtpHost,
        smtp_port: parseInt(smtpPort) || 587,
        smtp_user: smtpUser,
        smtp_password: smtpPassword || undefined,
        twilio_account_sid: twilioSid,
        twilio_auth_token: twilioAuthToken || undefined,
        twilio_from_number: twilioFromNumber
      })
      toast.success('Email/SMS settings saved successfully')
      // Clear passwords after saving
      setSmtpPassword('')
      setTwilioAuthToken('')
    } catch (error: any) {
      console.error('Failed to save email/SMS settings:', error)
      toast.error('Failed to save: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return
    
    try {
      await adminService.deleteUser(userId)
      toast.success('User deleted successfully')
      await loadUsers()
    } catch (error: any) {
      console.error('Failed to delete user:', error)
      toast.error('Failed to delete user: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleCreateUser = async () => {
    try {
      await adminService.createUser(userFormData)
      toast.success('User created successfully')
      setShowUserDialog(false)
      setUserFormData({ username: '', email: '', password: '', role: 'staff' })
      await loadUsers()
    } catch (error: any) {
      console.error('Failed to create user:', error)
      toast.error('Failed to create user: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleResetUserPassword = async () => {
    if (!selectedUser || !resetPassword) return
    
    try {
      await adminService.resetUserPassword(selectedUser.id, resetPassword)
      toast.success('Password reset successfully')
      setShowResetPasswordDialog(false)
      setSelectedUser(null)
      setResetPassword('')
    } catch (error: any) {
      console.error('Failed to reset password:', error)
      toast.error('Failed to reset password: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    
    try {
      await authService.changePassword(currentPassword, newPassword)
      toast.success('Password changed successfully')
      setShowChangePasswordDialog(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      console.error('Failed to change password:', error)
      toast.error('Failed to change password: ' + (error.response?.data?.message || error.message))
    }
  }

  const formatLastSync = (dateString: string | null) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Admin Settings</h1>
        <p className="text-muted-foreground">Manage API settings, users, and notifications</p>
      </div>

      {/* Sync Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Order Sync
            </div>
            <Button onClick={handleSyncNow} disabled={syncing} size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Last sync: {formatLastSync(lastSync)}
          </p>
        </CardContent>
      </Card>

      {/* API Settings - Superadmin Only */}
      {isSuperadmin && (
      <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            API Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-url">API Base URL</Label>
            <Input
              id="api-url"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="https://api.example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key/Token</Label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sync-interval">Auto-sync Interval (minutes)</Label>
            <Select value={autoSyncInterval} onValueChange={setAutoSyncInterval}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">Every 5 minutes</SelectItem>
                <SelectItem value="10">Every 10 minutes</SelectItem>
                <SelectItem value="15">Every 15 minutes</SelectItem>
                <SelectItem value="30">Every 30 minutes</SelectItem>
                <SelectItem value="60">Every hour</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSaveApiSettings} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-2" />
            Save API Settings
          </Button>
        </CardContent>
      </Card>

      {/* Email Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtp-host">SMTP Host</Label>
              <Input
                id="smtp-host"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-port">SMTP Port</Label>
              <Input 
                id="smtp-port" 
                value={smtpPort} 
                onChange={(e) => setSmtpPort(e.target.value)} 
                placeholder="587" 
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-user">SMTP Username</Label>
            <Input
              id="smtp-user"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              placeholder="notifications@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-password">SMTP Password</Label>
            <Input
              id="smtp-password"
              type="password"
              value={smtpPassword}
              onChange={(e) => setSmtpPassword(e.target.value)}
              placeholder="Enter SMTP password (leave blank to keep current)"
            />
          </div>
        </CardContent>
      </Card>

      {/* SMS Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            SMS Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="twilio-sid">Twilio Account SID</Label>
            <Input
              id="twilio-sid"
              value={twilioSid}
              onChange={(e) => setTwilioSid(e.target.value)}
              placeholder="AC..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="twilio-token">Twilio Auth Token</Label>
            <Input
              id="twilio-token"
              type="password"
              value={twilioAuthToken}
              onChange={(e) => setTwilioAuthToken(e.target.value)}
              placeholder="Enter Twilio auth token (leave blank to keep current)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="twilio-from">From Phone Number</Label>
            <Input
              id="twilio-from"
              value={twilioFromNumber}
              onChange={(e) => setTwilioFromNumber(e.target.value)}
              placeholder="+1234567890"
            />
          </div>
          <Button onClick={handleSaveEmailSmsSettings} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-2" />
            Save Email/SMS Settings
          </Button>
        </CardContent>
      </Card>
      </>
      )}

      {/* User Management - Admin/Superadmin Only */}
      {isAdminOrSuperadmin && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              User Management
            </div>
            <Button onClick={() => setShowUserDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 border border-border rounded-md">
                <div className="flex-1">
                  <div className="font-medium text-foreground">{user.username}</div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                  <Button
                    onClick={() => handleDeleteUser(user.id)}
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No users found
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Change Password - All Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Update your account password
          </p>
          <Button onClick={() => setShowChangePasswordDialog(true)}>
            <Key className="h-4 w-4 mr-2" />
            Change My Password
          </Button>
        </CardContent>
      </Card>

      {/* Change Password Dialog */}
      <Dialog open={showChangePasswordDialog} onOpenChange={setShowChangePasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new password
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangePasswordDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangePassword}>
              Change Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account with username, email, and password
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-username">Username</Label>
              <Input
                id="user-username"
                value={userFormData.username}
                onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                placeholder="Enter username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={userFormData.email}
                onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">Password</Label>
              <Input
                id="user-password"
                type="password"
                value={userFormData.password}
                onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                placeholder="Enter password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-role">Role</Label>
              <Select value={userFormData.role} onValueChange={(value) => setUserFormData({ ...userFormData, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser}>
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={showResetPasswordDialog} onOpenChange={setShowResetPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset User Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-password">New Password</Label>
              <Input
                id="reset-password"
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetPasswordDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleResetUserPassword}>
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="mt-8 pb-4 text-center text-sm text-muted-foreground border-t pt-4">
        <p>Developed and maintained by <strong>Midpear Studio (PVT)</strong></p>
        <a 
          href="https://midpear.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          midpear.com
        </a>
      </footer>
    </div>
  )
}
