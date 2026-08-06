import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, History } from 'lucide-react'
import toast from 'react-hot-toast'
import { getTemplate } from '../../api/templates'
import { formatDate } from '../../utils/helpers'

export default function TemplateDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const templateId = parseInt(id)

  const [template, setTemplate] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const templateData = await getTemplate(templateId)
        setTemplate(templateData)
      } catch (error) {
        toast.error('Failed to load template')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [templateId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!template) {
    return <div className="text-center py-12 text-gray-500 px-4">Template not found</div>
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-0">
      <div className="flex items-center gap-3 sm:gap-4 mb-6">
        <button onClick={() => navigate('/app/templates')} className="p-2 hover:bg-gray-100 rounded-full flex-shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-navy-800 break-words">{template.name}</h1>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Link to={`/app/templates/${template.id}/edit`} className="bg-accent-500 hover:bg-accent-600 text-white px-4 py-2 rounded-md flex items-center gap-1 text-sm sm:text-base">
          <Edit className="w-4 h-4" /> Edit
        </Link>
        <Link to={`/app/templates/${template.id}/history`} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md flex items-center gap-1 text-sm sm:text-base">
          <History className="w-4 h-4" /> History
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 sm:p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Name</dt>
            <dd className="text-navy-800 break-words">{template.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Job Role</dt>
            <dd className="text-navy-800 break-words">{template.role}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Duration</dt>
            <dd className="text-navy-800">{template.duration_minutes} minutes</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Pass Threshold</dt>
            <dd className="text-navy-800">{template.pass_threshold}%</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd>
              {template.is_active ? (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
              ) : (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inactive</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Created At</dt>
            <dd className="text-navy-800 break-words">{formatDate(template.created_at)}</dd>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-navy-800 mb-4">Sections</h2>
        {template.sections_config?.sections?.length === 0 ? (
          <p className="text-gray-500">No sections defined</p>
        ) : (
          <div className="space-y-4">
            {template.sections_config?.sections?.map((section, index) => (
              <div key={section.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                  <h4 className="font-medium text-navy-800 break-words">Section {index + 1}: {section.id}</h4>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                    section.type === 'MCQ' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {section.type}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div>
                    <dt className="text-gray-500">Questions</dt>
                    <dd className="text-navy-800">{section.count}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Duration</dt>
                    <dd className="text-navy-800">{section.duration_minutes} min</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Order</dt>
                    <dd className="text-navy-800">{section.order}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Weight</dt>
                    <dd className="text-navy-800">{section.weight || 1}</dd>
                  </div>
                </div>
                {section.difficulty_distribution && (
                  <div className="mt-2">
                    <dt className="text-xs text-gray-500">Difficulty Distribution</dt>
                    <dd className="text-sm text-navy-800">
                      Easy: {section.difficulty_distribution.easy || 0}, 
                      Medium: {section.difficulty_distribution.medium || 0}, 
                      Hard: {section.difficulty_distribution.hard || 0}
                    </dd>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}