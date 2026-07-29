import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Users, UserCheck, Clock, TrendingUp, 
  Shield, AlertTriangle, Eye, Video, 
  FileText, BarChart3, UserPlus, Calendar
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '../../api/client'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'

export default function ManagerDashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total_sessions: 0,
    total_candidates: 0,
    active_sessions: 0,
    completion_rate: 0,
    pass_rate: 0,
    average_score: 0,
    eligible_count: 0,
    integrity_distribution: { clean: 0, minor: 0, high: 0 },
    total_violations: 0,
    violation_summary: { critical: 0, high: 0, medium: 0, low: 0 }
  })
  const [recentSessions, setRecentSessions] = useState([])
  const [activeSessions, setActiveSessions] = useState([])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const [statsRes, sessionsRes, candidatesRes] = await Promise.all([
        apiClient.get('/manager/analytics/overview'),
        apiClient.get('/manager/sessions?limit=10'),
        apiClient.get('/candidates?limit=1')
      ])
      
      setStats({
        ...statsRes.data,
        total_candidates: candidatesRes.data?.total || 0,
        active_sessions: statsRes.data.active_sessions || 0
      })
      setRecentSessions(sessionsRes.data.items || [])
      
      const active = await apiClient.get('/manager/sessions?status=in_progress&limit=50')
      setActiveSessions(active.data.items || [])
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
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

  const getEligibilityColor = (eligibility) => {
    const map = {
      pending: 'bg-yellow-100 text-yellow-700',
      auto_eligible: 'bg-green-100 text-green-700',
      auto_blocked: 'bg-red-100 text-red-700',
      manager_overridden: 'bg-purple-100 text-purple-700'
    }
    return map[eligibility] || 'bg-gray-100 text-gray-700'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner />
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-navy-800">Manager Dashboard</h1>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate('/manager/live')}>
            <Eye className="w-4 h-4 mr-2" />
            Live Monitoring ({activeSessions.length})
          </Button>
          <Button variant="outline" onClick={() => navigate('/sessions')}>
            <FileText className="w-4 h-4 mr-2" />
            All Sessions
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Sessions</p>
              <p className="text-2xl font-bold text-navy-800">{stats.total_sessions}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Candidates</p>
              <p className="text-2xl font-bold text-navy-800">{stats.total_candidates}</p>
            </div>
            <div className="bg-indigo-100 p-3 rounded-lg">
              <Users className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Sessions</p>
              <p className="text-2xl font-bold text-green-600">{stats.active_sessions || activeSessions.length}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <Video className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Eligible Candidates</p>
              <p className="text-2xl font-bold text-purple-600">{stats.eligible_count || 0}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <UserCheck className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-navy-800 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-gray-500" />
            Integrity Distribution
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Clean</span>
                <span className="font-medium">{stats.integrity_distribution?.clean || 0}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div 
                  className="bg-green-500 rounded-full h-2" 
                  style={{ width: ((stats.integrity_distribution?.clean / (stats.total_sessions || 1)) * 100) + '%' }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Minor</span>
                <span className="font-medium">{stats.integrity_distribution?.minor || 0}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div 
                  className="bg-yellow-500 rounded-full h-2" 
                  style={{ width: ((stats.integrity_distribution?.minor / (stats.total_sessions || 1)) * 100) + '%' }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">High</span>
                <span className="font-medium">{stats.integrity_distribution?.high || 0}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div 
                  className="bg-red-500 rounded-full h-2" 
                  style={{ width: ((stats.integrity_distribution?.high / (stats.total_sessions || 1)) * 100) + '%' }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-navy-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-gray-500" />
            Violations Summary
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm py-1 border-b border-gray-100">
              <span className="text-gray-600">Critical</span>
              <span className="font-medium text-red-600">{stats.violation_summary?.critical || 0}</span>
            </div>
            <div className="flex justify-between text-sm py-1 border-b border-gray-100">
              <span className="text-gray-600">High</span>
              <span className="font-medium text-orange-600">{stats.violation_summary?.high || 0}</span>
            </div>
            <div className="flex justify-between text-sm py-1 border-b border-gray-100">
              <span className="text-gray-600">Medium</span>
              <span className="font-medium text-yellow-600">{stats.violation_summary?.medium || 0}</span>
            </div>
            <div className="flex justify-between text-sm py-1">
              <span className="text-gray-600">Low</span>
              <span className="font-medium text-blue-600">{stats.violation_summary?.low || 0}</span>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between text-sm">
              <span className="font-medium text-gray-700">Total</span>
              <span className="font-bold text-navy-800">{stats.total_violations || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-navy-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-500" />
            Quick Actions
          </h3>
          <div className="space-y-3">
            <Button 
              variant="primary" 
              fullWidth
              onClick={() => navigate('/manager/live')}
            >
              <Video className="w-4 h-4 mr-2" />
              Live Monitoring
            </Button>
            <Button 
              variant="outline" 
              fullWidth
              onClick={() => navigate('/sessions/bulk-create')}
            >
              <Users className="w-4 h-4 mr-2" />
              Bulk Create Sessions
            </Button>
            <Button 
              variant="outline" 
              fullWidth
              onClick={() => navigate('/sessions')}
            >
              <FileText className="w-4 h-4 mr-2" />
              View All Sessions
            </Button>
            <Button 
              variant="outline" 
              fullWidth
              onClick={() => navigate('/candidates')}
            >
              <UserCheck className="w-4 h-4 mr-2" />
              Manage Candidates
            </Button>
            <Button 
              variant="outline" 
              fullWidth
              onClick={() => navigate('/manager/eligible-shortlist')}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Eligible Shortlist
            </Button>
            <Button 
              variant="outline" 
              fullWidth
              onClick={() => navigate('/manager/analytics')}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-navy-800 mb-4">Recent Sessions</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Candidate</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Job Role</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Eligibility</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Score</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Integrity</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentSessions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                    No sessions found
                  </td>
                </tr>
              ) : (
                recentSessions.map((session) => (
                  <tr key={session.session_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-navy-800">{session.candidate_name}</p>
                        <p className="text-xs text-gray-500">{session.candidate_email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{session.job_role}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                        {session.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEligibilityColor(session.eligibility)}`}>
                        {session.eligibility.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {session.total_score !== null ? session.total_score + '%' : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {session.integrity_score !== null ? session.integrity_score + '%' : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate('/sessions/view/' + session.access_token)}
                        className="p-1 text-blue-600 hover:text-blue-800"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}