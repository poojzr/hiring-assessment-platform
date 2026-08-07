import { LogOut, User as UserIcon, Menu } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLocation } from 'react-router-dom'

export default function Topbar({ onMenuClick }) {
  const { user, logout } = useAuth()
  const location = useLocation()

  const getPageTitle = () => {
    const path = location.pathname
    if (path === '/app/dashboard') return 'Dashboard'
    if (path === '/app/users') return 'Users'
    if (path === '/app/users/create') return 'Create User'
    if (path.match(/^\/app\/users\/\d+\/edit$/)) return 'Edit User'
    if (path.match(/^\/app\/users\/\d+$/)) return 'User Detail'
    if (path === '/app/questions') return 'Questions'
    if (path === '/app/questions/create') return 'Create Question'
    if (path.match(/^\/app\/questions\/\d+\/edit$/)) return 'Edit Question'
    if (path.match(/^\/app\/questions\/\d+$/)) return 'Question Detail'
    if (path === '/app/questions/bulk-import') return 'Bulk Import'
    if (path === '/app/templates') return 'Templates'
    if (path === '/app/templates/create') return 'Create Template'
    if (path.match(/^\/app\/templates\/\d+\/edit$/)) return 'Edit Template'
    if (path.match(/^\/app\/templates\/\d+$/)) return 'Template Detail'
    if (path === '/app/thresholds') return 'Thresholds'
    if (path === '/app/thresholds/create') return 'Create Threshold'
    if (path.match(/^\/app\/thresholds\/\d+\/edit$/)) return 'Edit Threshold'
    if (path === '/app/sessions') return 'Sessions'
    if (path === '/app/sessions/create') return 'Create Session'
    if (path === '/app/sessions/bulk-create') return 'Bulk Create Sessions'
    if (path.match(/^\/app\/sessions\/view\/.+/)) return 'Session Details'
    if (path === '/app/candidates') return 'Candidates'
    if (path === '/app/candidates/create') return 'Create Candidate'
    if (path.match(/^\/app\/candidates\/\d+\/edit$/)) return 'Edit Candidate'
    if (path.match(/^\/app\/candidates\/\d+$/)) return 'Candidate Detail'
    if (path === '/app/manager/dashboard') return 'Manager Dashboard'
    if (path === '/app/manager/live') return 'Live Monitoring'
    if (path.match(/^\/app\/manager\/report\/\d+$/)) return 'Candidate Report'
    if (path === '/app/manager/eligible-shortlist') return 'Eligible Shortlist'
    if (path.match(/^\/app\/manager\/session-report\/\d+$/)) return 'Session Report'
    if (path === '/app/manager/analytics') return 'Analytics'
    if (path === '/app/manager/recordings') return 'Recordings'
    if (path.match(/^\/app\/manager\/recordings\/\d+$/)) return 'Recordings'
    return 'Dashboard'
  }

  return (
    <header className="bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 rounded-md hover:bg-gray-100 dark:hover:bg-dark-700 min-h-[40px] min-w-[40px] flex items-center justify-center flex-shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-navy-800 dark:text-white" />
        </button>

        <div className="text-sm text-gray-500 dark:text-gray-400 capitalize truncate">{getPageTitle()}</div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 bg-accent-50 dark:bg-accent-900/30 rounded-full flex items-center justify-center flex-shrink-0">
            <UserIcon className="w-4 h-4 text-accent-600 dark:text-accent-400" />
          </div>
          <div className="text-sm hidden sm:block">
            <p className="font-medium text-navy-800 dark:text-white">{user?.name}</p>
            <p className="text-gray-500 dark:text-gray-400 text-xs capitalize">{user?.role}</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 min-h-[40px] min-w-[40px] flex items-center justify-center"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}