import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/contexts/AuthContext'
import { useExecution } from '@/hooks/useExecution'
import { api } from '@/services/api'
import { Linkedin, CheckCircle, XCircle, ExternalLink, RefreshCw } from 'lucide-react'

interface ConnectionStatus {
  connected: boolean;
  account_id?: string;
}

export function Settings() {
  const { user } = useAuth()
  const { getWeeklyStats } = useExecution()

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ connected: false })
  const [weeklyStats, setWeeklyStats] = useState<{ linkedin_sent: number; sales_navigator_sent: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)

      // Get weekly stats
      const stats = await getWeeklyStats()
      if (stats) {
        setWeeklyStats(stats)
      }

      // Check connection status
      try {
        const response = await api.get<{ success: boolean; data: ConnectionStatus }>('/api/unipile/status')
        if (response.success && response.data) {
          setConnectionStatus(response.data)
        }
      } catch {
        // Ignore error - user may not be connected
      }

      setLoading(false)
    }

    loadData()
  }, [getWeeklyStats])

  const handleConnectLinkedIn = async () => {
    setConnecting(true)
    try {
      const response = await api.post<{ success: boolean; data: { auth_url: string } }>('/api/unipile/connect/linkedin')
      if (response.success && response.data?.auth_url) {
        // Open in new window
        window.open(response.data.auth_url, '_blank', 'width=600,height=700')
      }
    } catch (err) {
      console.error('Failed to connect:', err)
    } finally {
      setConnecting(false)
    }
  }

  const handleRefreshStatus = async () => {
    setLoading(true)
    try {
      const response = await api.get<{ success: boolean; data: ConnectionStatus }>('/api/unipile/status')
      if (response.success && response.data) {
        setConnectionStatus(response.data)
      }
    } catch {
      // Ignore
    }
    setLoading(false)
  }

  const linkedinSentPercent = weeklyStats ? Math.min((weeklyStats.linkedin_sent / 100) * 100, 100) : 0
  const inmailSentPercent = weeklyStats ? Math.min((weeklyStats.sales_navigator_sent / 50) * 100, 100) : 0

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and connections
        </p>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Your account information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">User ID</p>
              <p className="text-sm text-muted-foreground font-mono">{user?.id}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LinkedIn Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Linkedin className="h-5 w-5" />
            LinkedIn Connection
          </CardTitle>
          <CardDescription>
            Connect your LinkedIn account via Unipile to enable automation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Linkedin className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">LinkedIn Account</p>
                  {connectionStatus.connected ? (
                    <Badge className="bg-green-500 hover:bg-green-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      Not Connected
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {connectionStatus.connected
                    ? 'Your LinkedIn account is connected and ready'
                    : 'Connect to send messages and interact with leads'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefreshStatus}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                onClick={handleConnectLinkedIn}
                variant={connectionStatus.connected ? 'outline' : 'default'}
                disabled={connecting}
              >
                {connecting ? 'Connecting...' : connectionStatus.connected ? 'Reconnect' : 'Connect'}
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-4 p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">
              <strong>How it works:</strong> Clicking connect will open a secure Unipile
              authentication window where you can safely log into your LinkedIn account.
              Your credentials are never stored on our servers.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Rate Limits */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Limits</CardTitle>
          <CardDescription>
            LinkedIn has rate limits to prevent spam. We track your usage automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">LinkedIn Messages</p>
              <p className="text-sm text-muted-foreground">
                {weeklyStats?.linkedin_sent || 0} / 100 this week
              </p>
            </div>
            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${linkedinSentPercent}%` }}
              />
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">InMail Messages</p>
              <p className="text-sm text-muted-foreground">
                {weeklyStats?.sales_navigator_sent || 0} / 50 this week
              </p>
            </div>
            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${inmailSentPercent}%` }}
              />
            </div>
          </div>

          {(linkedinSentPercent >= 80 || inmailSentPercent >= 80) && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-sm text-yellow-600">
                You're approaching your weekly limit. Consider pacing your outreach.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
