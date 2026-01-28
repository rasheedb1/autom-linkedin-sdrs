import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useTemplates } from '@/hooks/useTemplates'
import { toast } from '@/hooks/useToast'
import type { Template, TemplateInsert, StepType } from '@/types'
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  FileText,
  MessageSquare,
  Heart,
  UserPlus,
  Mail,
  Phone,
  Copy,
} from 'lucide-react'

const STEP_TYPES: { value: StepType; label: string; icon: React.ReactNode }[] = [
  { value: 'linkedin_message', label: 'LinkedIn Message', icon: <MessageSquare className="h-4 w-4" /> },
  { value: 'linkedin_like', label: 'Like Post', icon: <Heart className="h-4 w-4" /> },
  { value: 'linkedin_connect', label: 'Connection Request', icon: <UserPlus className="h-4 w-4" /> },
  { value: 'linkedin_comment', label: 'Comment on Post', icon: <MessageSquare className="h-4 w-4" /> },
  { value: 'send_email', label: 'Send Email', icon: <Mail className="h-4 w-4" /> },
  { value: 'call_manual', label: 'Manual Call', icon: <Phone className="h-4 w-4" /> },
]

const VARIABLES = [
  { name: 'first_name', description: 'Lead\'s first name' },
  { name: 'last_name', description: 'Lead\'s last name' },
  { name: 'company', description: 'Lead\'s company' },
  { name: 'title', description: 'Lead\'s job title' },
  { name: 'email', description: 'Lead\'s email' },
]

const emptyTemplate: TemplateInsert = {
  name: '',
  step_type: 'linkedin_message',
  subject_template: null,
  body_template: '',
}

export function Templates() {
  const {
    templates,
    loading,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  } = useTemplates()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [formData, setFormData] = useState<TemplateInsert>(emptyTemplate)
  const [filterType, setFilterType] = useState<string>('all')

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleOpenCreate = () => {
    setEditingTemplate(null)
    setFormData(emptyTemplate)
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (template: Template) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      step_type: template.step_type as StepType,
      subject_template: template.subject_template,
      body_template: template.body_template,
    })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.body_template) return

    if (editingTemplate) {
      const result = await updateTemplate(editingTemplate.id, formData)
      if (result) {
        toast({ title: 'Template updated', description: 'Your changes have been saved.', variant: 'success' })
      } else {
        toast({ title: 'Update failed', description: 'Failed to update the template.', variant: 'destructive' })
      }
    } else {
      const result = await createTemplate(formData)
      if (result) {
        toast({ title: 'Template created', description: 'Your new template is ready to use.', variant: 'success' })
      } else {
        toast({ title: 'Creation failed', description: 'Failed to create the template.', variant: 'destructive' })
      }
    }
    setIsDialogOpen(false)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      const result = await deleteTemplate(id)
      if (result) {
        toast({ title: 'Template deleted', description: 'The template has been removed.', variant: 'success' })
      } else {
        toast({ title: 'Delete failed', description: 'Failed to delete the template.', variant: 'destructive' })
      }
    }
  }

  const handleDuplicate = async (template: Template) => {
    const result = await createTemplate({
      name: `${template.name} (Copy)`,
      step_type: template.step_type as StepType,
      subject_template: template.subject_template,
      body_template: template.body_template,
    })
    if (result) {
      toast({ title: 'Template duplicated', description: 'A copy of the template has been created.', variant: 'success' })
    }
  }

  const insertVariable = (variable: string) => {
    setFormData(prev => ({
      ...prev,
      body_template: prev.body_template + `{{${variable}}}`,
    }))
  }

  const getStepIcon = (type: string) => {
    const stepType = STEP_TYPES.find(st => st.value === type)
    return stepType?.icon || <FileText className="h-4 w-4" />
  }

  const getStepLabel = (type: string) => {
    const stepType = STEP_TYPES.find(st => st.value === type)
    return stepType?.label || type
  }

  const filteredTemplates = filterType === 'all'
    ? templates
    : templates.filter(t => t.step_type === filterType)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Templates</h1>
          <p className="text-muted-foreground">
            Create reusable message templates for your cadences
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {STEP_TYPES.map(type => (
              <SelectItem key={type.value} value={type.value}>
                <div className="flex items-center gap-2">
                  {type.icon}
                  {type.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Templates Grid */}
      {loading && templates.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-4">
              Create message templates to use in your cadences. Templates support variables like {'{{first_name}}'}.
            </p>
            <Button onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map(template => (
            <Card key={template.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getStepIcon(template.step_type)}
                    <CardTitle className="text-base">{template.name}</CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenEdit(template)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(template.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Badge variant="secondary" className="w-fit text-xs">
                  {getStepLabel(template.step_type)}
                </Badge>
              </CardHeader>
              <CardContent className="flex-1">
                {template.subject_template && (
                  <p className="text-sm font-medium mb-1 text-muted-foreground">
                    Subject: {template.subject_template}
                  </p>
                )}
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {template.body_template}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
            <DialogDescription>
              Create a reusable message template. Use {'{{variable}}'} syntax for personalization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Template Name</label>
                <Input
                  placeholder="e.g., Initial Outreach"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select
                  value={formData.step_type}
                  onValueChange={(value: string) => setFormData({ ...formData, step_type: value as StepType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STEP_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          {type.icon}
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.step_type === 'send_email' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject Line</label>
                <Input
                  placeholder="e.g., Quick question about {{company}}"
                  value={formData.subject_template || ''}
                  onChange={e => setFormData({ ...formData, subject_template: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Message Body</label>
                <div className="flex gap-1">
                  {VARIABLES.map(v => (
                    <Button
                      key={v.name}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => insertVariable(v.name)}
                      title={v.description}
                    >
                      {`{{${v.name}}}`}
                    </Button>
                  ))}
                </div>
              </div>
              <Textarea
                placeholder="Hi {{first_name}}, I noticed you work at {{company}}..."
                value={formData.body_template}
                onChange={e => setFormData({ ...formData, body_template: e.target.value })}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Click the variable buttons above to insert personalization tokens.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name || !formData.body_template || loading}
            >
              {editingTemplate ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
