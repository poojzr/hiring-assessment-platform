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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-navy-800">Assessment Templates</h1>
        <Button onClick={() => navigate('/app/templates/create')} className="w-full sm:w-auto justify-center text-sm">
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full sm:flex-1 sm:min-w-[200px]">
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
            className="w-[160px] sm:w-40 flex-shrink-0"
          />
          <Button variant="outline" onClick={fetchTemplates} className="w-full sm:w-auto flex-shrink-0 text-sm">
            <RotateCcw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" onClick={resetFilters} className="w-full sm:w-auto flex-shrink-0 text-sm">
            Reset Filters
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Name</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Job Role</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Duration</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Pass %</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Sections</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Created</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500 text-sm">Loading...</td>
                </tr>
              ) : templates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500 text-sm">No templates found</td>
                </tr>
              ) : (
                templates.map((template) => (
                  <tr key={template.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 font-medium text-navy-800 whitespace-nowrap text-sm">{template.name}</td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-sm whitespace-nowrap">{template.job_role_name || template.role}</td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-sm whitespace-nowrap">{template.duration_minutes} min</td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-sm whitespace-nowrap">{template.pass_threshold}%</td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3">{getStatusBadge(template.is_active)}</td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-sm whitespace-nowrap">{template.sections_config?.sections?.length || 0}</td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-sm text-gray-500 whitespace-nowrap">{formatDate(template.created_at)}</td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => navigate(`/app/templates/${template.id}`)}
                          className="p-2 -m-1 text-gray-600 hover:text-gray-800 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate(`/app/templates/${template.id}/edit`)}
                          className="p-2 -m-1 text-blue-600 hover:text-blue-800 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate(`/app/templates/${template.id}/history`)}
                          className="p-2 -m-1 text-purple-600 hover:text-purple-800 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(template.id, template.name)}
                          className="p-2 -m-1 text-red-600 hover:text-red-800 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
          <p className="text-gray-700 text-sm sm:text-base">Are you sure you want to delete template <strong>{deleteModal.templateName}</strong>?</p>
          <p className="text-sm text-gray-500">This action cannot be undone.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => handleDelete(deleteModal.templateId, deleteModal.templateName)}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors text-sm"
            >
              Delete
            </button>
            <button
              onClick={() => setDeleteModal({ isOpen: false, templateId: null, templateName: '' })}
              className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}