import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { getCandidate, updateCandidate } from '../../api/candidates'
import { getThresholds } from '../../api/thresholds'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'

export default function CandidateEdit() {
  const { id } = useParams()
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
    resume_url: '',
    shortlisted: false
  })

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [candidateData, thresholdsData] = await Promise.all([
          getCandidate(parseInt(id)),
          getThresholds()
        ])
        setThresholds(thresholdsData || [])
        setFormData({
          name: candidateData.name || '',
          email: candidateData.email || '',
          phone: candidateData.phone || '',
          job_role_id: candidateData.job_role_id || '',
          ats_score: candidateData.ats_score || '',
          resume_url: candidateData.resume_url || '',
          shortlisted: candidateData.shortlisted || false
        })
      } catch (error) {
        toast.error('Failed to load candidate data')
        navigate('/candidates')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || null,
        job_role_id: formData.job_role_id ? parseInt(formData.job_role_id) : null,
        ats_score: formData.ats_score ? parseFloat(formData.ats_score) : null,
        resume_url: formData.resume_url.trim() || null,
        shortlisted: formData.shortlisted
      }
      const result = await updateCandidate(parseInt(id), payload)
      if (result.shortlisted) {
        toast.success('Candidate updated and shortlisted')
        if (result.access_token) {
          toast.success('Assessment email sent')
        }
      } else {
        toast.success('Candidate updated successfully')
      }
      navigate('/candidates')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update candidate')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate('/candidates')
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
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 sm:gap-4 mb-6">
        <button onClick={handleCancel} className="p-2 hover:bg-gray-100 rounded-full flex-shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-navy-800">Edit Candidate</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 sm:p-6 space-y-5 sm:space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ATS Score (0-100)</label>
          <input
            type="number"
            value={formData.ats_score}
            onChange={(e) => setFormData({ ...formData, ats_score: e.target.value })}
            min="0"
            max="100"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
          <p className="text-xs text-gray-400 mt-1">If score is greater than or equal to threshold, candidate will be shortlisted and email sent</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Resume URL</label>
          <input
            type="url"
            value={formData.resume_url}
            onChange={(e) => setFormData({ ...formData, resume_url: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.shortlisted}
            onChange={(e) => setFormData({ ...formData, shortlisted: e.target.checked })}
            className="w-4 h-4 text-accent-500 rounded focus:ring-accent-500"
          />
          <label className="text-sm text-gray-700">Shortlisted</label>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
          <Button type="submit" isLoading={submitting} className="flex-1">
            <Save className="w-4 h-4 mr-2" />
            Update Candidate
          </Button>
          <Button variant="outline" onClick={handleCancel} className="flex-1">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}