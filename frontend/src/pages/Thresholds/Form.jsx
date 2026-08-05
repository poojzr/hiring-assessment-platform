import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { getThreshold, createThreshold, updateThreshold } from '../../api/thresholds'

export default function ThresholdForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = !!id

  const [formData, setFormData] = useState({
    job_role_name: '',
    ats_threshold: 70
  })
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isEdit) {
      const fetchThreshold = async () => {
        setLoading(true)
        try {
          const data = await getThreshold(parseInt(id))
          setFormData({
            job_role_name: data.job_role_name,
            ats_threshold: data.ats_threshold
          })
        } catch (error) {
          toast.error('Failed to load threshold')
        } finally {
          setLoading(false)
        }
      }
      fetchThreshold()
    }
  }, [id, isEdit])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.job_role_name.trim()) {
      toast.error('Job role name is required')
      return
    }
    if (formData.ats_threshold < 0 || formData.ats_threshold > 100) {
      toast.error('ATS threshold must be between 0 and 100')
      return
    }

    setSubmitting(true)

    const payload = {
      job_role_name: formData.job_role_name.trim(),
      ats_threshold: formData.ats_threshold
    }

    try {
      if (isEdit) {
        await updateThreshold(parseInt(id), payload)
        toast.success('Threshold updated successfully')
      } else {
        await createThreshold(payload)
        toast.success('Threshold created successfully')
      }
      navigate('/thresholds')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save threshold')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-0">
      <div className="flex items-center gap-3 sm:gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full flex-shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-navy-800">
          {isEdit ? 'Edit Threshold' : 'Create Threshold'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 sm:p-6 space-y-5 sm:space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Job Role Name *</label>
          <input
            type="text"
            value={formData.job_role_name}
            onChange={(e) => setFormData({ ...formData, job_role_name: e.target.value })}
            placeholder="e.g., Python Developer"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ATS Threshold (%) *</label>
          <input
            type="number"
            value={formData.ats_threshold}
            onChange={(e) => setFormData({ ...formData, ats_threshold: parseInt(e.target.value) || 0 })}
            min="0"
            max="100"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
            required
          />
          <p className="text-xs text-gray-500 mt-1">Minimum ATS score required for shortlisting (0-100)</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            className="bg-accent-500 hover:bg-accent-600 text-white px-6 py-2 rounded-md disabled:opacity-50 text-sm sm:text-base"
            disabled={submitting}
          >
            {submitting ? 'Saving...' : isEdit ? 'Update Threshold' : 'Create Threshold'}
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