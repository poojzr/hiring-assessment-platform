import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { getUser, createUser, updateUser } from '../../api/users'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'

export default function UserForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = !!id

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'manager',
    is_active: true,
  })

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        if (isEdit) {
          const userData = await getUser(parseInt(id))
          setFormData({
            name: userData.name,
            email: userData.email,
            password: '',
            role: userData.role,
            is_active: userData.is_active,
          })
        }
      } catch (error) {
        toast.error('Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id, isEdit])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error('Name is required')
      return
    }
    if (!formData.email.trim()) {
      toast.error('Email is required')
      return
    }
    if (!isEdit && !formData.password) {
      toast.error('Password is required for new user')
      return
    }

    setSubmitting(true)

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      role: formData.role,
      is_active: formData.is_active,
    }

    if (!isEdit && formData.password) {
      payload.password = formData.password
    }

    try {
      if (isEdit) {
        await updateUser(parseInt(id), payload)
        toast.success('User updated successfully')
      } else {
        await createUser(payload)
        toast.success('User created successfully')
      }
      navigate('/users')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save user')
    } finally {
      setSubmitting(false)
    }
  }

  const roleOptions = [
    { value: 'admin', label: 'Admin' },
    { value: 'manager', label: 'Manager' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-navy-800">
          {isEdit ? 'Edit User' : 'Create User'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter full name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="Enter email address"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
            required
          />
        </div>

        {!isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Enter password (min 8 characters)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
              required={!isEdit}
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
          <Select
            options={roleOptions}
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            required
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            className="w-4 h-4 text-accent-500 rounded focus:ring-accent-500"
          />
          <label className="text-sm text-gray-700">Active</label>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <Button
            type="submit"
            isLoading={submitting}
            className="flex-1"
          >
            {isEdit ? 'Update User' : 'Create User'}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}