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
  X
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Sidebar({ isOpen, onClose }) {
  const { user, isAdmin } = useAuth()

  const adminNavItems = [
    { path: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/app/users', icon: Users, label: 'Users' },
    { path: '/app/candidates', icon: UserCheck, label: 'Candidates' },
    { path: '/app/questions', icon: FileQuestion, label: 'Questions' },
    { path: '/app/templates', icon: FileText, label: 'Templates' },
    { path: '/app/thresholds', icon: Sliders, label: 'Thresholds' },
    { path: '/app/sessions', icon: Calendar, label: 'Sessions' },
  ]

  const managerNavItems = [
    { path: '/app/manager/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/app/candidates', icon: UserCheck, label: 'Candidates' },
    { path: '/app/thresholds', icon: Sliders, label: 'Thresholds' },
    { path: '/app/sessions', icon: Calendar, label: 'Sessions' },
    { path: '/app/manager/live', icon: Video, label: 'Live Monitoring' },
    { path: '/app/manager/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/app/manager/eligible-shortlist', icon: UserPlus, label: 'Shortlist' },
  ]

  const navItems = isAdmin ? adminNavItems : managerNavItems

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 dark:bg-black/60 transition-opacity lg:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      <aside
        className={`
          w-64 bg-navy-800 dark:bg-dark-900 text-white flex flex-col flex-shrink-0
          fixed inset-y-0 left-0 z-50 h-screen
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:z-auto lg:sticky lg:top-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="p-4 border-b border-navy-700 dark:border-dark-700 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">HireAssess</h1>
            <p className="text-sm text-gray-400 dark:text-gray-500 capitalize">{user?.role || 'User'} Panel</p>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded hover:bg-navy-700 dark:hover:bg-dark-700 min-h-[36px] min-w-[36px] flex items-center justify-center"
            aria-label="Close menu"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose} 
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors min-h-[44px] ${
                  isActive
                    ? 'bg-accent-500 text-white'
                    : 'text-gray-300 dark:text-gray-400 hover:bg-navy-700 dark:hover:bg-dark-700 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-navy-700 dark:border-dark-700">
          <div className="text-xs text-gray-400 dark:text-gray-500">
            {isAdmin ? 'Admin Access' : 'Manager Access'}
          </div>
        </div>
      </aside>
    </>
  )
}