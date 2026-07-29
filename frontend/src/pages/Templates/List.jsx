import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Edit, Trash2, Eye, History, Search, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { getTemplates, deleteTemplate } from '../../api/templates'
import { formatDate } from '../../utils/helpers'
import Table, { TableHead, TableHeader, TableBody, TableRow, TableCell } from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import Modal from '../../components/ui/Modal'

export default function TemplatesList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [templates, setTemplates] = useState([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, templateId: null, templateName: '' })

  const search = searchParams.get('search') || ''
  const statusFilter = searchParams.get('status') || ''

  const navigate = useNavigate()

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ]

  useEffect(() => {
    fetchTemplates()
  }, [search, statusFilter])

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
    searchParams.delete('status')
    setSearchParams(searchParams)
  }

  const fetchTemplates = async () => {
    setIsLoading(true)
    try {
      const params = {
        limit: 100,
      }
      if (statusFilter === 'active') {
        params.is_active = true
      } else if (statusFilter === 'inactive') {
        params.is_active = false
      }
      const data = await getTemplates(params)
      let filteredData = data.items || []
      if (search) {
        const term = search.toLowerCase().trim()
        filteredData = filteredData.filter((template) =>
          template.name.toLowerCase().includes(term) ||
          template.role?.toLowerCase().includes(term) ||
          template.job_role_name?.toLowerCase().includes(term)
        )
      }
      setTemplates(filteredData)
      setTotal(data.total || 0)
    } catch (error) {
      toast.error('Failed to load templates')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id, name) => {
    try {
      await deleteTemplate(id)
      toast.success('Template deleted successfully')
      setDeleteModal({ isOpen: false, templateId: null, templateName: '' })
      fetchTemplates()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete template')
    }
  }

  const openDeleteModal = (id, name) => {
    setDeleteModal({ isOpen: true, templateId: id, templateName: name })
  }

  const getStatusBadge = (isActive) => {
    return <Badge variant={isActive ? 'active' : 'inactive'}>{isActive ? 'Active' : 'Inactive'}</Badge>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-navy-800">Assessment Templates</h1>
        <Button onClick={() => navigate('/templates/create')}>
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search templates..."
                value={search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
            </div>
          </div>
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="w-40"
          />
          <Button variant="outline" onClick={fetchTemplates}>
            <RotateCcw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" onClick={resetFilters}>
            Reset Filters
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <Table>
          <TableHead>
            <TableHeader>Name</TableHeader>
            <TableHeader>Job Role</TableHeader>
            <TableHeader>Duration</TableHeader>
            <TableHeader>Pass %</TableHeader>
            <TableHeader>Status</TableHeader>
            <TableHeader>Sections</TableHeader>
            <TableHeader>Created</TableHeader>
            <TableHeader className="text-right">Actions</TableHeader>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  Loading...
                </TableCell>
              </TableRow>
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  No templates found
                </TableCell>
              </TableRow>
            ) : (
              templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium text-navy-800">{template.name}</TableCell>
                  <TableCell>{template.job_role_name || template.role}</TableCell>
                  <TableCell>{template.duration_minutes} min</TableCell>
                  <TableCell>{template.pass_threshold}%</TableCell>
                  <TableCell>{getStatusBadge(template.is_active)}</TableCell>
                  <TableCell>{template.sections_config?.sections?.length || 0}</TableCell>
                  <TableCell className="text-sm text-gray-500">{formatDate(template.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => navigate(`/templates/${template.id}`)}
                        className="p-1 text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/templates/${template.id}/edit`)}
                        className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/templates/${template.id}/history`)}
                        className="p-1 text-purple-600 hover:text-purple-800 transition-colors"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(template.id, template.name)}
                        className="p-1 text-red-600 hover:text-red-800 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="px-4 py-3 border-t border-gray-200 text-sm text-gray-500">
          Total: {total} templates
        </div>
      </div>

      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, templateId: null, templateName: '' })}
        title="Delete Template"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete template <strong>{deleteModal.templateName}</strong>?
          </p>
          <p className="text-sm text-gray-500">This action cannot be undone.</p>
          <div className="flex gap-3">
            <button
              onClick={() => handleDelete(deleteModal.templateId, deleteModal.templateName)}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => setDeleteModal({ isOpen: false, templateId: null, templateName: '' })}
              className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}