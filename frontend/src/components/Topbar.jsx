import { LogOut, User as UserIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLocation } from 'react-router-dom'

export default function Topbar() {
  const { user, logout } = useAuth()
  const location = useLocation()

  const getPageTitle = () => {
    const path = location.pathname
    if (path === '/dashboard') return 'Dashboard'
    if (path === '/users') return 'Users'
    if (path === '/users/create') return 'Create User'
    if (path.match(/^\/users\/\d+\/edit$/)) return 'Edit User'
    if (path.match(/^\/users\/\d+$/)) return 'User Detail'
    if (path === '/questions') return 'Questions'
    if (path === '/questions/create') return 'Create Question'
    if (path.match(/^\/questions\/\d+\/edit$/)) return 'Edit Question'
    if (path.match(/^\/questions\/\d+$/)) return 'Question Detail'
    if (path === '/questions/bulk-import') return 'Bulk Import'
    if (path === '/templates') return 'Templates'
    if (path === '/templates/create') return 'Create Template'
    if (path.match(/^\/templates\/\d+\/edit$/)) return 'Edit Template'
    if (path.match(/^\/templates\/\d+$/)) return 'Template Detail'
    if (path === '/thresholds') return 'Thresholds'
    if (path === '/thresholds/create') return 'Create Threshold'
    if (path.match(/^\/thresholds\/\d+\/edit$/)) return 'Edit Threshold'
    return 'Dashboard'
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="text-sm text-gray-500 capitalize">{getPageTitle()}</div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-50 rounded-full flex items-center justify-center">
            <UserIcon className="w-4 h-4 text-primary-600" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-navy-800">{user?.name}</p>
            <p className="text-gray-500 text-xs capitalize">{user?.role}</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-md hover:bg-red-50"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}