import { useState, useCallback } from 'react'
import { api } from '@/services/api'
import type { Template, TemplateInsert, TemplateUpdate } from '@/types'

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplates = useCallback(async (stepType?: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = stepType ? `?step_type=${stepType}` : ''
      const response = await api.get<{ success: boolean; data: Template[] }>(`/api/templates${params}`)
      if (response.success && response.data) {
        setTemplates(response.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch templates')
    } finally {
      setLoading(false)
    }
  }, [])

  const getTemplate = useCallback(async (id: string): Promise<Template | null> => {
    try {
      const response = await api.get<{ success: boolean; data: Template }>(`/api/templates/${id}`)
      if (response.success && response.data) {
        return response.data
      }
      return null
    } catch {
      return null
    }
  }, [])

  const createTemplate = useCallback(async (data: TemplateInsert): Promise<Template | null> => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.post<{ success: boolean; data: Template }>('/api/templates', data)
      if (response.success && response.data) {
        setTemplates(prev => [response.data!, ...prev])
        return response.data
      }
      return null
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const updateTemplate = useCallback(async (id: string, data: TemplateUpdate): Promise<Template | null> => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.put<{ success: boolean; data: Template }>(`/api/templates/${id}`, data)
      if (response.success && response.data) {
        setTemplates(prev => prev.map(t => t.id === id ? response.data! : t))
        return response.data
      }
      return null
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteTemplate = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.delete<{ success: boolean }>(`/api/templates/${id}`)
      if (response.success) {
        setTemplates(prev => prev.filter(t => t.id !== id))
        return true
      }
      return false
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const renderTemplate = useCallback(async (
    id: string,
    leadData: Record<string, string | null | undefined>
  ): Promise<{ subject: string | null; body: string } | null> => {
    try {
      const response = await api.post<{
        success: boolean;
        data: { subject: string | null; body: string }
      }>(`/api/templates/${id}/render`, { lead_data: leadData })
      if (response.success && response.data) {
        return response.data
      }
      return null
    } catch {
      return null
    }
  }, [])

  return {
    templates,
    loading,
    error,
    fetchTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    renderTemplate,
  }
}
