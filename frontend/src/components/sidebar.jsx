import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  UserCheck,
  FileQuestion,
  FileText,
  Sliders,
  Calendar,
  Video,
  BarChart3,
  UserPlus,
  Film
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Sidebar() {
  const { user, isAdmin } = useAuth()

  const adminNavItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/users', icon: Users, label: 'Users' },
    { path: '/candidates', icon: UserCheck, label: 'Candidates' },
    { path: '/questions', icon: FileQuestion, label: 'Questions' },
    { path: '/templates', icon: FileText, label: 'Templates' },
    { path: '/thresholds', icon: Sliders, label: 'Thresholds' },
    { path: '/sessions', icon: Calendar, label: 'Sessions' },
  ]

  const managerNavItems = [
    { path: '/manager/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/candidates', icon: UserCheck, label: 'Candidates' },
    { path: '/thresholds', icon: Sliders, label: 'Thresholds' },
    { path: '/sessions', icon: Calendar, label: 'Sessions' },
    { path: '/manager/live', icon: Video, label: 'Live Monitoring' },
    { path: '/manager/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/manager/eligible-shortlist', icon: UserPlus, label: 'Shortlist' },
  ]

  const navItems = isAdmin ? adminNavItems : managerNavItems

  return (
    <aside className="w-64 bg-navy-800 text-white flex flex-col flex-shrink-0 h-screen sticky top-0">
      <div className="p-4 border-b border-navy-700">
        <h1 className="text-xl font-bold">Hiring Platform</h1>
        <p className="text-sm text-gray-400 capitalize">{user?.role || 'User'} Panel</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-navy-700 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-navy-700">
        <div className="text-xs text-gray-400">
          {isAdmin ? 'Admin Access' : 'Manager Access'}
        </div>
      </div>
    </aside>
  )
}