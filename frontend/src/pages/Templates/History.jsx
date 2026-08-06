import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { getTemplateHistory } from '../../api/templates'
import { formatDate } from '../../utils/helpers'

export default function TemplateHistory() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true)
      try {
        const data = await getTemplateHistory(parseInt(id))
        setHistory(data || [])
      } catch (error) {
        toast.error('Failed to load history')
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-0">
      <div className="flex items-center gap-3 sm:gap-4 mb-6">
        <button onClick={() => navigate('/app/templates')} className="p-2 hover:bg-gray-100 rounded-full flex-shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-navy-800">Template History</h1>
      </div>

      {history.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-8 text-center text-gray-500">
          No history available
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((entry) => (
            <div key={entry.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                <div>
                  <h3 className="font-semibold text-navy-800">Version {entry.version}</h3>
                  <p className="text-sm text-gray-500">{formatDate(entry.changed_at)}</p>
                </div>
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 whitespace-nowrap">
                  v{entry.version}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-gray-500">Name</dt>
                  <dd className="text-navy-800 break-words">{entry.name}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Job Role</dt>
                  <dd className="text-navy-800 break-words">{entry.role}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Duration</dt>
                  <dd className="text-navy-800">{entry.duration_minutes} min</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Pass Threshold</dt>
                  <dd className="text-navy-800">{entry.pass_threshold}%</dd>
                </div>
              </div>
              <div className="mt-2">
                <dt className="text-xs text-gray-500">Sections</dt>
                <dd className="text-sm text-navy-800">
                  {entry.sections_config?.sections?.length || 0} sections
                </dd>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}