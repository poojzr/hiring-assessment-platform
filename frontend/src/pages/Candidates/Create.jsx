import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { createCandidate } from '../../api/candidates'
import { getThresholds } from '../../api/thresholds'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
import Spinner from '../../components/ui/Spinner'

export default function CandidateCreate() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [thresholds, setThresholds] = useState([])
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    job_role_id: '',
    ats_score: '',
    resume_url: ''
  })

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const thresholdsData = await getThresholds()
        setThresholds(thresholdsData || [])
      } catch (error) {
        toast.error('Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error('Name is required')
      return
    }
    if (!formData.email.trim()) {
      toast.error('Email is required')
      return
    }

    setSubmitting(true)

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim() || null,
      job_role_id: formData.job_role_id ? parseInt(formData.job_role_id) : null,
      ats_score: formData.ats_score ? parseFloat(formData.ats_score) : null,
      resume_url: formData.resume_url.trim() || null
    }

    try {
      await createCandidate(payload)
      toast.success('Candidate created successfully')
      navigate('/app/candidates')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create candidate')
    } finally {
      setSubmitting(false)
    }
  }

  const jobRoleOptions = [
    { value: '', label: 'Select Job Role' },
    ...thresholds.map((t) => ({
      value: String(t.id),
      label: `${t.job_role_name} (Threshold: ${t.ats_threshold}%)`
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
    <div className="max-w-2xl mx-auto px-4 sm:px-0">
      <div className="flex items-center gap-3 sm:gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full flex-shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-navy-800">Add Candidate</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 sm:p-6 space-y-5 sm:space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter candidate name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="Enter email address"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input
            type="text"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="Enter phone number"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Job Role</label>
          <Select
            options={jobRoleOptions}
            value={formData.job_role_id}
            onChange={(e) => setFormData({ ...formData, job_role_id: e.target.value })}
          />
          <p className="text-xs text-gray-400 mt-1">Select job role for this candidate</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ATS Score (0-100)</label>
          <input
            type="number"
            value={formData.ats_score}
            onChange={(e) => setFormData({ ...formData, ats_score: e.target.value })}
            placeholder="Enter ATS score (e.g., 85)"
            min="0"
            max="100"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
          <p className="text-xs text-gray-400 mt-1">Optional - Can be updated later</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Resume URL</label>
          <input
            type="url"
            value={formData.resume_url}
            onChange={(e) => setFormData({ ...formData, resume_url: e.target.value })}
            placeholder="https://example.com/resume.pdf"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
          <p className="text-xs text-gray-400 mt-1">Link to uploaded resume (optional)</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
          <Button
            type="submit"
            isLoading={submitting}
            className="flex-1"
          >
            Create Candidate
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}