import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Mail, User, FileText, Clock, Shield, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { getSessionByToken, resendSessionEmail } from '../../api/sessions'
import { formatDate } from '../../utils/helpers'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'

export default function SessionViewByToken() {
  const { accessToken } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchSession = async () => {
      setLoading(true)
      setError('')
      try {
        if (!accessToken || accessToken === 'undefined') {
          setError('No valid access token provided')
          setLoading(false)
          return
        }
        const data = await getSessionByToken(accessToken)
        setSession(data)
      } catch (error) {
        const message = error.response?.data?.detail || 'Failed to load session details'
        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }
    fetchSession()
  }, [accessToken])

  const handleCopyToken = () => {
    if (accessToken && accessToken !== 'undefined') {
      const link = window.location.origin + '/assessment/' + accessToken
      navigator.clipboard.writeText(link)
      toast.success('Assessment link copied to clipboard')
    } else {
      toast.error('No valid access token')
    }
  }

  const handleResendEmail = async () => {
    if (!session?.session_id) return
    setResending(true)
    try {
      await resendSessionEmail(session.session_id)
      toast.success('Assessment email resent successfully')
    } catch (error) {
      toast.error('Failed to resend email')
    } finally {
      setResending(false)
    }
  }

  const handleCancel = () => {
    navigate('/sessions')
  }

  const getStatusBadge = (status) => {
    const map = {
      scheduled: 'warning',
      in_progress: 'primary',
      completed: 'success',
      expired: 'danger'
    }
    return <Badge variant={map[status] || 'default'}>{status?.replace('_', ' ') || 'Unknown'}</Badge>
  }

  const getEligibilityBadge = (eligibility) => {
    const map = {
      pending: 'warning',
      auto_eligible: 'success',
      auto_blocked: 'danger',
      manager_overridden: 'primary'
    }
    return <Badge variant={map[eligibility] || 'default'}>{eligibility?.replace('_', ' ') || 'Pending'}</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-navy-800">Session Not Found</h2>
        <p className="text-gray-500">{error || 'The session you are looking for does not exist.'}</p>
        <Button className="mt-4" onClick={handleCancel}>Back to Sessions</Button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={handleCancel} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-navy-800">Session Details</h1>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm text-gray-500">Access Token</p>
            <div className="flex items-center gap-2 mt-1">
              <code className="bg-gray-100 px-3 py-1 rounded text-sm font-mono">
                {accessToken}
              </code>
              <button
                onClick={handleCopyToken}
                className="p-1 text-gray-400 hover:text-gray-600"
                title="Copy Link"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResendEmail}
              isLoading={resending}
            >
              <Mail className="w-4 h-4 mr-1" /> Resend Email
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-navy-800 mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-gray-500" /> Candidate
          </h3>
          <div className="space-y-2">
            <p className="font-medium">{session.candidate_name || 'Unknown'}</p>
            <p className="text-sm text-gray-500">{session.candidate_email || 'No email'}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-navy-800 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500" /> Template
          </h3>
          <div className="space-y-2">
            <p className="font-medium">{session.template_name || 'Unknown'}</p>
            <p className="text-sm text-gray-500">{session.job_role || 'No role'}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-6">
        <h3 className="font-semibold text-navy-800 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-500" /> Status & Timeline
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <div className="mt-1">{getStatusBadge(session.status)}</div>
          </div>
          <div>
            <p className="text-sm text-gray-500">Eligibility</p>
            <div className="mt-1">{getEligibilityBadge(session.eligibility)}</div>
          </div>
          <div>
            <p className="text-sm text-gray-500">Started At</p>
            <p className="text-sm font-medium">{session.started_at ? formatDate(session.started_at) : 'Not started'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Finished At</p>
            <p className="text-sm font-medium">{session.finished_at ? formatDate(session.finished_at) : 'Not finished'}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-navy-800 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-gray-500" /> Results
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Total Score</p>
            <p className="text-xl font-bold text-navy-800">
              {session.total_score !== null && session.total_score !== undefined ? `${session.total_score}%` : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Integrity Score</p>
            <p className="text-xl font-bold text-navy-800">
              {session.integrity_score !== null && session.integrity_score !== undefined ? `${session.integrity_score}%` : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Cheating Risk</p>
            <p className="text-xl font-bold text-navy-800 capitalize">{session.cheating_risk || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Duration</p>
            <p className="text-xl font-bold text-navy-800">
              {session.duration_minutes ? `${session.duration_minutes} min` : '-'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}