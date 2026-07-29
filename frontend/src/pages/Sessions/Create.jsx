import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { createSession } from '../../api/sessions'
import { getCandidates } from '../../api/candidates'
import { getTemplates } from '../../api/templates'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
import Spinner from '../../components/ui/Spinner'

export default function SessionCreate() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [candidates, setCandidates] = useState([])
  const [templates, setTemplates] = useState([])
  const [formData, setFormData] = useState({
    candidate_id: '',
    template_id: '',
    allowed_until: '',
    access_days: 3
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [candidatesData, templatesData] = await Promise.all([
        getCandidates({ limit: 500 }),
        getTemplates({ is_active: true, limit: 100 })
      ])
      setCandidates(candidatesData.items || [])
      setTemplates(templatesData.items || [])
      if (templatesData.items && templatesData.items.length === 0) {
        toast.warning('No active templates found. Please create a template first.')
      }
      if (candidatesData.items && candidatesData.items.length === 0) {
        toast.warning('No candidates found. Please create a candidate first.')
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      if (error.response?.status === 403) {
        toast.error('You do not have permission to access templates. Contact admin.')
      } else {
        toast.error('Failed to load data. Please refresh and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.candidate_id) {
      toast.error('Please select a candidate')
      return
    }
    if (!formData.template_id) {
      toast.error('Please select a template')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        candidate_id: parseInt(formData.candidate_id),
        template_id: parseInt(formData.template_id),
        access_days: formData.access_days
      }
      if (formData.allowed_until) {
        payload.allowed_until = formData.allowed_until
      }
      const result = await createSession(payload)
      toast.success('Assessment session created successfully')
      if (result.access_token) {
        toast.success('Access Token: ' + result.access_token.slice(0, 12) + '...')
      }
      navigate('/sessions')
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to create session'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate('/sessions')
  }

  const candidateOptions = [
    { value: '', label: 'Select Candidate' },
    ...candidates.map((c) => ({
      value: String(c.id),
      label: c.name + ' (' + c.email + ') - ' + (c.job_role || 'No Role')
    }))
  ]

  const templateOptions = [
    { value: '', label: 'Select Template' },
    ...templates.map((t) => ({
      value: String(t.id),
      label: t.name + ' - ' + t.role
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
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={handleCancel} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-navy-800">Create Assessment Session</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Candidate *</label>
          <Select
            options={candidateOptions}
            value={formData.candidate_id}
            onChange={(e) => setFormData({ ...formData, candidate_id: e.target.value })}
            required
          />
          {candidates.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">
              No candidates found. Create a candidate first.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Template *</label>
          <Select
            options={templateOptions}
            value={formData.template_id}
            onChange={(e) => setFormData({ ...formData, template_id: e.target.value })}
            required
          />
          {templates.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">No templates found. Create a template first.</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Access Duration (days)</label>
          <Input
            type="number"
            value={formData.access_days}
            onChange={(e) => setFormData({ ...formData, access_days: parseInt(e.target.value) || 3 })}
            min={1}
            max={30}
          />
          <p className="text-xs text-gray-400 mt-1">Number of days the candidate has to access the assessment</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Custom Expiry (Optional)</label>
          <Input
            type="datetime-local"
            value={formData.allowed_until}
            onChange={(e) => setFormData({ ...formData, allowed_until: e.target.value })}
          />
          <p className="text-xs text-gray-400 mt-1">Leave empty to use access days from above</p>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <Button type="submit" isLoading={submitting} className="flex-1">
            Create Session
          </Button>
          <Button variant="outline" onClick={handleCancel} className="flex-1">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}