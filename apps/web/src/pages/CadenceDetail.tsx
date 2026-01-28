import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCadences } from '@/hooks/useCadences'
import { useLeads } from '@/hooks/useLeads'
import { useExecution } from '@/hooks/useExecution'
import { toast } from '@/hooks/useToast'
import type { CadenceWithSteps, CadenceStep, CadenceStepInsert, CadenceLead, StepType } from '@/types'
import {
  ArrowLeft,
  Play,
  Pause,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
  MessageSquare,
  Heart,
  UserPlus,
  Mail,
  Phone,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react'

const STEP_TYPES: { value: StepType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'linkedin_message', label: 'LinkedIn Message', icon: <MessageSquare className="h-4 w-4" />, description: 'Send a direct message on LinkedIn' },
  { value: 'linkedin_like', label: 'Like Post', icon: <Heart className="h-4 w-4" />, description: 'Like the lead\'s latest post' },
  { value: 'linkedin_connect', label: 'Connection Request', icon: <UserPlus className="h-4 w-4" />, description: 'Send a connection request' },
  { value: 'linkedin_comment', label: 'Comment on Post', icon: <MessageSquare className="h-4 w-4" />, description: 'Comment on the lead\'s post' },
  { value: 'send_email', label: 'Send Email', icon: <Mail className="h-4 w-4" />, description: 'Send an email' },
  { value: 'call_manual', label: 'Manual Call', icon: <Phone className="h-4 w-4" />, description: 'Reminder to make a call' },
]

const emptyStep: CadenceStepInsert = {
  step_type: 'linkedin_message',
  step_label: null,
  day_offset: 0,
  order_in_day: 1,
  config_json: null,
}

