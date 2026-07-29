import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, FileQuestion, FileText, Sliders, Calendar, UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import apiClient from '../api/client'

export default function Dashboard() {
  const [stats, setStats] = useState({
    total_users: 0,
    total_questions: 0,
    total_templates: 0,
    total_thresholds: 0,
    total_sessions: 0,
    total_candidates: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }

    if (!isAdmin) {
      setIsLoading(false)
      return
    }

    const fetchStats = async () => {
      const results = await Promise.allSettled([
        apiClient.get('/admin/users?limit=1'),
        apiClient.get('/admin/questions?limit=1'),
        apiClient.get('/admin/templates?limit=1'),
        apiClient.get('/admin/thresholds'),
        apiClient.get('/manager/sessions?limit=1'),
        apiClient.get('/candidates?limit=1'),
      ])

      const [users, questions, templates, thresholds, sessions, candidates] = results

      setStats({
        total_users: users.status === 'fulfilled' ? (users.value.data?.total || 0) : 0,
        total_questions: questions.status === 'fulfilled' ? (questions.value.data?.total || 0) : 0,
        total_templates: templates.status === 'fulfilled' ? (templates.value.data?.total || 0) : 0,
        total_thresholds: thresholds.status === 'fulfilled' ? (Array.isArray(thresholds.value.data) ? thresholds.value.data.length : 0) : 0,
        total_sessions: sessions.status === 'fulfilled' ? (sessions.value.data?.total || 0) : 0,
        total_candidates: candidates.status === 'fulfilled' ? (candidates.value.data?.total || 0) : 0,
      })

      const labels = ['users', 'questions', 'templates', 'thresholds', 'sessions', 'candidates']
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.error(`Stat fetch failed [${labels[i]}]:`, r.reason?.response?.status, r.reason?.response?.data)
        }
      })

      setIsLoading(false)
    }

    fetchStats()
  }, [user, isAdmin, navigate])

  if (!isAdmin && user) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <h1 className="text-2xl font-bold text-navy-800 mb-4">Manager Dashboard</h1>
        <p className="text-gray-500">Manager dashboard is coming soon.</p>
        <p className="text-sm text-gray-400 mt-2">You have manager access. Admin features are restricted.</p>
      </div>
    )
  }

  const cards = [
    { title: 'Total Users', value: stats.total_users, icon: Users, color: 'bg-blue-500', link: '/users' },
    { title: 'Candidates', value: stats.total_candidates, icon: UserPlus, color: 'bg-indigo-500', link: '/candidates' },
    { title: 'Questions', value: stats.total_questions, icon: FileQuestion, color: 'bg-green-500', link: '/questions' },
    { title: 'Templates', value: stats.total_templates, icon: FileText, color: 'bg-purple-500', link: '/templates' },
    { title: 'Thresholds', value: stats.total_thresholds, icon: Sliders, color: 'bg-orange-500', link: '/thresholds' },
    { title: 'Sessions', value: stats.total_sessions, icon: Calendar, color: 'bg-teal-500', link: '/sessions' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-800 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {cards.map((card) => (
          <div
            key={card.title}
            onClick={() => navigate(card.link)}
            className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.title}</p>
                <p className="text-2xl font-bold text-navy-800 mt-1">
                  {isLoading ? '...' : card.value}
                </p>
              </div>
              <div className={`${card.color} p-3 rounded-lg text-white`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}