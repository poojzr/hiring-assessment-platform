import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Eye, RefreshCw, Search, Mail, Copy, Users, Trash2, Video, FileText, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { getSessions, resendSessionEmail, deleteSession } from '../../api/sessions'
import { getThresholds } from '../../api/thresholds'
import { formatDate } from '../../utils/helpers'
import Table, { TableHead, TableHeader, TableBody, TableRow, TableCell } from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import Modal from '../../components/ui/Modal'
import apiClient from '../../api/client'

export default function SessionsList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [sessions, setSessions] = useState([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [thresholds, setThresholds] = useState([])
  const [resendModal, setResendModal] = useState({ isOpen: false, sessionId: null, candidateName: '', candidateEmail: '' })
  const navigate = useNavigate()

  const search = searchParams.get('search') || ''
  const statusFilter = searchParams.get('status') || ''
  const eligibilityFilter = searchParams.get('eligibility') || ''
  const jobRoleFilter = searchParams.get('jobRole') || ''

  useEffect(() => {
    fetchThresholds()
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [search, statusFilter, eligibilityFilter, jobRoleFilter])

  const fetchThresholds = async () => {
    try {
      const data = await getThresholds()
      setThresholds(data || [])
    } catch (error) {
      setThresholds([])
    }
  }

  const fetchSessions = async () => {
    setIsLoading(true)
    try {
      const params = {
        status: statusFilter || undefined,
        eligibility: eligibilityFilter || undefined,
        job_role: jobRoleFilter || undefined,
        search: search || undefined,
        limit: 100
      }
      const data = await getSessions(params)
      setSessions(data.items || [])
      setTotal(data.total || 0)
    } catch (error) {
      toast.error('Failed to load sessions')
    } finally {
      setIsLoading(false)
    }
  }

  const updateFilter = (key, value) => {
    if (value) {
      searchParams.set(key, value)
    } else {
      searchParams.delete(key)
    }
    setSearchParams(searchParams)
  }

  const resetFilters = () => {
    searchParams.delete('search')
    searchParams.delete('status')
    searchParams.delete('eligibility')
    searchParams.delete('jobRole')
    setSearchParams(searchParams)
  }

  const handleCopyToken = (token) => {
    if (!token) {
      toast.error('No access token available')
      return
    }
    const link = window.location.origin + '/assessment/' + token
    navigator.clipboard.writeText(link)
    toast.success('Assessment link copied to clipboard')
  }

  const handleResendEmail = async (sessionId, candidateName, candidateEmail) => {
    if (!sessionId) {
      toast.error('No session ID available')
      return
    }
    try {
      await resendSessionEmail(sessionId)
      toast.success('Assessment email resent successfully')
      setResendModal({ isOpen: false, sessionId: null, candidateName: '', candidateEmail: '' })
    } catch (error) {
      toast.error('Failed to resend email')
    }
  }

  const openResendModal = (sessionId, candidateName, candidateEmail) => {
    if (!sessionId) {
      toast.error('No session ID available')
      return
    }
    setResendModal({
      isOpen: true,
      sessionId: sessionId,
      candidateName: candidateName,
      candidateEmail: candidateEmail
    })
  }

  const handleDeleteSession = async (sessionId) => {
    if (!confirm('Are you sure you want to delete this session?')) return
    try {
      await deleteSession(sessionId)
      toast.success('Session deleted successfully')
      fetchSessions()
    } catch (error) {
      toast.error('Failed to delete session')
    }
  }

  const handleViewRecordings = (sessionId) => {
    if (!sessionId) {
      toast.error('No session ID available')
      return
    }
    navigate('/app/manager/recordings/' + sessionId)
  }

  const handleViewReport = (sessionId) => {
    if (!sessionId) {
      toast.error('No session record available')
      return
    }
    navigate('/app/manager/session-report/' + sessionId)
  }

  const exportSessions = async (format) => {
    try {
      const response = await apiClient.get('/manager/sessions/export', {
        params: {
          format,
          status: statusFilter || undefined,
          eligibility: eligibilityFilter || undefined,
          job_role: jobRoleFilter || undefined,
          search: search || undefined
        },
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `sessions_export.${format}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('Export successful')
    } catch (error) {
      toast.error('Failed to export sessions')
    }
  }

  const getStatusBadge = (status) => {
    const map = {
      scheduled: 'warning',
      in_progress: 'primary',
      completed: 'success',
      expired: 'danger'
    }
    return <Badge variant={map[status] || 'default'}>{status.replace('_', ' ')}</Badge>
  }

  const getEligibilityBadge = (eligibility) => {
    const map = {
      pending: 'warning',
      auto_eligible: 'success',
      auto_blocked: 'danger',
      manager_overridden: 'primary'
    }
    return <Badge variant={map[eligibility] || 'default'}>{eligibility.replace('_', ' ')}</Badge>
  }

  const getCheatingRiskBadge = (risk) => {
    const map = {
      clean: 'success',
      minor: 'warning',
      high: 'danger'
    }
    return <Badge variant={map[risk] || 'default'}>{risk || 'N/A'}</Badge>
  }

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'expired', label: 'Expired' }
  ]

  const eligibilityOptions = [
    { value: '', label: 'All Eligibility' },
    { value: 'pending', label: 'Pending' },
    { value: 'auto_eligible', label: 'Auto Eligible' },
    { value: 'auto_blocked', label: 'Auto Blocked' },
    { value: 'manager_overridden', label: 'Manager Overridden' }
  ]

  const jobRoleOptions = [
    { value: '', label: 'All Job Roles' },
    ...thresholds.map((t) => ({ value: t.job_role_name, label: t.job_role_name }))
  ]

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-navy-800">Assessment Sessions</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportSessions('csv')}>
            <Download className="w-4 h-4 mr-1" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportSessions('json')}>
            <Download className="w-4 h-4 mr-1" />
            JSON
          </Button>
          <Button variant="outline" onClick={() => navigate('/app/sessions/bulk-create')}>
            <Users className="w-4 h-4 mr-2" />
            Bulk Create
          </Button>
          <Button onClick={() => navigate('/app/sessions/create')}>
            <Plus className="w-4 h-4 mr-2" />
            New Session
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="w-full sm:flex-1 sm:min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by candidate name or email..."
                value={search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
            </div>
          </div>
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="w-[160px] sm:w-40 flex-shrink-0"
          />
          <Select
            options={eligibilityOptions}
            value={eligibilityFilter}
            onChange={(e) => updateFilter('eligibility', e.target.value)}
            className="w-[160px] sm:w-44 flex-shrink-0"
          />
          <Select
            options={jobRoleOptions}
            value={jobRoleFilter}
            onChange={(e) => updateFilter('jobRole', e.target.value)}
            className="w-[160px] sm:w-48 flex-shrink-0"
          />
          <Button variant="outline" onClick={fetchSessions} className="w-full sm:w-auto">
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" onClick={resetFilters} className="w-full sm:w-auto">
            Reset Filters
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableHeader>Candidate</TableHeader>
              <TableHeader>Job Role</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Reason</TableHeader>
              <TableHeader>Eligibility</TableHeader>
              <TableHeader>Score</TableHeader>
              <TableHeader>Integrity</TableHeader>
              <TableHeader>Violations</TableHeader>
              <TableHeader>Cheating Risk</TableHeader>
              <TableHeader>Started</TableHeader>
              <TableHeader className="text-right">Actions</TableHeader>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                    No sessions found
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => (
                  <TableRow key={session.session_id || session.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-navy-800">{session.candidate_name}</p>
                        <p className="text-xs text-gray-500">{session.candidate_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{session.job_role}</TableCell>
                    <TableCell>{getStatusBadge(session.status)}</TableCell>
                    <TableCell className="text-xs text-gray-500 max-w-[160px]">
                      {session.reason || '-'}
                    </TableCell>
                    <TableCell>{getEligibilityBadge(session.eligibility)}</TableCell>
                    <TableCell>
                      {session.total_score !== null && session.total_score !== undefined ? (
                        <span className="font-semibold">{session.total_score}%</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {session.integrity_score !== null && session.integrity_score !== undefined ? (
                        <span className="font-semibold">{session.integrity_score}%</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={session.violation_count > 0 ? 'danger' : 'success'}>
                        {session.violation_count ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell>{getCheatingRiskBadge(session.cheating_risk)}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {session.started_at ? formatDate(session.started_at) : 'Not started'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleViewReport(session.session_id || session.id)}
                          className="p-2 text-indigo-600 hover:text-indigo-800 min-h-[40px] min-w-[40px] flex items-center justify-center"
                          title="View Full Report"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            const token = session.access_token
                            if (token) {
                              navigate('/app/sessions/view/' + token)
                            } else {
                              toast.error('No access token available for this session')
                            }
                          }}
                          className="p-2 text-blue-600 hover:text-blue-800 min-h-[40px] min-w-[40px] flex items-center justify-center"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCopyToken(session.access_token || '')}
                          className="p-2 text-gray-600 hover:text-gray-800 min-h-[40px] min-w-[40px] flex items-center justify-center"
                          title="Copy Assessment Link"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleViewRecordings(session.session_id || session.id)}
                          className="p-2 text-purple-600 hover:text-purple-800 min-h-[40px] min-w-[40px] flex items-center justify-center"
                          title="View Recordings"
                        >
                          <Video className="w-4 h-4" />
                        </button>
                        {session.status !== 'completed' && session.status !== 'expired' && (
                          <button
                            onClick={() => openResendModal(session.session_id || session.id, session.candidate_name, session.candidate_email)}
                            className="p-2 text-green-600 hover:text-green-800 min-h-[40px] min-w-[40px] flex items-center justify-center"
                            title="Resend Email"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteSession(session.session_id || session.id)}
                          className="p-2 text-red-600 hover:text-red-800 min-h-[40px] min-w-[40px] flex items-center justify-center"
                          title="Delete Session"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 text-sm text-gray-500">
          Total: {total} sessions
        </div>
      </div>

      <Modal
        isOpen={resendModal.isOpen}
        onClose={() => setResendModal({ isOpen: false, sessionId: null, candidateName: '', candidateEmail: '' })}
        title="Resend Assessment Email"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to resend the assessment email to <strong>{resendModal.candidateName}</strong>?
          </p>
          <p className="text-sm text-gray-500">
            Email: {resendModal.candidateEmail}
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() => handleResendEmail(resendModal.sessionId, resendModal.candidateName, resendModal.candidateEmail)}
              className="flex-1"
            >
              Resend Email
            </Button>
            <Button
              variant="outline"
              onClick={() => setResendModal({ isOpen: false, sessionId: null, candidateName: '', candidateEmail: '' })}
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