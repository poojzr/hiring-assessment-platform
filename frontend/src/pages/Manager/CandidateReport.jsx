import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, User, Mail, Phone, Briefcase, 
  FileText, Clock, Shield, AlertTriangle, 
  Download, Eye, Play, Pause, 
  CheckCircle, XCircle, AlertCircle, Edit3
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '../../api/client'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'

export default function CandidateReport() {
  const { candidateId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [overrideModal, setOverrideModal] = useState({ isOpen: false, sessionId: null })
  const [overrideData, setOverrideData] = useState({ eligibility: 'manager_overridden', reason: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchReport()
  }, [candidateId])

  const fetchReport = async () => {
    setLoading(true)
    try {
      const response = await apiClient.get(`/manager/candidates/${candidateId}/report`)
      setReport(response.data)
    } catch (error) {
      console.error('Failed to fetch report:', error)
      toast.error('Failed to load candidate report')
    } finally {
      setLoading(false)
    }
  }

  const exportReport = async (format) => {
    try {
      const response = await apiClient.get(`/manager/candidates/${candidateId}/export`, {
        params: { format },
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `candidate_report_${candidateId}.${format}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success(`Report exported as ${format.toUpperCase()}`)
    } catch (error) {
      toast.error('Failed to export report')
    }
  }

  const handleOverride = async () => {
    if (!overrideData.reason.trim()) {
      toast.error('Please provide a reason for override')
      return
    }
    setSubmitting(true)
    try {
      await apiClient.post(`/manager/sessions/${overrideModal.sessionId}/override`, {
        eligibility: overrideData.eligibility,
        override_reason: overrideData.reason
      })
      toast.success('Eligibility overridden successfully')
      setOverrideModal({ isOpen: false, sessionId: null })
      fetchReport()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to override eligibility')
    } finally {
      setSubmitting(false)
    }
  }

  const getSeverityColor = (severity) => {
    const map = {
      critical: 'bg-red-100 text-red-700',
      high: 'bg-orange-100 text-orange-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-blue-100 text-blue-700'
    }
    return map[severity] || 'bg-gray-100 text-gray-700'
  }

  const getStatusColor = (status) => {
    const map = {
      scheduled: 'bg-yellow-100 text-yellow-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      expired: 'bg-red-100 text-red-700'
    }
    return map[status] || 'bg-gray-100 text-gray-700'
  }

  const violationColors = {
    NO_FACE: 'bg-red-100 text-red-700',
    MULTIPLE_FACE: 'bg-red-100 text-red-700',
    MOBILE_DETECTED: 'bg-orange-100 text-orange-700',
    LOUD_VOICE: 'bg-yellow-100 text-yellow-700',
    MULTIPLE_VOICE: 'bg-yellow-100 text-yellow-700',
    LIP_SYNC_MISMATCH: 'bg-purple-100 text-purple-700',
    TAB_SWITCH: 'bg-blue-100 text-blue-700',
    COPY_PASTE: 'bg-blue-100 text-blue-700',
    SCREEN_SHARE: 'bg-blue-100 text-blue-700',
    FULLSCREEN_EXIT: 'bg-blue-100 text-blue-700',
    DARK_ENVIRONMENT: 'bg-gray-100 text-gray-700',
    WARNING_SENT: 'bg-green-100 text-green-700',
    SESSION_TERMINATED: 'bg-red-100 text-red-700'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="text-center py-12 px-4">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg sm:text-xl font-bold text-navy-800">Report Not Found</h2>
        <Button className="mt-4" onClick={() => navigate('/sessions')}>Back to Sessions</Button>
      </div>
    )
  }

  const candidate = report.candidate
  const sessions = report.sessions || []
  const violations = report.violations || []
  const answers = report.answers || []

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-navy-800">Candidate Report</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportReport('csv')}>
            <Download className="w-4 h-4 mr-1" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportReport('json')}>
            <Download className="w-4 h-4 mr-1" />
            JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportReport('pdf')}>
            <Download className="w-4 h-4 mr-1" />
            PDF
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 sm:p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-3 rounded-full flex-shrink-0">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-500">Candidate</p>
              <p className="font-semibold text-navy-800 truncate">{candidate.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-gray-100 p-3 rounded-full flex-shrink-0">
              <Mail className="w-6 h-6 text-gray-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-semibold text-navy-800 truncate">{candidate.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-3 rounded-full flex-shrink-0">
              <Briefcase className="w-6 h-6 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-500">Job Role</p>
              <p className="font-semibold text-navy-800 truncate">{candidate.job_role || 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-3 rounded-full flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-500">ATS Score</p>
              <p className="font-semibold text-navy-800">{candidate.ats_score || 'N/A'}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        <Button 
          variant={activeTab === 'overview' ? 'primary' : 'outline'} 
          size="sm"
          onClick={() => setActiveTab('overview')}
          className="flex-shrink-0"
        >
          Overview
        </Button>
        <Button 
          variant={activeTab === 'answers' ? 'primary' : 'outline'} 
          size="sm"
          onClick={() => setActiveTab('answers')}
          className="flex-shrink-0"
        >
          Answers
        </Button>
        <Button 
          variant={activeTab === 'violations' ? 'primary' : 'outline'} 
          size="sm"
          onClick={() => setActiveTab('violations')}
          className="flex-shrink-0"
        >
          Violations ({violations.length})
        </Button>
        <Button 
          variant={activeTab === 'sessions' ? 'primary' : 'outline'} 
          size="sm"
          onClick={() => setActiveTab('sessions')}
          className="flex-shrink-0"
        >
          Sessions ({sessions.length})
        </Button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
              <p className="text-xs sm:text-sm text-gray-500">Total Sessions</p>
              <p className="text-xl sm:text-2xl font-bold text-navy-800">{sessions.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
              <p className="text-xs sm:text-sm text-gray-500">Completed</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600">
                {sessions.filter(s => s.status === 'completed').length}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
              <p className="text-xs sm:text-sm text-gray-500">Total Violations</p>
              <p className="text-xl sm:text-2xl font-bold text-red-600">{report.violation_summary?.total || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
              <p className="text-xs sm:text-sm text-gray-500">Shortlisted</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-600">{candidate.shortlisted ? 'Yes' : 'No'}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 sm:p-6">
            <h3 className="font-semibold text-navy-800 mb-4 text-sm sm:text-base">Violation Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-xl sm:text-2xl font-bold text-red-600">{report.violation_summary?.critical || 0}</p>
                <p className="text-xs sm:text-sm text-gray-500">Critical</p>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <p className="text-xl sm:text-2xl font-bold text-orange-600">{report.violation_summary?.high || 0}</p>
                <p className="text-xs sm:text-sm text-gray-500">High</p>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <p className="text-xl sm:text-2xl font-bold text-yellow-600">{report.violation_summary?.medium || 0}</p>
                <p className="text-xs sm:text-sm text-gray-500">Medium</p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-xl sm:text-2xl font-bold text-blue-600">{report.violation_summary?.low || 0}</p>
                <p className="text-xs sm:text-sm text-gray-500">Low</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 sm:p-6">
            <h3 className="font-semibold text-navy-800 mb-4 text-sm sm:text-base">Violation Type Distribution</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(violationColors).map(([type, color]) => {
                const count = violations.filter(v => v.type === type).length
                if (count === 0) return null
                return (
                  <div key={type} className={`p-3 rounded-lg ${color}`}>
                    <p className="text-xs sm:text-sm font-medium">{type.replace('_', ' ')}</p>
                    <p className="text-xl sm:text-2xl font-bold">{count}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'answers' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 sm:p-6">
          <h3 className="font-semibold text-navy-800 mb-4 text-sm sm:text-base">Answer Review</h3>
          {answers.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No answers available</p>
          ) : (
            <div className="space-y-4">
              {answers.map((answer, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                    <div>
                      <p className="font-medium text-navy-800">Question {answer.question_id}</p>
                      <p className="text-sm text-gray-500">Section: {answer.section_id || 'N/A'}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {answer.is_correct ? (
                        <Badge variant="success">Correct</Badge>
                      ) : (
                        <Badge variant="danger">Incorrect</Badge>
                      )}
                      <span className="text-sm font-medium">
                        Score: {answer.auto_score !== null ? `${(answer.auto_score * 100).toFixed(0)}%` : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 bg-gray-50 p-3 rounded-md overflow-x-auto">
                    <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">
                      Answer: {JSON.stringify(answer.answer_data)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'violations' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 sm:p-6">
          <h3 className="font-semibold text-navy-800 mb-4 text-sm sm:text-base">Violations Timeline</h3>
          {violations.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No violations recorded</p>
          ) : (
            <div className="space-y-3">
              {violations.map((violation, index) => (
                <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                      violation.severity === 'critical' ? 'text-red-500' :
                      violation.severity === 'high' ? 'text-orange-500' :
                      violation.severity === 'medium' ? 'text-yellow-500' :
                      'text-blue-500'
                    }`} />
                    <div className="min-w-0">
                      <p className="font-medium text-navy-800 truncate">{violation.type}</p>
                      <p className="text-xs text-gray-500">
                        {violation.timestamp ? new Date(violation.timestamp).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getSeverityColor(violation.severity)}`}>
                      {violation.severity}
                    </span>
                    {violation.clip_url && (
                      <button 
                        onClick={() => window.open(violation.clip_url, '_blank')}
                        className="p-1 text-blue-600 hover:text-blue-800"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 sm:p-6">
          <h3 className="font-semibold text-navy-800 mb-4 text-sm sm:text-base">Sessions History</h3>
          {sessions.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No sessions found</p>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <div key={session.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(session.status)}`}>
                        {session.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Score</p>
                      <p className="font-semibold">{session.total_score || 'N/A'}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Integrity</p>
                      <p className="font-semibold">{session.integrity_score || 'N/A'}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Eligibility</p>
                      <Badge variant={session.eligibility === 'auto_eligible' ? 'success' : 'danger'}>
                        {session.eligibility}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 col-span-2 md:col-span-1">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/sessions/view/${session.access_token}`)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      {session.status === 'completed' && session.eligibility !== 'manager_overridden' && (
                        <Button 
                          variant="warning" 
                          size="sm"
                          onClick={() => setOverrideModal({ isOpen: true, sessionId: session.id })}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={overrideModal.isOpen}
        onClose={() => setOverrideModal({ isOpen: false, sessionId: null })}
        title="Override Eligibility"
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
            <p className="font-medium">Override Eligibility</p>
            <p className="text-xs mt-1">This action will override the auto-evaluation result for this session.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Eligibility</label>
            <Select
              options={[
                { value: 'manager_overridden', label: 'Manager Overridden (Shortlist)' },
                { value: 'auto_blocked', label: 'Auto Blocked (Reject)' }
              ]}
              value={overrideData.eligibility}
              onChange={(e) => setOverrideData({ ...overrideData, eligibility: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Override *</label>
            <textarea
              value={overrideData.reason}
              onChange={(e) => setOverrideData({ ...overrideData, reason: e.target.value })}
              placeholder="Enter the reason for overriding eligibility..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 min-h-[80px]"
              required
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleOverride}
              isLoading={submitting}
              className="flex-1"
            >
              Override
            </Button>
            <Button
              variant="outline"
              onClick={() => setOverrideModal({ isOpen: false, sessionId: null })}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}