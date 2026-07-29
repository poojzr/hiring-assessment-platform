import { useState, useEffect } from 'react'
import { 
  BarChart3, PieChart, TrendingUp, 
  Users, CheckCircle, AlertTriangle,
  Download
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '../../api/client'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import Select from '../../components/ui/Select'

export default function Analytics() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total_sessions: 0,
    completion_rate: 0,
    pass_rate: 0,
    average_score: 0,
    eligible_count: 0,
    integrity_distribution: { clean: 0, minor: 0, high: 0 },
    total_violations: 0,
    violation_summary: { critical: 0, high: 0, medium: 0, low: 0 }
  })
  const [questions, setQuestions] = useState([])
  const [filters, setFilters] = useState({
    difficulty: ''
  })

  useEffect(() => {
    fetchAnalytics()
  }, [filters])

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const [statsRes, questionsRes] = await Promise.all([
        apiClient.get('/manager/analytics/overview'),
        apiClient.get('/manager/analytics/questions', { 
          params: filters.difficulty ? { difficulty: filters.difficulty } : {} 
        })
      ])
      
      setStats(statsRes.data)
      setQuestions(questionsRes.data || [])
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
      toast.error('Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  const exportAnalytics = async (format) => {
    try {
      const response = await apiClient.get('/manager/candidates/export', {
        params: { format },
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'analytics_report.' + format)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('Analytics exported successfully')
    } catch (error) {
      toast.error('Failed to export analytics')
    }
  }

  const getDifficultyColor = (difficulty) => {
    if (difficulty === 'easy') return 'bg-green-100 text-green-700'
    if (difficulty === 'medium') return 'bg-yellow-100 text-yellow-700'
    if (difficulty === 'hard') return 'bg-red-100 text-red-700'
    return 'bg-gray-100 text-gray-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner />
      </div>
    )
  }

  const totalSessions = stats.total_sessions || 1

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-navy-800">Analytics</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportAnalytics('csv')}>
            <Download className="w-4 h-4 mr-1" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportAnalytics('json')}>
            <Download className="w-4 h-4 mr-1" />
            Export JSON
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
            <div className="bg-blue-100 p-3 rounded-lg flex-shrink-0">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Completion Rate</p>
              <div className="bg-green-100 p-2 rounded-lg flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-green-600 mt-1">{stats.completion_rate || 0}%</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-green-500 rounded-full h-2 transition-all duration-500"
                style={{ width: Math.min(stats.completion_rate || 0, 100) + '%' }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Pass Rate</p>
              <div className="bg-purple-100 p-2 rounded-lg flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-blue-600 mt-1">{stats.pass_rate || 0}%</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-500 rounded-full h-2 transition-all duration-500"
                style={{ width: Math.min(stats.pass_rate || 0, 100) + '%' }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg Score</p>
              <p className="text-2xl font-bold text-navy-800">{stats.average_score || 0}%</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg flex-shrink-0">
              <BarChart3 className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-navy-800 mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-gray-500" />
            Integrity Distribution
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Clean</span>
                <span className="font-medium">{stats.integrity_distribution.clean || 0}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div 
                  className="bg-green-500 rounded-full h-2 transition-all duration-500" 
                  style={{ width: ((stats.integrity_distribution.clean / totalSessions) * 100) + '%' }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Minor</span>
                <span className="font-medium">{stats.integrity_distribution.minor || 0}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div 
                  className="bg-yellow-500 rounded-full h-2 transition-all duration-500" 
                  style={{ width: ((stats.integrity_distribution.minor / totalSessions) * 100) + '%' }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">High</span>
                <span className="font-medium">{stats.integrity_distribution.high || 0}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div 
                  className="bg-red-500 rounded-full h-2 transition-all duration-500" 
                  style={{ width: ((stats.integrity_distribution.high / totalSessions) * 100) + '%' }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-navy-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-gray-500" />
            Violation Summary
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{stats.violation_summary.critical || 0}</p>
              <p className="text-sm text-gray-500">Critical</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">{stats.violation_summary.high || 0}</p>
              <p className="text-sm text-gray-500">High</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">{stats.violation_summary.medium || 0}</p>
              <p className="text-sm text-gray-500">Medium</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{stats.violation_summary.low || 0}</p>
              <p className="text-sm text-gray-500">Low</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between">
            <span className="text-sm font-medium text-gray-700">Total Violations</span>
            <span className="text-xl font-bold text-navy-800">{stats.total_violations || 0}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-navy-800 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-gray-500" />
          Question Performance
        </h3>
        
        <div className="flex flex-wrap gap-3 mb-4">
          <Select
            options={[
              { value: '', label: 'All Difficulties' },
              { value: 'easy', label: 'Easy' },
              { value: 'medium', label: 'Medium' },
              { value: 'hard', label: 'Hard' }
            ]}
            value={filters.difficulty}
            onChange={(e) => setFilters({ difficulty: e.target.value })}
            className="w-40"
          />
          <Button variant="outline" size="sm" onClick={() => setFilters({ difficulty: '' })}>
            Reset Filters
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Question</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Difficulty</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Topic</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Uses</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Pass Rate</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {questions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                    No question data available
                  </td>
                </tr>
              ) : (
                questions.map((q) => (
                  <tr key={q.question_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-navy-800 max-w-xs truncate">
                      {q.text}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={q.type === 'CODING' ? 'warning' : 'primary'}>
                        {q.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className={'px-2 py-1 rounded-full text-xs font-medium ' + getDifficultyColor(q.difficulty)}>
                        {q.difficulty || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{q.topic || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{q.total_uses || 0}</td>
                    <td className="px-4 py-3">
                      {q.pass_rate !== null && q.pass_rate !== undefined ? (
                        <span className={'font-semibold ' + (
                          q.pass_rate >= 70 ? 'text-green-600' :
                          q.pass_rate >= 40 ? 'text-yellow-600' :
                          'text-red-600'
                        )}>
                          {q.pass_rate}%
                        </span>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {q.flags && q.flags.length > 0 && q.flags.includes('too_hard') && (
                          <Badge variant="danger">Too Hard</Badge>
                        )}
                        {q.flags && q.flags.length > 0 && q.flags.includes('too_easy') && (
                          <Badge variant="success">Too Easy</Badge>
                        )}
                        {(!q.flags || q.flags.length === 0) && (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
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