export function CadenceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    getCadence,
    activateCadence,
    pauseCadence,
    createStep,
    updateStep,
    deleteStep,
    getCadenceLeads,
    enrollLeads,
    unenrollLead,
  } = useCadences()
  const { leads, fetchLeads } = useLeads()
  const { executeNextStep, executeBatch, loading: executing } = useExecution()

  const [cadence, setCadence] = useState<CadenceWithSteps | null>(null)
  const [cadenceLeads, setCadenceLeads] = useState<CadenceLead[]>([])
  const [loading, setLoading] = useState(true)
  const [isStepDialogOpen, setIsStepDialogOpen] = useState(false)
  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = useState(false)
  const [editingStep, setEditingStep] = useState<CadenceStep | null>(null)
  const [stepFormData, setStepFormData] = useState<CadenceStepInsert>(emptyStep)
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
  const [executingLeadId, setExecutingLeadId] = useState<string | null>(null)
  const [executionResults, setExecutionResults] = useState<Record<string, 'success' | 'error' | null>>({})

  const loadCadence = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const data = await getCadence(id)
    setCadence(data)
    const enrolledLeads = await getCadenceLeads(id)
    setCadenceLeads(enrolledLeads)
    setLoading(false)
  }, [id, getCadence, getCadenceLeads])

  useEffect(() => {
    loadCadence()
  }, [loadCadence])

  const handleToggleStatus = async () => {
    if (!cadence) return
    if (cadence.status === 'active') {
      const updated = await pauseCadence(cadence.id)
      if (updated) setCadence({ ...cadence, status: 'draft' })
    } else {
      const updated = await activateCadence(cadence.id)
      if (updated) setCadence({ ...cadence, status: 'active' })
    }
  }

  const handleOpenCreateStep = () => {
    setEditingStep(null)
    setStepFormData({
      ...emptyStep,
      day_offset: cadence?.steps?.length ? Math.max(...cadence.steps.map(s => s.day_offset)) : 0,
      order_in_day: 1,
    })
    setIsStepDialogOpen(true)
  }

  const handleOpenEditStep = (step: CadenceStep) => {
    setEditingStep(step)
    setStepFormData({
      step_type: step.step_type,
      step_label: step.step_label,
      day_offset: step.day_offset,
      order_in_day: step.order_in_day,
      config_json: step.config_json,
    })
    setIsStepDialogOpen(true)
  }

  const handleSaveStep = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !cadence) return

    if (editingStep) {
      const updated = await updateStep(id, editingStep.id, stepFormData)
      if (updated) {
        setCadence({
          ...cadence,
          steps: cadence.steps.map(s => s.id === editingStep.id ? updated : s),
        })
      }
    } else {
      const created = await createStep(id, stepFormData)
      if (created) {
        setCadence({
          ...cadence,
          steps: [...cadence.steps, created],
        })
      }
    }

    setIsStepDialogOpen(false)
    setEditingStep(null)
    setStepFormData(emptyStep)
  }

  const handleDeleteStep = async (stepId: string) => {
    if (!id || !cadence) return
    if (confirm('Are you sure you want to delete this step?')) {
      const success = await deleteStep(id, stepId)
      if (success) {
        setCadence({
          ...cadence,
          steps: cadence.steps.filter(s => s.id !== stepId),
        })
      }
    }
  }

  const handleOpenEnroll = async () => {
    await fetchLeads()
    setSelectedLeadIds([])
    setIsEnrollDialogOpen(true)
  }

  const handleEnroll = async () => {
    if (!id || selectedLeadIds.length === 0) return
    const enrolled = await enrollLeads(id, selectedLeadIds)
    setCadenceLeads([...cadenceLeads, ...enrolled])
    setIsEnrollDialogOpen(false)
    setSelectedLeadIds([])
  }

  const handleUnenroll = async (leadId: string) => {
    if (!id) return
    if (confirm('Remove this lead from the cadence?')) {
      const success = await unenrollLead(id, leadId)
      if (success) {
        setCadenceLeads(cadenceLeads.filter(cl => cl.lead_id !== leadId))
      }
    }
  }

  const handleExecuteLead = async (cadenceLeadId: string) => {
    setExecutingLeadId(cadenceLeadId)
    setExecutionResults(prev => ({ ...prev, [cadenceLeadId]: null }))

    const result = await executeNextStep(cadenceLeadId)

    setExecutionResults(prev => ({
      ...prev,
      [cadenceLeadId]: result ? 'success' : 'error',
    }))
    setExecutingLeadId(null)

    if (result) {
      toast({
        title: 'Step executed',
        description: 'The action was completed successfully.',
        variant: 'success',
      })
    } else {
      toast({
        title: 'Execution failed',
        description: 'There was an error executing the step.',
        variant: 'destructive',
      })
    }

    // Refresh cadence leads to get updated status
    if (id) {
      const enrolledLeads = await getCadenceLeads(id)
      setCadenceLeads(enrolledLeads)
    }
  }

  const handleExecuteAll = async () => {
    if (!id) return
    const result = await executeBatch(id, 10)
    if (result) {
      toast({
        title: 'Batch execution complete',
        description: `Executed ${result.executed} of ${result.total} steps.`,
        variant: 'success',
      })
      // Refresh cadence leads
      const enrolledLeads = await getCadenceLeads(id)
      setCadenceLeads(enrolledLeads)
    } else {
      toast({
        title: 'Batch execution failed',
        description: 'There was an error executing the batch.',
        variant: 'destructive',
      })
    }
  }

  const getStepIcon = (type: StepType) => {
    const stepType = STEP_TYPES.find(st => st.value === type)
    return stepType?.icon || <MessageSquare className="h-4 w-4" />
  }

  const getStepLabel = (type: StepType) => {
    const stepType = STEP_TYPES.find(st => st.value === type)
    return stepType?.label || type
  }

  const sortedSteps = cadence?.steps?.slice().sort((a, b) => {
    if (a.day_offset !== b.day_offset) return a.day_offset - b.day_offset
    return a.order_in_day - b.order_in_day
  }) || []

  // Get leads not already enrolled
  const availableLeads = leads.filter(
    lead => !cadenceLeads.some(cl => cl.lead_id === lead.id)
  )

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!cadence) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Cadence not found</p>
        <Button variant="link" onClick={() => navigate('/cadences')}>
          Back to Cadences
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/cadences')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{cadence.name}</h1>
            {cadence.status === 'active' ? (
              <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>
            ) : (
              <Badge variant="secondary">Draft</Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            {sortedSteps.length} steps | {cadenceLeads.length} leads enrolled
          </p>
        </div>
        <Button
          variant={cadence.status === 'active' ? 'outline' : 'default'}
          onClick={handleToggleStatus}
        >
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
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Steps */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Steps</CardTitle>
                <CardDescription>Define the sequence of actions</CardDescription>
              </div>
              <Button size="sm" onClick={handleOpenCreateStep}>
                <Plus className="mr-2 h-4 w-4" />
                Add Step
              </Button>
            </CardHeader>
            <CardContent>
              {sortedSteps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No steps yet. Add your first step to define the sequence.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedSteps.map((step, index) => (
                    <div
                      key={step.id}
                      className="flex items-center gap-4 p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-medium">
                        {index + 1}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        {getStepIcon(step.step_type)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">
                          {step.step_label || getStepLabel(step.step_type)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Day {step.day_offset}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenEditStep(step)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteStep(step.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Enrolled Leads */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Enrolled Leads</CardTitle>
                <CardDescription>{cadenceLeads.length} leads</CardDescription>
              </div>
              <div className="flex gap-2">
                {cadenceLeads.length > 0 && cadence.status === 'active' && (
                  <Button
                    size="sm"
                    onClick={handleExecuteAll}
                    disabled={executing}
                  >
                    {executing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Send All
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={handleOpenEnroll}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {cadenceLeads.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No leads enrolled yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {cadenceLeads.map((cl) => (
                    <div
                      key={cl.id}
                      className="flex items-center justify-between p-3 rounded border"
                    >
                      <div className="text-sm flex-1">
                        <p className="font-medium">Lead #{cl.lead_id.slice(0, 8)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant={cl.status === 'sent' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {cl.status}
                          </Badge>
                          {executionResults[cl.id] === 'success' && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                          {executionResults[cl.id] === 'error' && (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {cadence.status === 'active' && cl.status !== 'sent' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleExecuteLead(cl.id)}
                            disabled={executingLeadId === cl.id}
                          >
                            {executingLeadId === cl.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleUnenroll(cl.lead_id)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Step Dialog */}
      <Dialog open={isStepDialogOpen} onOpenChange={setIsStepDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSaveStep}>
            <DialogHeader>
              <DialogTitle>
                {editingStep ? 'Edit Step' : 'Add Step'}
              </DialogTitle>
              <DialogDescription>
                Configure the action for this step in the cadence.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Step Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {STEP_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                        stepFormData.step_type === type.value
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-muted-foreground/50'
                      }`}
                      onClick={() => setStepFormData({ ...stepFormData, step_type: type.value })}
                    >
                      {type.icon}
                      <span className="text-sm font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="step_label">Label (optional)</Label>
                <Input
                  id="step_label"
                  placeholder="e.g., Initial outreach"
                  value={stepFormData.step_label || ''}
                  onChange={(e) => setStepFormData({ ...stepFormData, step_label: e.target.value || null })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="day_offset">Day</Label>
                  <Input
                    id="day_offset"
                    type="number"
                    min="0"
                    value={stepFormData.day_offset}
                    onChange={(e) => setStepFormData({ ...stepFormData, day_offset: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order_in_day">Order in Day</Label>
                  <Input
                    id="order_in_day"
                    type="number"
                    min="1"
                    value={stepFormData.order_in_day}
                    onChange={(e) => setStepFormData({ ...stepFormData, order_in_day: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsStepDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingStep ? 'Save Changes' : 'Add Step'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Enroll Leads Dialog */}
      <Dialog open={isEnrollDialogOpen} onOpenChange={setIsEnrollDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Enroll Leads</DialogTitle>
            <DialogDescription>
              Select leads to add to this cadence.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {availableLeads.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No available leads. All leads are already enrolled or you need to add leads first.
              </p>
            ) : (
              <div className="max-h-[300px] overflow-y-auto border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableLeads.map((lead) => (
                      <TableRow
                        key={lead.id}
                        className="cursor-pointer"
                        onClick={() => {
                          if (selectedLeadIds.includes(lead.id)) {
                            setSelectedLeadIds(selectedLeadIds.filter(id => id !== lead.id))
                          } else {
                            setSelectedLeadIds([...selectedLeadIds, lead.id])
                          }
                        }}
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.includes(lead.id)}
                            onChange={() => {}}
                            className="h-4 w-4"
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {lead.first_name || lead.last_name
                            ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
                            : lead.email || 'Unnamed'}
                        </TableCell>
                        <TableCell>{lead.company || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsEnrollDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEnroll}
              disabled={selectedLeadIds.length === 0}
            >
              Enroll {selectedLeadIds.length > 0 ? `(${selectedLeadIds.length})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
