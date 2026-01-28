import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCadences } from '@/hooks/useCadences'
import type { Cadence, CadenceInsert } from '@/types'
import {
  Workflow,
  Plus,
  Search,
  MoreHorizontal,
  Play,
  Pause,
  Pencil,
  Trash2,
  Users,
  ChevronRight,
} from 'lucide-react'

export function Cadences() {
  const navigate = useNavigate()
  const {
    cadences,
    loading,
    error,
    fetchCadences,
    createCadence,
    deleteCadence,
    activateCadence,
    pauseCadence,
  } = useCadences()

  const [search, setSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState<CadenceInsert>({ name: '', status: 'draft' })

  useEffect(() => {
    fetchCadences()
  }, [fetchCadences])

  const filteredCadences = search
    ? cadences.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : cadences

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const cadence = await createCadence(formData)
    if (cadence) {
      setIsDialogOpen(false)
      setFormData({ name: '', status: 'draft' })
      navigate(`/cadences/${cadence.id}`)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this cadence? This will also remove all enrolled leads.')) {
      await deleteCadence(id)
    }
  }

  const handleToggleStatus = async (cadence: Cadence) => {
    if (cadence.status === 'active') {
      await pauseCadence(cadence.id)
    } else {
      await activateCadence(cadence.id)
    }
  }

  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>
    }
    return <Badge variant="secondary">Draft</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cadences</h1>
          <p className="text-muted-foreground">
            Create and manage your outreach sequences
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Cadence
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cadences</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{cadences.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-green-500" />
              <span className="text-2xl font-bold">
                {cadences.filter(c => c.status === 'active').length}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Draft</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Pause className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">
                {cadences.filter(c => c.status === 'draft').length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search cadences..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-500">{error}</div>
      )}

      {/* Cadences List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredCadences.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Your Cadences</CardTitle>
            <CardDescription>
              Automated sequences for prospecting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Workflow className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {search ? 'No cadences found' : 'No cadences yet'}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                {search
                  ? 'Try a different search term'
                  : 'Create your first cadence to start automating your LinkedIn outreach'}
              </p>
              {!search && (
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Cadence
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredCadences.map((cadence) => (
            <Card
              key={cadence.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate(`/cadences/${cadence.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Workflow className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{cadence.name}</h3>
                        {getStatusBadge(cadence.status)}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          0 leads
                        </span>
                        <span>
                          Created {new Date(cadence.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/cadences/${cadence.id}`)
                        }}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          handleToggleStatus(cadence)
                        }}>
                          {cadence.status === 'active' ? (
                            <>
                              <Pause className="mr-2 h-4 w-4" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="mr-2 h-4 w-4" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(cadence.id)
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Create New Cadence</DialogTitle>
              <DialogDescription>
                Give your cadence a name to get started. You can add steps and enroll leads later.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Cadence Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Q1 Outreach Campaign"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !formData.name.trim()}>
                Create Cadence
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
