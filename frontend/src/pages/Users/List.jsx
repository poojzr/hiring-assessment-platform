import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Edit, UserX, UserMinus, Search, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { getUsers, deleteUser } from '../../api/users'
import { formatDate } from '../../utils/helpers'
import Table, { TableHead, TableHeader, TableBody, TableRow, TableCell } from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import Modal from '../../components/ui/Modal'

export default function UsersList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, userId: null, userName: '', userRole: '' })
  const [currentUserId, setCurrentUserId] = useState(null)
  const navigate = useNavigate()

  const search = searchParams.get('search') || ''
  const roleFilter = searchParams.get('role') || ''
  const statusFilter = searchParams.get('status') || ''

  const roleOptions = [
    { value: '', label: 'All Roles' },
    { value: 'admin', label: 'Admin' },
    { value: 'manager', label: 'Manager' },
  ]

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ]

  useEffect(() => {
    const userId = sessionStorage.getItem('user_id')
    if (userId) {
      setCurrentUserId(parseInt(userId))
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [search, roleFilter, statusFilter, currentUserId])

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
    searchParams.delete('role')
    searchParams.delete('status')
    setSearchParams(searchParams)
  }

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const params = { limit: 100 }
      if (search) params.search = search
      if (roleFilter) params.role = roleFilter
      if (statusFilter) params.is_active = statusFilter === 'active'
      const data = await getUsers(params)
      
      let userList = data.items || []
      
      if (currentUserId) {
        const currentUser = userList.find(u => u.id === currentUserId)
        const otherUsers = userList.filter(u => u.id !== currentUserId)
        userList = currentUser ? [currentUser, ...otherUsers] : userList
      }
      
      setUsers(userList)
      setTotal(data.total || 0)
    } catch (error) {
      toast.error('Failed to load users')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id, name, role, permanent) => {
    if (id === currentUserId) {
      toast.error('You cannot delete yourself')
      return
    }
    try {
      await deleteUser(id, permanent)
      toast.success(permanent ? 'User deleted permanently' : 'User deactivated (soft delete)')
      setDeleteModal({ isOpen: false, userId: null, userName: '', userRole: '' })
      fetchUsers()
    } catch (error) {
      toast.error('Failed to delete user')
    }
  }

  const openDeleteModal = (id, name, role) => {
    if (id === currentUserId) {
      toast.error('You cannot delete yourself')
      return
    }
    setDeleteModal({ isOpen: true, userId: id, userName: name, userRole: role })
  }

  const getRoleBadge = (role) => {
    const map = {
      admin: 'admin',
      manager: 'manager',
    }
    return <Badge variant={map[role] || 'default'}>{role}</Badge>
  }

  const getStatusBadge = (isActive) => {
    return <Badge variant={isActive ? 'active' : 'inactive'}>{isActive ? 'Active' : 'Inactive'}</Badge>
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-navy-800">Users</h1>
        <Button onClick={() => navigate('/users/create')} className="w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4 mr-2" />
          New User
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="w-full sm:flex-1 sm:min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
            </div>
          </div>
          <Select
            options={roleOptions}
            value={roleFilter}
            onChange={(e) => updateFilter('role', e.target.value)}
            className="w-full sm:w-40"
          />
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="w-full sm:w-40"
          />
          <Button variant="outline" onClick={fetchUsers} className="w-full sm:w-auto">
            <RotateCcw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" onClick={resetFilters} className="w-full sm:w-auto">
            Reset Filters
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <Table>
          <TableHead>
            <TableHeader>Name</TableHeader>
            <TableHeader>Email</TableHeader>
            <TableHeader>Role</TableHeader>
            <TableHeader>Status</TableHeader>
            <TableHeader>Created</TableHeader>
            <TableHeader className="text-right">Actions</TableHeader>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  Loading...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium text-navy-800 whitespace-nowrap">{user.name}</TableCell>
                  <TableCell className="whitespace-nowrap">{user.email}</TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell>{getStatusBadge(user.is_active)}</TableCell>
                  <TableCell className="text-sm text-gray-500 whitespace-nowrap">{formatDate(user.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => navigate(`/users/${user.id}/edit`)}
                        className="p-2 -m-1 text-blue-600 hover:text-blue-800 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {user.id !== currentUserId && (
                        <>
                          <button
                            onClick={() => openDeleteModal(user.id, user.name, user.role)}
                            className="p-2 -m-1 text-red-600 hover:text-red-800 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                            title="Delete options"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                          {user.is_active && (
                            <button
                              onClick={() => handleDelete(user.id, user.name, user.role, false)}
                              className="p-2 -m-1 text-orange-500 hover:text-orange-700 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                              title="Soft delete (deactivate)"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="px-4 py-3 border-t border-gray-200 text-sm text-gray-500">
          Total: {total} users
        </div>
      </div>

      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, userId: null, userName: '', userRole: '' })}
        title="Delete User"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete <strong>{deleteModal.userName}</strong>?
          </p>
          <p className="text-sm text-gray-500">
            Choose an option below:
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => handleDelete(deleteModal.userId, deleteModal.userName, deleteModal.userRole, false)}
              className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md transition-colors"
            >
              Soft Delete (Deactivate)
            </button>
            <button
              onClick={() => handleDelete(deleteModal.userId, deleteModal.userName, deleteModal.userRole, true)}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
            >
              Permanent Delete
            </button>
          </div>
          <button
            onClick={() => setDeleteModal({ isOpen: false, userId: null, userName: '', userRole: '' })}
            className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition-colors"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  )
}