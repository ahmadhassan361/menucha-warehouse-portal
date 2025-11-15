"use client"

import { useState } from "react"
import { Save, TestTube, Plus, Edit, Trash2, User, Settings, Mail, MessageSquare, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

// Mock data for demonstration
const mockUsers = [
  { id: "1", name: "John Smith", email: "john@warehouse.com", role: "Admin" },
  { id: "2", name: "Sarah Johnson", email: "sarah@warehouse.com", role: "Picker" },
  { id: "3", name: "Mike Davis", email: "mike@warehouse.com", role: "Picker" },
  { id: "4", name: "Lisa Wilson", email: "lisa@warehouse.com", role: "Manager" },
]

export function AdminPage() {
  const { toast } = useToast()

  // API Settings
  const [apiBaseUrl, setApiBaseUrl] = useState("https://api.warehouse.com/v1")
  const [apiKey, setApiKey] = useState("wh_live_sk_...")

  // Sync Settings
  const [autoSyncInterval, setAutoSyncInterval] = useState("10")
  const [syncPaidOrders, setSyncPaidOrders] = useState(true)
  const [syncProcessingOrders, setSyncProcessingOrders] = useState(true)
  const [syncUnfulfilledOrders, setSyncUnfulfilledOrders] = useState(false)

  // Email Settings
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com")
  const [smtpPort, setSmtpPort] = useState("587")
  const [smtpUser, setSmtpUser] = useState("notifications@warehouse.com")
  const [smtpPassword, setSmtpPassword] = useState("")

  // SMS Settings
  const [twilioSid, setTwilioSid] = useState("AC...")
  const [twilioAuthToken, setTwilioAuthToken] = useState("")
  const [twilioFromNumber, setTwilioFromNumber] = useState("+1234567890")

  // User Management
  const [users, setUsers] = useState(mockUsers)

  const handleSaveApiSettings = () => {
    // In real app, this would save to backend
    toast({
      title: "API Settings Saved",
      description: "API configuration has been updated successfully.",
    })
  }

  const handleSaveSyncSettings = () => {
    // In real app, this would save to backend
    toast({
      title: "Sync Settings Saved",
      description: "Synchronization preferences have been updated.",
    })
  }

  const handleSaveEmailSettings = () => {
    // In real app, this would save to backend
    toast({
      title: "Email Settings Saved",
      description: "SMTP configuration has been updated successfully.",
    })
  }

  const handleTestEmail = () => {
    // In real app, this would send a test email
    toast({
      title: "Test Email Sent",
      description: "A test email has been sent to verify SMTP configuration.",
    })
  }

  const handleSaveSmsSettings = () => {
    // In real app, this would save to backend
    toast({
      title: "SMS Settings Saved",
      description: "Twilio configuration has been updated successfully.",
    })
  }

  const handleTestSms = () => {
    // In real app, this would send a test SMS
    toast({
      title: "Test SMS Sent",
      description: "A test SMS has been sent to verify Twilio configuration.",
    })
  }

  const handleAddUser = () => {
    // In real app, this would open a modal or navigate to add user form
    toast({
      title: "Add User",
      description: "User creation form would open here.",
    })
  }

  const handleEditUser = (userId: string) => {
    // In real app, this would open edit modal
    toast({
      title: "Edit User",
      description: `Edit form for user ${userId} would open here.`,
    })
  }

  const handleDeleteUser = (userId: string) => {
    setUsers((prev) => prev.filter((user) => user.id !== userId))
    toast({
      title: "User Deleted",
      description: "User has been removed from the system.",
    })
  }

  return (
    <div className="p-4 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Admin Settings</h1>
        <p className="text-muted-foreground">Manage API settings, users, and notifications</p>
      </div>

      {/* API Settings */}
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
              placeholder="https://api.warehouse.com/v1"
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
          <Button onClick={handleSaveApiSettings} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-2" />
            Save API Settings
          </Button>
        </CardContent>
      </Card>

      {/* Sync Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Sync Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sync-interval">Auto-sync Interval</Label>
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

          <div className="space-y-3">
            <Label>Order Status Mapping</Label>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="sync-paid" className="text-sm font-normal">
                  Sync Paid Orders
                </Label>
                <Switch id="sync-paid" checked={syncPaidOrders} onCheckedChange={setSyncPaidOrders} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="sync-processing" className="text-sm font-normal">
                  Sync Processing Orders
                </Label>
                <Switch id="sync-processing" checked={syncProcessingOrders} onCheckedChange={setSyncProcessingOrders} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="sync-unfulfilled" className="text-sm font-normal">
                  Sync Unfulfilled Orders
                </Label>
                <Switch
                  id="sync-unfulfilled"
                  checked={syncUnfulfilledOrders}
                  onCheckedChange={setSyncUnfulfilledOrders}
                />
              </div>
            </div>
          </div>

          <Button onClick={handleSaveSyncSettings} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-2" />
            Save Sync Settings
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
              <Input id="smtp-port" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-user">SMTP Username</Label>
            <Input
              id="smtp-user"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              placeholder="notifications@warehouse.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-password">SMTP Password</Label>
            <Input
              id="smtp-password"
              type="password"
              value={smtpPassword}
              onChange={(e) => setSmtpPassword(e.target.value)}
              placeholder="Enter SMTP password"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveEmailSettings} className="flex-1 sm:flex-none">
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button onClick={handleTestEmail} variant="outline" className="flex-1 sm:flex-none bg-transparent">
              <TestTube className="h-4 w-4 mr-2" />
              Test Email
            </Button>
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
              placeholder="Enter Twilio auth token"
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
          <div className="flex gap-2">
            <Button onClick={handleSaveSmsSettings} className="flex-1 sm:flex-none">
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button onClick={handleTestSms} variant="outline" className="flex-1 sm:flex-none bg-transparent">
              <TestTube className="h-4 w-4 mr-2" />
              Test SMS
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* User Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              User Management
            </div>
            <Button onClick={handleAddUser} size="sm">
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
                  <div className="font-medium text-foreground">{user.name}</div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={user.role === "Admin" ? "default" : "secondary"}>{user.role}</Badge>
                  <div className="flex gap-1">
                    <Button onClick={() => handleEditUser(user.id)} size="sm" variant="outline">
                      <Edit className="h-3 w-3" />
                    </Button>
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
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
