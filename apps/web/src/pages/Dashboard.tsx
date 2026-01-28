import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { useLeads } from '@/hooks/useLeads'
import { useCadences } from '@/hooks/useCadences'
import { useExecution } from '@/hooks/useExecution'
import { useActivity } from '@/hooks/useActivity'
import { Link, useNavigate } from 'react-router-dom'
import {
  Users,
  Workflow,
  Send,
  Activity,
  Plus,
  ArrowRight,
  CheckCircle,
  XCircle,
  MessageSquare,
  Heart,
} from 'lucide-react'

interface RecentActivityItem {
  id: string;
  action: string;
  status: 'ok' | 'failed';
  created_at: string;
  lead_name?: string;
  cadence_name?: string;
}

export function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { total: totalLeads, fetchLeads } = useLeads()
  const { cadences, fetchCadences } = useCadences()
  const { getWeeklyStats } = useExecution()
  const { getRecentActivity } = useActivity()

  const [weeklyStats, setWeeklyStats] = useState<{ linkedin_sent: number; sales_navigator_sent: number } | null>(null)
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([
        fetchLeads({ limit: 1 }),
        fetchCadences(),
      ])

      const stats = await getWeeklyStats()
      if (stats) {
        setWeeklyStats(stats)
      }

      const activity = await getRecentActivity(5)
      setRecentActivity(activity)

      setLoading(false)
    }

    loadData()
  }, [fetchLeads, fetchCadences, getWeeklyStats, getRecentActivity])

  const activeCadences = cadences.filter(c => c.status === 'active')
  const totalMessagesSent = weeklyStats ? weeklyStats.linkedin_sent + weeklyStats.sales_navigator_sent : 0

  const stats = [
    { name: 'Total Leads', value: totalLeads.toString(), icon: Users, change: 'All time' },
    { name: 'Active Cadences', value: activeCadences.length.toString(), icon: Workflow, change: `${cadences.length} total` },
    { name: 'Messages Sent', value: totalMessagesSent.toString(), icon: Send, change: 'This week' },
    { name: 'Recent Actions', value: recentActivity.length.toString(), icon: Activity, change: 'Last 5 actions' },
  ]

  const getActionIcon = (action: string) => {
    if (action.includes('message')) return <MessageSquare className="h-4 w-4" />
    if (action.includes('like')) return <Heart className="h-4 w-4" />
    return <Activity className="h-4 w-4" />
  }

  const formatAction = (action: string) => {
    return action
      .replace(/_/g, ' ')
      .replace('success', '')
      .replace('failed', '')
      .trim()
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.email}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/leads">
              <Plus className="mr-2 h-4 w-4" />
              Add Lead
            </Link>
          </Button>
          <Button asChild>
            <Link to="/cadences">
              <Workflow className="mr-2 h-4 w-4" />
              New Cadence
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.name}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16 mb-1" />
              ) : (
                <div className="text-2xl font-bold">{stat.value}</div>
              )}
              <p className="text-xs text-muted-foreground">
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Weekly Limits */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Limits</CardTitle>
            <CardDescription>
              Track your LinkedIn messaging usage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">LinkedIn Messages</p>
                <p className="text-xs text-muted-foreground">
                  {weeklyStats?.linkedin_sent || 0} / 100 this week
                </p>
              </div>
              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min((weeklyStats?.linkedin_sent || 0), 100)}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">InMail Messages</p>
                <p className="text-xs text-muted-foreground">
                  {weeklyStats?.sales_navigator_sent || 0} / 50 this week
                </p>
              </div>
              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${Math.min((weeklyStats?.sales_navigator_sent || 0) * 2, 100)}%` }}
                />
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link to="/settings">
                Manage Connection
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Your latest outreach actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No recent activity</p>
                <p className="text-sm text-muted-foreground">
                  Start a cadence to see activity here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted">
                      {getActionIcon(activity.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {formatAction(activity.action)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {activity.cadence_name || 'Unknown cadence'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {activity.status === 'ok' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatTime(activity.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="w-full" asChild>
                  <Link to="/activity">
                    View All Activity
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Cadences */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Active Cadences</CardTitle>
            <CardDescription>
              Your running outreach sequences
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/cadences">
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {activeCadences.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Workflow className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No active cadences</p>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first cadence to start prospecting
              </p>
              <Button asChild>
                <Link to="/cadences">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Cadence
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeCadences.slice(0, 5).map((cadence) => (
                <div
                  key={cadence.id}
                  className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/cadences/${cadence.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Workflow className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{cadence.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Created {new Date(cadence.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
