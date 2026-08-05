import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Mail, User as UserIcon, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import { getUser } from '../../api/users'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'

export default function UserDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await getUser(id)
        setUser(data)
      } catch (error) {
        toast.error('Failed to load user')
        navigate('/users')
      } finally {
        setIsLoading(false)
      }
    }
    fetchUser()
  }, [id, navigate])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="max-w-3xl px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <button onClick={() => navigate('/users')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm sm:text-base">
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </button>
        <button
          onClick={() => navigate(`/users/${id}/edit`)}
          className="flex items-center gap-2 text-accent-500 hover:text-accent-600 text-sm sm:text-base"
        >
          <Edit className="w-4 h-4" />
          Edit User
        </button>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-accent-100 rounded-full flex items-center justify-center flex-shrink-0 mx-auto sm:mx-0">
            <UserIcon className="w-8 h-8 sm:w-10 sm:h-10 text-accent-500" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-xl sm:text-2xl font-bold text-navy-800 break-words">{user.name}</h1>
            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2 mt-1">
              <Badge variant={user.role === 'admin' ? 'admin' : user.role === 'manager' ? 'manager' : 'candidate'}>
                {user.role}
              </Badge>
              <Badge variant={user.is_active ? 'active' : 'inactive'}>
                {user.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Email</p>
              <p className="text-sm text-navy-800 break-words">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Created</p>
              <p className="text-sm text-navy-800 break-words">
                {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}