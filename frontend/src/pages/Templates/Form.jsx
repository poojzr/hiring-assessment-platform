import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { getTemplate, createTemplate, updateTemplate } from '../../api/templates'
import { getThresholds } from '../../api/thresholds'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
import Spinner from '../../components/ui/Spinner'

const DIFFICULTY_OPTIONS = ['easy', 'medium', 'hard']

export default function TemplateForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = !!id

  const [formData, setFormData] = useState({
    name: '',
    job_role_id: '',
    sections: [],
    duration_minutes: 60,
    pass_threshold: 60,
    is_active: true,
  })
  const [thresholds, setThresholds] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const thresholdsData = await getThresholds()
        setThresholds(thresholdsData || [])

        if (isEdit) {
          const templateData = await getTemplate(parseInt(id))
          setFormData({
            name: templateData.name || '',
            job_role_id: String(templateData.job_role_id || ''),
            sections: templateData.sections_config?.sections || [],
            duration_minutes: templateData.duration_minutes || 60,
            pass_threshold: templateData.pass_threshold || 60,
            is_active: templateData.is_active !== undefined ? templateData.is_active : true,
          })
        }
      } catch (error) {
        console.error('Failed to load data:', error)
        toast.error('Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id, isEdit])

  const addSection = () => {
    const newSection = {
      id: 'section_' + Date.now(),
      type: 'MCQ',
      count: 10,
      duration_minutes: 15,
      order: formData.sections.length + 1,
      difficulty_distribution: { easy: 0.3, medium: 0.5, hard: 0.2 },
      weight: 1,
      topic: '',
    }
    setFormData({ ...formData, sections: [...formData.sections, newSection] })
  }

  const removeSection = (index) => {
    const sections = formData.sections.filter((_, i) => i !== index)
    const updatedSections = sections.map((section, i) => ({
      ...section,
      order: i + 1
    }))
    setFormData({ ...formData, sections: updatedSections })
  }

  const updateSection = (index, field, value) => {
    const sections = [...formData.sections]
    if (field === 'difficulty_distribution') {
      sections[index] = { ...sections[index], [field]: value }
    } else if (field === 'count' || field === 'duration_minutes' || field === 'order' || field === 'weight') {
      sections[index] = { ...sections[index], [field]: parseFloat(value) || 0 }
    } else {
      sections[index] = { ...sections[index], [field]: value }
    }
    setFormData({ ...formData, sections: sections })
  }

  const validateSections = () => {
    for (let i = 0; i < formData.sections.length; i++) {
      const section = formData.sections[i]
      if (!section.id || section.id.trim() === '') {
        toast.error('Section ' + (i + 1) + ': ID is required')
        return false
      }
      if (!section.type || !['MCQ', 'CODING'].includes(section.type)) {
        toast.error('Section ' + (i + 1) + ': Type must be MCQ or CODING')
        return false
      }
      if (!section.count || section.count < 1) {
        toast.error('Section ' + (i + 1) + ': Count must be at least 1')
        return false
      }
      if (!section.duration_minutes || section.duration_minutes < 1) {
        toast.error('Section ' + (i + 1) + ': Duration must be at least 1 minute')
        return false
      }
      if (!section.order || section.order < 1) {
        toast.error('Section ' + (i + 1) + ': Order is required')
        return false
      }
      if (section.difficulty_distribution) {
        const total = Object.values(section.difficulty_distribution).reduce((a, b) => a + b, 0)
        if (total > 1) {
          toast.error('Section ' + (i + 1) + ': Difficulty distribution sum must be <= 1')
          return false
        }
      }
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error('Template name is required')
      return
    }
    if (!formData.job_role_id) {
      toast.error('Please select a job role')
      return
    }
    if (formData.sections.length === 0) {
      toast.error('At least one section is required')
      return
    }

    if (!validateSections()) {
      return
    }

    setSubmitting(true)

    const payload = {
      name: formData.name.trim(),
      job_role_id: parseInt(formData.job_role_id),
      sections_config: { 
        sections: formData.sections.map(s => ({
          id: s.id,
          type: s.type,
          count: parseInt(s.count) || 0,
          duration_minutes: parseInt(s.duration_minutes) || 0,
          order: parseInt(s.order) || 0,
          weight: parseFloat(s.weight) || 1,
          difficulty_distribution: s.difficulty_distribution || { easy: 0.3, medium: 0.5, hard: 0.2 },
          topic: s.topic || '',
        }))
      },
      duration_minutes: parseInt(formData.duration_minutes),
      pass_threshold: parseFloat(formData.pass_threshold),
    }

    try {
      if (isEdit) {
        await updateTemplate(parseInt(id), payload)
        toast.success('Template updated successfully')
      } else {
        await createTemplate(payload)
        toast.success('Template created successfully')
      }
      navigate('/templates')
    } catch (error) {
      console.error('Template save error:', error)
      console.log('Request payload:', payload)
      
      if (error.response?.status === 422) {
        const errors = error.response?.data?.detail
        if (Array.isArray(errors)) {
          const messages = errors.map(e => `${e.loc.join('.')}: ${e.msg}`).join(', ')
          toast.error('Validation error: ' + messages)
        } else if (typeof errors === 'object') {
          const messages = Object.values(errors).flat().join(', ')
          toast.error('Validation error: ' + messages)
        } else {
          toast.error('Validation error. Please check your inputs.')
        }
      } else {
        const message = error.response?.data?.detail || 'Failed to save template'
        toast.error(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const jobRoleOptions = [
    { value: '', label: 'Select Job Role' },
    ...thresholds.map((t) => ({
      value: String(t.id),
      label: t.job_role_name + ' (Threshold: ' + t.ats_threshold + '%)'
    }))
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-0">
      <div className="flex items-center gap-3 sm:gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full flex-shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-navy-800">
          {isEdit ? 'Edit Template' : 'Create Template'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 sm:p-6 space-y-5 sm:space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Python Developer Assessment"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Role *</label>
            <Select
              options={jobRoleOptions}
              value={formData.job_role_id}
              onChange={(e) => setFormData({ ...formData, job_role_id: e.target.value })}
              required
            />
            {thresholds.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No job roles found. Create thresholds first.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Duration (minutes) *</label>
            <input
              type="number"
              value={formData.duration_minutes}
              onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 0 })}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pass Threshold (%) *</label>
            <input
              type="number"
              value={formData.pass_threshold}
              onChange={(e) => setFormData({ ...formData, pass_threshold: parseInt(e.target.value) || 0 })}
              min="0"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
              required
            />
          </div>
        </div>

        <div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
            <h3 className="text-lg font-semibold text-navy-800">Sections</h3>
            <button
              type="button"
              onClick={addSection}
              className="bg-accent-500 hover:bg-accent-600 text-white px-3 py-1 rounded-md text-sm flex items-center gap-1 justify-center"
            >
              <Plus className="w-4 h-4" /> Add Section
            </button>
          </div>

          {formData.sections.length === 0 ? (
            <p className="text-gray-500 text-sm">No sections added yet. Click "Add Section" to start.</p>
          ) : (
            <div className="space-y-4">
              {formData.sections.map((section, index) => (
                <div key={section.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                    <h4 className="font-medium text-navy-800">Section {index + 1}</h4>
                    <button
                      type="button"
                      onClick={() => removeSection(index)}
                      className="p-1 text-red-600 hover:text-red-800 flex-shrink-0 self-end sm:self-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Section ID</label>
                      <input
                        type="text"
                        value={section.id}
                        onChange={(e) => updateSection(index, 'id', e.target.value)}
                        placeholder="section_1"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                      <select
                        value={section.type}
                        onChange={(e) => updateSection(index, 'type', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                      >
                        <option value="MCQ">MCQ</option>
                        <option value="CODING">Coding</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Count</label>
                      <input
                        type="number"
                        value={section.count}
                        onChange={(e) => updateSection(index, 'count', e.target.value)}
                        min="1"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Duration (min)</label>
                      <input
                        type="number"
                        value={section.duration_minutes}
                        onChange={(e) => updateSection(index, 'duration_minutes', e.target.value)}
                        min="1"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Order</label>
                      <input
                        type="number"
                        value={section.order}
                        onChange={(e) => updateSection(index, 'order', e.target.value)}
                        min="1"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Weight</label>
                      <input
                        type="number"
                        value={section.weight || 1}
                        onChange={(e) => updateSection(index, 'weight', e.target.value)}
                        min="0"
                        step="0.1"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Topic (Optional)</label>
                    <input
                      type="text"
                      value={section.topic || ''}
                      onChange={(e) => updateSection(index, 'topic', e.target.value)}
                      placeholder="e.g., Python Basics, Algorithms"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">Leave empty to select from all topics</p>
                  </div>

                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Difficulty Distribution</label>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      {DIFFICULTY_OPTIONS.map((diff) => (
                        <div key={diff} className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 capitalize">{diff}</span>
                          <input
                            type="number"
                            value={section.difficulty_distribution?.[diff] || 0}
                            onChange={(e) => {
                              const dist = { ...section.difficulty_distribution }
                              dist[diff] = parseFloat(e.target.value) || 0
                              updateSection(index, 'difficulty_distribution', dist)
                            }}
                            min="0"
                            max="1"
                            step="0.1"
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            className="w-4 h-4 text-accent-500 rounded focus:ring-accent-500"
          />
          <label className="text-sm text-gray-700">Active</label>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            className="bg-accent-500 hover:bg-accent-600 text-white px-6 py-2 rounded-md disabled:opacity-50 text-sm sm:text-base"
            disabled={submitting}
          >
            {submitting ? 'Saving...' : isEdit ? 'Update Template' : 'Create Template'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-md text-sm sm:text-base"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}